import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const pnpmStorePath = path.join(workspaceRoot, 'node_modules', '.pnpm');
const pluginSuffix = path.join(
  'node_modules',
  '@capgo',
  'native-purchases',
  'android',
  'src',
  'main',
  'java',
  'ee',
  'forgr',
  'nativepurchases',
  'NativePurchasesPlugin.java',
);
const pluginBuildSuffix = path.join(
  'node_modules',
  '@capgo',
  'native-purchases',
  'android',
  'build.gradle',
);

function findNativePurchasesSources() {
  const candidates = fs
    .readdirSync(pnpmStorePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('@capgo+native-purchases@'))
    .map((entry) => path.join(pnpmStorePath, entry.name, pluginSuffix));

  const sourcePaths = candidates.filter((candidate) => fs.existsSync(candidate));
  assert.ok(sourcePaths.length > 0, 'installed Capgo Native Purchases source was not found');
  return sourcePaths.map((sourcePath) => fs.readFileSync(sourcePath, 'utf8'));
}

function findNativePurchasesBuildFiles() {
  const candidates = fs
    .readdirSync(pnpmStorePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('@capgo+native-purchases@'))
    .map((entry) => path.join(pnpmStorePath, entry.name, pluginBuildSuffix));

  const buildPaths = candidates.filter((candidate) => fs.existsSync(candidate));
  assert.ok(buildPaths.length > 0, 'installed Capgo Native Purchases Gradle file was not found');
  return buildPaths.map((buildPath) => fs.readFileSync(buildPath, 'utf8'));
}

test('shared native purchases plugin uses the upgraded Billing version', () => {
  for (const buildFile of findNativePurchasesBuildFiles()) {
    assert.match(buildFile, /def billing_version = "9\.1\.0"/);
    assert.doesNotMatch(buildFile, /def billing_version = "8\.3\.0"/);
  }
});

test('purchase flow launches Billing from the Android main thread', () => {
  for (const source of findNativePurchasesSources()) {
    assert.match(source, /getActivity\(\)\.runOnUiThread\(\(\) -> \{/);
    assert.match(source, /billingClient\.launchBillingFlow\(getActivity\(\), billingFlowParams\)/);
  }
});

test('native ownership query rejects failed BillingClient responses', () => {
  for (const source of findNativePurchasesSources()) {
    assert.match(source, /AtomicBoolean queryFailed = new AtomicBoolean\(false\)/);
    assert.match(source, /call\.reject\(failure != null \? failure : "Billing purchases query failed"\)/);
    assert.match(source, /response code/);
  }
});

test('native ownership query resolves an empty array only after successful callbacks', () => {
  for (const source of findNativePurchasesSources()) {
    assert.match(source, /result\.put\("purchases", allPurchases\)/);
    assert.match(source, /if \(queryFailed\.get\(\)\)/);
    assert.match(source, /Billing purchases query failed while processing/);
  }
});

test('restore flow performs a fresh entitlement refresh after native restore', () => {
  const source = fs.readFileSync(
    path.join(workspaceRoot, 'packages', 'ads-kit', 'src', 'lib', 'billing.service.ts'),
    'utf8',
  );
  const restoreIndex = source.indexOf('await NativePurchases.restorePurchases()');
  const refreshIndex = source.indexOf('return this.performEntitlementRefreshWithRetry()', restoreIndex);

  assert.ok(restoreIndex >= 0);
  assert.ok(refreshIndex > restoreIndex);
});
