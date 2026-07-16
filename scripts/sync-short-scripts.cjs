const fs = require('fs');
const path = require('path');
const { shortcuts, groups } = require('./app-shortcuts.cjs');

const rootPackagePath = path.join(__dirname, '..', 'package.json');

function buildScripts(shortcut) {
  const { short, slug } = shortcut;

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

  return scripts;
}

function buildGroupScripts(groupName, shorts) {
  const buildChain = (prefix, suffix = '') => shorts.map((short) => `pnpm ${prefix}:${short}${suffix}`).join(' && ');
  const scripts = {
    [`dev:${groupName}`]: buildChain('dev'),
    [`build:${groupName}`]: buildChain('build'),
    [`lint:${groupName}`]: buildChain('lint'),
    [`resources:${groupName}`]: buildChain('resources'),
    [`android:install:${groupName}`]: buildChain('android:install'),
    [`android:clean-install:${groupName}`]: buildChain('android:clean-install'),
    [`phone:${groupName}`]: `pnpm android:install:${groupName}`,
    [`clean-phone:${groupName}`]: `pnpm android:clean-install:${groupName}`,
    [`bundleRelease:${groupName}`]: buildChain('bundleRelease'),
    [`serve:${groupName}`]: buildChain('serve'),
    [`serve:${groupName}:no-open`]: buildChain('serve', ':no-open'),
    [`debugApk:${groupName}`]: buildChain('debugApk'),
    [`releaseApk:${groupName}`]: buildChain('releaseApk'),
  };

  return scripts;
}

function syncShortScripts() {
  const pkg = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  const scripts = pkg.scripts || {};
  const staleMeKeyPattern = /^(phone|clean-phone):[^:]+:me$/;

  for (const key of Object.keys(scripts)) {
    if (staleMeKeyPattern.test(key)) {
      delete scripts[key];
    }
  }

  for (const groupName of Object.keys(groups)) {
    delete scripts[groupName];
  }

  const generatedKeys = new Set();
  for (const shortcut of shortcuts) {
    const entries = buildScripts(shortcut);
    for (const [key, value] of Object.entries(entries)) {
      scripts[key] = value;
      generatedKeys.add(key);
    }
  }

  for (const [groupName, shorts] of Object.entries(groups)) {
    const entries = buildGroupScripts(groupName, shorts);
    for (const [key, value] of Object.entries(entries)) {
      scripts[key] = value;
      generatedKeys.add(key);
    }
  }

  pkg.scripts = scripts;
  fs.writeFileSync(rootPackagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  return generatedKeys.size + Object.keys(groups).length;
}

if (require.main === module) {
  const count = syncShortScripts();
  process.stdout.write(`Synced ${count} shortcut scripts.\n`);
}

module.exports = {
  buildScripts,
  syncShortScripts,
};
