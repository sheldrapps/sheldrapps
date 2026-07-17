const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const npmCachePath = path.join(repoRoot, '.npm-cache');
const env = { ...process.env };

for (const key of Object.keys(env)) {
  if (key.toLowerCase().startsWith('npm_config_')) {
    delete env[key];
  }
}

env.npm_config_cache = npmCachePath;

if (!process.env.npm_execpath) {
  throw new Error('run-capacitor-assets.cjs must be launched through pnpm');
}

const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'exec', 'capacitor-assets', ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell: false,
  }
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
