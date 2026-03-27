import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const appArg = process.argv[2];
if (!appArg) {
  console.error('Usage: node check-remove-ads-animation.mjs <app-dir>');
  process.exit(1);
}

const isUrlMode = /^https?:\/\//i.test(appArg);
const rootDir = isUrlMode ? null : path.resolve(appArg);
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const cdpPort = process.argv[3] ? Number(process.argv[3]) : 9229;
const routePath = process.argv[4] || '/';

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createStaticServer(dir) {
  const server = createServer(async (req, res) => {
    try {
      const raw = (req.url || '/').split('?')[0].split('#')[0];
      let reqPath = decodeURIComponent(raw);
      if (reqPath === '/') reqPath = '/index.html';
      let filePath = path.normalize(path.join(dir, reqPath));
      if (!filePath.startsWith(path.normalize(dir))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      let data;
      try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
        data = await fs.readFile(filePath);
      } catch {
        data = await fs.readFile(path.join(dir, 'index.html'));
        filePath = path.join(dir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', mime.get(ext) || 'application/octet-stream');
      res.writeHead(200);
      res.end(data);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Could not determine server address');
  }
  return { server, port: addr.port };
}

async function waitForJson(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP socket timeout')), 10000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    socket.addEventListener('error', (event) => {
      clearTimeout(timer);
      reject(event.error || new Error('CDP socket error'));
    }, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(String(event.data));
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    }
  });

  function send(method, params = {}) {
    const id = nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(payload);
    });
  }

  async function close() {
    for (const [id, handler] of pending.entries()) {
      handler.reject(new Error(`CDP closed before response ${id}`));
    }
    pending.clear();
    socket.close();
  }

  return { send, close };
}

function evalExpr(expr) {
  return `(() => { ${expr} })()`;
}

