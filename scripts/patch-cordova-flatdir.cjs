const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const appNames = [
  "epub-fixer",
  "epub-merger-and-splitter",
  "presupuesto-ninos",
];

const targets = [
  {
    relativePath: path.join("android", "capacitor-cordova-android-plugins", "build.gradle"),
    find: [
      "repositories {\n    google()\n    mavenCentral()\n    flatDir{\n        dirs 'src/main/libs', 'libs'\n    }\n}\n",
      "repositories {\n    google()\n    mavenCentral()\n    flatDir {\n        dirs 'src/main/libs', 'libs'\n    }\n}\n",
    ],
  },
];

function patchFile(filePath, finds) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const current = fs.readFileSync(filePath, "utf8");
  for (const find of finds) {
    if (!current.includes(find)) {
      continue;
    }

    const updated = current.replace(find, "repositories {\n    google()\n    mavenCentral()\n}\n");
    if (updated !== current) {
      fs.writeFileSync(filePath, updated, "utf8");
      return true;
    }
  }

  return false;
}

function main() {
  let patchedCount = 0;

  for (const appName of appNames) {
    for (const target of targets) {
      const filePath = path.join(workspaceRoot, "apps", appName, target.relativePath);
      if (patchFile(filePath, target.find)) {
        patchedCount += 1;
      }
    }
  }

  console.log(
    patchedCount > 0
      ? `[patch-cordova-flatdir] patched ${patchedCount} file(s)`
      : "[patch-cordova-flatdir] no changes needed",
  );
}

main();
