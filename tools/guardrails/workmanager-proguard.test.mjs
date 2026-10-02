import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const appsRoot = path.join(workspaceRoot, 'apps');
const workManagerKeepRule = /^-keep class androidx\.work\.\*\* \{ \*; \}$/m;

function findAdMobApps() {
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((appName) => {
      const capacitorBuildFile = path.join(
        appsRoot,
        appName,
        'android',
        'app',
        'capacitor.build.gradle',
      );

      return (
        fs.existsSync(capacitorBuildFile) &&
        fs.readFileSync(capacitorBuildFile, 'utf8').includes(
          "project(':capacitor-community-admob')",
        )
      );
    });
}

test('all Android apps using AdMob preserve WorkManager reflection classes', () => {
  const adMobApps = findAdMobApps();

  assert.ok(adMobApps.length > 0, 'no Android app using AdMob was found');

  for (const appName of adMobApps) {
    const proguardPath = path.join(
      appsRoot,
      appName,
      'android',
      'app',
      'proguard-rules.pro',
    );

    assert.ok(fs.existsSync(proguardPath), `${appName} is missing proguard-rules.pro`);
    assert.match(
      fs.readFileSync(proguardPath, 'utf8'),
      workManagerKeepRule,
      `${appName} must keep androidx.work classes for release startup initialization`,
    );
  }
});
