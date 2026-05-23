#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = process.cwd();
const ZERO_HASH = '0000000000000000000000000000000000000000';
const ALIASES = {
  ccfk: 'cover-creator-for-kindle',
  ecc: 'epub-cover-changer',
  jos: 'just-one-step',
  ef: 'epub-fixer',
  pn: 'presupuesto-ninos',
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function exec(command) {
  return execSync(command, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function execSafe(command) {
  try {
    return exec(command);
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const parsed = {
    target: '',
    dryRun: false,
    deltaFromAnchor: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!parsed.target && !token.startsWith('--')) {
      parsed.target = token;
      continue;
    }

    if (token === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (token === '--delta-from-anchor') {
      parsed.deltaFromAnchor = true;
      continue;
    }
  }

  return parsed;
}

function resolveProject(target) {
  const normalized = (target || '').trim().toLowerCase();
  if (!normalized) {
    fail('Uso: pnpm increment:collect <ccfk|ecc|jos|ef|pn|app-name> [--delta-from-anchor] [--dry-run]');
  }

  if (ALIASES[normalized]) {
    return { shortName: normalized, project: ALIASES[normalized] };
  }

  const appPath = path.join(repoRoot, 'apps', normalized);
  if (fs.existsSync(appPath)) {
    return {
      shortName: normalized.split('-').map((p) => p[0]).join(''),
      project: normalized,
    };
  }

  fail(`Proyecto no reconocido: ${target}`);
}

function readBuildGradle(buildGradlePath) {
  const content = fs.readFileSync(buildGradlePath, 'utf8');
  const codeMatch = content.match(/versionCode\s+(\d+)/);
  const nameMatch = content.match(/versionName\s+"([^"]*)"/);
  if (!codeMatch || !nameMatch) {
    fail(`No se pudo leer versionCode/versionName en ${buildGradlePath}`);
  }

  const lines = content.split(/\r?\n/);
  const versionCodeLine = lines.findIndex((line) => /^\s*versionCode\s+\d+\s*$/.test(line));
  if (versionCodeLine < 0) {
    fail(`No se encontro linea versionCode en ${buildGradlePath}`);
  }

  return {
    versionCode: Number(codeMatch[1]),
    versionName: nameMatch[1],
    versionCodeLine: versionCodeLine + 1,
  };
}

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function parsePorcelainPath(line) {
  const match = line.match(/^..\s+(.+)$/);
  const raw = match ? match[1].trim() : line.trim();
  const split = raw.split(' -> ');
  return split[split.length - 1].trim();
}

function collectDeltaFiles(project, fromCommit, toCommit) {
  const commitFiles = fromCommit && toCommit
    ? execSafe(`git diff --name-only ${fromCommit}..${toCommit} -- apps/${project} packages`)
        .split(/\r?\n/)
        .filter(Boolean)
    : [];

  const statusFiles = execSafe(`git status --porcelain -- apps/${project} packages`)
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parsePorcelainPath)
    .filter(Boolean);

  return Array.from(new Set([...commitFiles, ...statusFiles]));
}

function parseAndroidStringMap(xml) {
  const map = {};
  if (!xml) return map;
  const regex = /<string\s+name="([^"]+)">([\s\S]*?)<\/string>/g;
  let match = regex.exec(xml);
  while (match) {
    map[match[1]] = match[2].trim();
    match = regex.exec(xml);
  }
  return map;
}

function detectI18nTitleChanges(project, deltaFiles) {
  const regex = new RegExp(`^apps/${project}/src/assets/i18n/([^/]+)\\.json$`, 'i');
  const out = [];

  for (const filePath of deltaFiles) {
    const hit = filePath.match(regex);
    if (!hit) continue;

    const locale = hit[1];
    const absolutePath = path.join(repoRoot, filePath);
    if (!fs.existsSync(absolutePath)) continue;

    const current = readJsonSafe(absolutePath);
    const prevRaw = execSafe(`git show HEAD:${filePath}`);
    if (!current || !prevRaw) continue;

    let previous;
    try {
      previous = JSON.parse(prevRaw);
    } catch {
      continue;
    }

    const from = previous?.APP?.TITLE;
    const to = current?.APP?.TITLE;
    if (!from || !to || from === to) continue;

    out.push({ locale, from, to });
  }

  return out;
}