async function main() {
  let server = null;
  let appUrl = appArg;
  if (!isUrlMode) {
    const staticServer = await createStaticServer(rootDir);
    server = staticServer.server;
    appUrl = `http://127.0.0.1:${staticServer.port}${routePath}`;
  }
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edge-cdp-'));

  const edge = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,800',
    appUrl,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let edgeStdErr = '';
  edge.stderr.on('data', (chunk) => {
    edgeStdErr += String(chunk);
  });

  try {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json/list`);
    const expectedHost = (() => {
      try {
        return new URL(appUrl).host;
      } catch {
        return null;
      }
    })();
    const pageTarget = Array.isArray(targets)
      ? targets.find((target) =>
          target?.type === 'page' &&
          typeof target?.url === 'string' &&
          expectedHost &&
          target.url.includes(expectedHost),
        ) ?? targets.find((target) => target?.type === 'page')
      : null;
    const wsUrl = pageTarget?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No page webSocketDebuggerUrl');

    const cdp = await createCdpClient(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: appUrl });
    await delay(2500);

    const runtimeStart = Date.now();
    // Edge may report "Cannot find default execution context" until the page world is ready.
    while (true) {
      try {
        await cdp.send('Runtime.evaluate', {
          expression: '1',
          returnByValue: true,
        });
        break;
      } catch (error) {
        const message = String(error?.message || error);
        if (
          !message.includes('default execution context') ||
          Date.now() - runtimeStart > 15000
        ) {
          throw error;
        }
        await delay(250);
      }
    }

    const waitForButtonExpr = evalExpr(`
      const start = Date.now();
      return new Promise((resolve) => {
        const tick = () => {
          const btn = document.querySelector('ion-button.premium-upgrade-cta');
          if (btn) {
            resolve(true);
            return;
          }
          if (Date.now() - start > 20000) {
            resolve(false);
            return;
          }
          setTimeout(tick, 200);
        };
        tick();
      });
    `);

    async function waitForButtonVisible() {
      const ready = await cdp.send('Runtime.evaluate', {
        expression: waitForButtonExpr,
        awaitPromise: true,
        returnByValue: true,
      });
      return ready?.result?.value === true;
    }

    let buttonVisible = await waitForButtonVisible();
    if (!buttonVisible) {
      // In dev web the CTA can be hidden if previous local cache has adsRemoved=true.
      await cdp.send('Runtime.evaluate', {
        expression: evalExpr(`
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (!key || !key.includes('.settings')) continue;
              const raw = localStorage.getItem(key);
              if (!raw) continue;
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                parsed.adsRemoved = false;
                localStorage.setItem(key, JSON.stringify(parsed));
              }
            }
          } catch {}
          location.reload();
          return true;
        `),
        returnByValue: true,
      });
      await delay(2500);
      buttonVisible = await waitForButtonVisible();
    }

    if (!buttonVisible) {
      const debugSnapshot = await cdp.send('Runtime.evaluate', {
        expression: evalExpr(`
          const allButtons = Array.from(document.querySelectorAll('ion-button'))
            .map((el) => el.className)
            .slice(0, 20);
          return {
            locationHref: location.href,
            title: document.title,
            bodyPreview: (document.body?.innerText || '').slice(0, 500),
            ionButtonCount: document.querySelectorAll('ion-button').length,
            ionButtonClasses: allButtons,
            appRootExists: !!document.querySelector('app-root'),
          };
        `),
        returnByValue: true,
      });
      throw new Error(
        `premium-upgrade-cta button not found in runtime ${JSON.stringify(debugSnapshot?.result?.value ?? {})}`,
      );
    }

    const sampleExpr = evalExpr(`
      const btn = document.querySelector('ion-button.premium-upgrade-cta');
      if (!btn) {
        return { exists: false };
      }
      const nativeEl = btn.shadowRoot?.querySelector('[part~="native"]');
      const hostStyle = getComputedStyle(btn);
      const nativeStyle = nativeEl ? getComputedStyle(nativeEl) : null;
      const ancestorOverflow = [];
      let cursor = btn.parentElement;
      let depth = 0;
      while (cursor && depth < 8) {
        const st = getComputedStyle(cursor);
        ancestorOverflow.push({
          tag: cursor.tagName.toLowerCase(),
          className: cursor.className || '',
          overflowX: st.overflowX,
          overflowY: st.overflowY,
        });
        cursor = cursor.parentElement;
        depth += 1;
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return {
        exists: true,
        pulseClassOnHost: btn.classList.contains('premium-upgrade-cta--pulse'),
        hostClassName: btn.className,
        hostAnimationName: hostStyle.animationName,
        hostOverflow: hostStyle.overflow,
        nativeFound: !!nativeEl,
        nativeAnimationName: nativeStyle?.animationName || null,
        nativeBoxShadow: nativeStyle?.boxShadow || null,
        nativeTransitionProperty: nativeStyle?.transitionProperty || null,
        reducedMotion,
        ancestorOverflow,
      };
    `);

    const timeline = [];
    const start = Date.now();
    let lastPulse = null;
    let transitions = 0;
    while (Date.now() - start < 18000) {
      const sample = await cdp.send('Runtime.evaluate', {
        expression: sampleExpr,
        returnByValue: true,
      });
      const value = sample?.result?.value;
      timeline.push({ t: Date.now() - start, ...value });
      if (typeof value?.pulseClassOnHost === 'boolean') {
        if (lastPulse !== null && lastPulse !== value.pulseClassOnHost) {
          transitions += 1;
        }
        lastPulse = value.pulseClassOnHost;
      }
      await delay(180);
    }

    await cdp.send('Runtime.evaluate', {
      expression: evalExpr(`
        const style = document.createElement('style');
        style.id = 'diag-upgrade-glow';
        style.textContent = 'ion-button.premium-upgrade-cta--pulse::part(native){box-shadow:0 0 0 1px rgba(var(--ion-color-primary-rgb),0.40),0 0 0 8px rgba(var(--ion-color-primary-rgb),0.32) !important;}';
        document.head.appendChild(style);
        return true;
      `),
      returnByValue: true,
    });

    const diagTimeline = [];
    const diagStart = Date.now();
    while (Date.now() - diagStart < 10000) {
      const sample = await cdp.send('Runtime.evaluate', {
        expression: sampleExpr,
        returnByValue: true,
      });
      diagTimeline.push({ t: Date.now() - diagStart, ...sample?.result?.value });
      await delay(180);
    }

    await cdp.send('Runtime.evaluate', {
      expression: evalExpr(`
        document.getElementById('diag-upgrade-glow')?.remove();
        return true;
      `),
      returnByValue: true,
    });

    const pulseSamples = timeline.filter((s) => s.pulseClassOnHost === true);
    const diagPulseSamples = diagTimeline.filter((s) => s.pulseClassOnHost === true);
    const pulseDurationsMs = [];
    let blockStart = null;
    for (const point of timeline) {
      if (point.pulseClassOnHost === true && blockStart === null) {
        blockStart = point.t;
      }
      if (point.pulseClassOnHost !== true && blockStart !== null) {
        pulseDurationsMs.push(point.t - blockStart);
        blockStart = null;
      }
    }
    if (blockStart !== null && timeline.length > 0) {
      pulseDurationsMs.push(timeline[timeline.length - 1].t - blockStart);
    }
    const ancestorOverflowSnapshots = timeline
      .map((s) => JSON.stringify(s.ancestorOverflow || []))
      .filter(Boolean);

    const result = {
      appRoot: rootDir ?? appUrl,
      reducedMotionDetected: timeline.some((s) => s.reducedMotion === true),
      buttonFound: timeline.some((s) => s.exists),
      nativePartFound: timeline.some((s) => s.nativeFound),
      pulseSamplesCount: pulseSamples.length,
      pulseClassTransitions: transitions,
      pulseDurationsMs,
      sawNativeAnimationName: Array.from(new Set(pulseSamples.map((s) => s.nativeAnimationName).filter(Boolean))),
      nativeTransitionPropertiesOnPulse: Array.from(
        new Set(pulseSamples.map((s) => s.nativeTransitionProperty).filter(Boolean)),
      ),
      baselineBoxShadowsOnPulse: Array.from(new Set(pulseSamples.map((s) => s.nativeBoxShadow).filter(Boolean))).slice(0, 5),
      diagnosticBoxShadowsOnPulse: Array.from(new Set(diagPulseSamples.map((s) => s.nativeBoxShadow).filter(Boolean))).slice(0, 5),
      hostOverflowValues: Array.from(new Set(timeline.map((s) => s.hostOverflow).filter(Boolean))),
      ancestorOverflowValues: Array.from(new Set(ancestorOverflowSnapshots)).slice(0, 3).map((raw) => JSON.parse(raw)),
      edgeStderrTail: edgeStdErr.slice(-500),
    };

    console.log(JSON.stringify(result, null, 2));
    await cdp.close();
  } finally {
    try {
      edge.kill('SIGTERM');
    } catch {}
    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    } catch {}
  }
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
