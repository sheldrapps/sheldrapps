import { mapToSupportedLocale } from './locale-detection.service';

type AppControlBridge = {
  restartApp(): void;
  restartForLocale?(locale: string): void;
};

const DEFAULT_LANGUAGE_RESTART_DELAY_MS = 900;

export async function restartForLanguageChange(
  locale: string,
  delayMs = DEFAULT_LANGUAGE_RESTART_DELAY_MS
): Promise<void> {
  await wait(delayMs);
  const bridge = await waitForAppControlBridge();
  const supportedLocale = mapToSupportedLocale(locale);

  if (bridge?.restartForLocale) {
    bridge.restartForLocale(supportedLocale);
    return;
  }

  restartApp();
}

export function restartApp(): void {
  const bridge = getAppControlBridge();
  if (bridge) {
    bridge.restartApp();
    return;
  }

  try {
    globalThis.window?.location?.reload();
  } catch {
    // Ignore environments without a browser location.
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function getAppControlBridge(): AppControlBridge | null {
  const scope = globalThis as typeof globalThis & {
    SheldrappsAppControl?: AppControlBridge;
    window?: {
      SheldrappsAppControl?: AppControlBridge;
    };
  };

  return scope.SheldrappsAppControl ?? scope.window?.SheldrappsAppControl ?? null;
}

async function waitForAppControlBridge(
  timeoutMs = 5000,
  intervalMs = 50
): Promise<AppControlBridge | null> {
  const startedAt = Date.now();
  let bridge = getAppControlBridge();

  while (!bridge && Date.now() - startedAt < timeoutMs) {
    await wait(intervalMs);
    bridge = getAppControlBridge();
  }

  return bridge;
}
