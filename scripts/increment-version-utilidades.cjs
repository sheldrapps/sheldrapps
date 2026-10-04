#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { shortcuts } = require('./app-shortcuts.cjs');

const repoRoot = process.cwd();
const ZERO_HASH = '0000000000000000000000000000000000000000';
const ALIASES = Object.fromEntries(
  shortcuts.map(({ short, slug }) => [short, slug]),
);

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
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!parsed.target && !token.startsWith('--')) {
      parsed.target = token;
      continue;
    }
  }

  return parsed;
}

function resolveProject(target) {
  const normalized = (target || '').trim().toLowerCase();
  if (!normalized) {
    fail('Uso: pnpm increment:version <ccfk|ecc|ef|emas|pmas|pcm|eme|app-name>');
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

  const deltaFrom = versionCodeAnchorCommit || head;

  const deltaFiles = collectDeltaFiles(project, deltaFrom, head);

  console.log([
    `project=${project}`,
    `shortName=${shortName}`,
    `buildGradle=${buildGradleRelative}`,
    `currentVersionCode=${build.versionCode}`,
    `currentVersionName=${build.versionName}`,
    `deltaFrom=${deltaFrom}`,
    `deltaTo=${head}`,
    `changedFiles=${deltaFiles.length}`,
    ...deltaFiles.map((file) => `changedFile=${file}`),
  ].join('\n'));
}

main();