function detectAndroidAppNameChanges(project, deltaFiles) {
  const relativePath = `apps/${project}/android/app/src/main/res/values/strings.xml`;
  if (!deltaFiles.includes(relativePath) && !deltaFiles.includes(`M ${relativePath}`)) {
    return [];
  }

  const currentPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(currentPath)) return [];

  const currentMap = parseAndroidStringMap(fs.readFileSync(currentPath, 'utf8'));
  const previousMap = parseAndroidStringMap(execSafe(`git show HEAD:${relativePath}`));
  const keys = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);
  const changes = [];

  for (const key of keys) {
    if (key !== 'app_name' && !key.startsWith('app_name_')) continue;
    const from = previousMap[key] || '';
    const to = currentMap[key] || '';
    if (!from || !to || from === to) continue;
    changes.push({ key, from, to });
  }

  return changes;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { project, shortName } = resolveProject(args.target);

  const buildGradlePath = path.join(repoRoot, 'apps', project, 'android', 'app', 'build.gradle');
  if (!fs.existsSync(buildGradlePath)) {
    fail(`No existe ${buildGradlePath}`);
  }

  const build = readBuildGradle(buildGradlePath);
  const head = execSafe('git rev-parse HEAD');
  const buildGradleRelative = path.relative(repoRoot, buildGradlePath).replace(/\\/g, '/');
  const blame = execSafe(`git blame -L ${build.versionCodeLine},${build.versionCodeLine} --porcelain -- ${buildGradleRelative}`);
  const firstLine = blame.split(/\r?\n/)[0] || '';
  const match = firstLine.match(/^([0-9a-f]{40})\s/);
  const versionCodeAnchorCommit = (match && match[1] !== ZERO_HASH)
    ? match[1]
    : execSafe(`git log -n 1 --pretty=format:%H -- ${buildGradleRelative}`);

  const utilitiesDir = path.join(repoRoot, 'docs', 'utilities', shortName);
  const statePath = path.join(utilitiesDir, 'state.json');
  const existingState = readJsonSafe(statePath);
  const lastProcessed = existingState?.tracking?.lastProcessedHead || '';
  const deltaFrom = args.deltaFromAnchor
    ? (versionCodeAnchorCommit || head)
    : (lastProcessed || head);

  const deltaFiles = collectDeltaFiles(project, deltaFrom, head);
  const titleChanges = detectI18nTitleChanges(project, deltaFiles);
  const appNameChanges = detectAndroidAppNameChanges(project, deltaFiles);

  const deltaDoc = {
    project,
    shortName,
    generatedAt: new Date().toISOString(),
    head,
    versionCodeAnchorCommit: versionCodeAnchorCommit || head,
    source: {
      buildGradle: buildGradleRelative,
      scope: [`apps/${project}/**`, 'packages/**'],
    },
    version: {
      currentCode: build.versionCode,
      currentName: build.versionName,
    },
    delta: {
      mode: lastProcessed ? 'incremental' : 'snapshot-first-run',
      from: deltaFrom,
      to: head,
      changedFilesCount: deltaFiles.length,
      changedFiles: deltaFiles,
    },
    userFacingFacts: {
      appTitleChanges: titleChanges,
      androidAppNameChanges: appNameChanges,
    },
  };

  const deltaPath = path.join(utilitiesDir, 'delta.json');
  if (!args.dryRun) {
    fs.mkdirSync(utilitiesDir, { recursive: true });
    fs.writeFileSync(deltaPath, `${JSON.stringify(deltaDoc, null, 2)}\n`, 'utf8');
  }

  console.log([
    `project=${project}`,
    `shortName=${shortName}`,
    `buildGradle=${buildGradleRelative}`,
    `deltaFrom=${deltaFrom}`,
    `deltaTo=${head}`,
    `changedFiles=${deltaFiles.length}`,
    `deltaPath=${path.relative(repoRoot, deltaPath).replace(/\\/g, '/')}`,
    `dryRun=${args.dryRun}`,
    `deltaFromAnchor=${args.deltaFromAnchor}`,
  ].join('\n'));
}

main();
