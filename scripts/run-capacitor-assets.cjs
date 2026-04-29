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

const result =
  process.platform === 'win32'
    ? spawnSync(
        process.env.ComSpec || 'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          `npx --yes --package @capacitor/assets capacitor-assets ${process.argv
            .slice(2)
            .join(' ')}`,
        ],
        {
          cwd: process.cwd(),
          env,
          stdio: 'inherit',
          shell: false,
        }
      )
    : spawnSync(
        'npx',
        ['--yes', '--package', '@capacitor/assets', 'capacitor-assets', ...process.argv.slice(2)],
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
