import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const distDir = path.join(pkgRoot, 'dist');

// Copy dist contents to root

function copyRecursive(src, dest) {
  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive(distDir, pkgRoot);

// Update root package.json to match dist/package.json
const originalPkgPath = path.join(pkgRoot, 'package.json');
const distPkgPath = path.join(distDir, 'package.json');

const originalPkg = JSON.parse(fs.readFileSync(originalPkgPath, 'utf8'));
const distPkg = JSON.parse(fs.readFileSync(distPkgPath, 'utf8'));

// Merge: keep dist exports/main/types
const mergedPkg = {
  ...originalPkg,
  // Override with dist values
  main: distPkg.main,
  module: distPkg.module,
  types: distPkg.types,
  exports: distPkg.exports,
  // Remove scripts
  scripts: undefined,
  devDependencies: undefined,
};

delete mergedPkg.scripts;
delete mergedPkg.devDependencies;

fs.writeFileSync(originalPkgPath, JSON.stringify(mergedPkg, null, 2) + '\n');

