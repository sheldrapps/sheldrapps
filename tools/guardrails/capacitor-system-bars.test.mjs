import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const pnpmStorePath = path.join(workspaceRoot, 'node_modules', '.pnpm');
const systemBarsSuffix = path.join(
  'node_modules',
  '@capacitor',
  'android',
  'capacitor',
  'src',
  'main',
  'java',
  'com',
  'getcapacitor',
  'plugin',
  'SystemBars.java',
);

function findSystemBarsSources() {
  const candidates = fs
    .readdirSync(pnpmStorePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('@capacitor+android@'))
    .map((entry) => path.join(pnpmStorePath, entry.name, systemBarsSuffix));

  const sourcePaths = candidates.filter((candidate) => fs.existsSync(candidate));
  assert.ok(sourcePaths.length > 0, 'installed Capacitor SystemBars source was not found');
  return sourcePaths.map((sourcePath) => fs.readFileSync(sourcePath, 'utf8'));
}

test('shared SystemBars avoids the fragile platform systemOverlays mapping', () => {
  for (const source of findSystemBarsSources()) {
    assert.match(source, /private int getSafeSystemBarsType\(\)/);
    assert.match(source, /WindowInsetsCompat\.Type\.statusBars\(\)/);
    assert.match(source, /WindowInsetsCompat\.Type\.navigationBars\(\)/);
    assert.match(source, /WindowInsetsCompat\.Type\.captionBar\(\)/);
    assert.doesNotMatch(source, /WindowInsetsCompat\.Type\.systemBars\(\)/);
  }
});
