const fs = require('fs');
const path = require('path');
const shortcuts = require('./app-shortcuts.cjs');

const rootPackagePath = path.join(__dirname, '..', 'package.json');

function buildScripts(shortcut) {
  const { short, slug, meDeviceId } = shortcut;

  const scripts = {
    [`dev:${short}`]: `pnpm --filter ${slug} start`,
    [`build:${short}`]: `pnpm --filter ${slug} build`,
    [`lint:${short}`]: `pnpm --filter ${slug} lint`,
    [`resources:${short}`]: `pnpm --filter ${slug} assets:android`,
    [`android:install:${short}`]: `powershell -ExecutionPolicy Bypass -File scripts/install-android-debug.ps1 -AppName ${slug}`,
    [`android:clean-install:${short}`]: `powershell -ExecutionPolicy Bypass -File scripts/install-android-debug.ps1 -AppName ${slug} -UninstallFirst`,
    [`phone:${short}`]: `pnpm android:install:${short}`,
    [`clean-phone:${short}`]: `pnpm android:clean-install:${short}`,
    [`bundleRelease:${short}`]: `pnpm --filter ${slug} bundleRelease`,
    [`serve:${short}`]: `pnpm --filter ${slug} start`,
    [`serve:${short}:no-open`]: `pnpm --filter ${slug} exec ionic serve --no-open`,
    [`debugApk:${short}`]: `pnpm --filter ${slug} debugApk`,
    [`releaseApk:${short}`]: `pnpm --filter ${slug} releaseApk`,
  };

  if (meDeviceId) {
    scripts[`phone:${short}:me`] = `pnpm android:install:${short} -- -DeviceId ${meDeviceId}`;
    scripts[`clean-phone:${short}:me`] = `pnpm android:clean-install:${short} -- -DeviceId ${meDeviceId}`;
  }

  return scripts;
}

function syncShortScripts() {
  const pkg = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  const scripts = pkg.scripts || {};

  const generatedKeys = new Set();
  for (const shortcut of shortcuts) {
    const entries = buildScripts(shortcut);
    for (const [key, value] of Object.entries(entries)) {
      scripts[key] = value;
      generatedKeys.add(key);
    }
  }

  pkg.scripts = scripts;
  fs.writeFileSync(rootPackagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return generatedKeys.size;
}

if (require.main === module) {
  const count = syncShortScripts();
  process.stdout.write(`Synced ${count} shortcut scripts.\n`);
}

module.exports = {
  buildScripts,
  syncShortScripts,
};
