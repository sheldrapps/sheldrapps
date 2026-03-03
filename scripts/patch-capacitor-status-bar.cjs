const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const templatePath = path.join(
  __dirname,
  "templates",
  "capacitor-status-bar",
  "StatusBar.java",
);
const pnpmStorePath = path.join(workspaceRoot, "node_modules", ".pnpm");
const relativePluginPath = path.join(
  "node_modules",
  "@capacitor",
  "status-bar",
  "android",
  "src",
  "main",
  "java",
  "com",
  "capacitorjs",
  "plugins",
  "statusbar",
  "StatusBar.java",
);

function patchIfPresent(filePath, contents) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const current = fs.readFileSync(filePath, "utf8");
  if (current === contents) {
    return false;
  }

  fs.writeFileSync(filePath, contents, "utf8");
  return true;
}

function main() {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing template: ${templatePath}`);
  }

  const template = fs.readFileSync(templatePath, "utf8");
  let patchedCount = 0;

  const directInstallPath = path.join(
    workspaceRoot,
    "node_modules",
    "@capacitor",
    "status-bar",
    "android",
    "src",
    "main",
    "java",
    "com",
    "capacitorjs",
    "plugins",
    "statusbar",
    "StatusBar.java",
  );
  if (patchIfPresent(directInstallPath, template)) {
    patchedCount += 1;
  }

  if (fs.existsSync(pnpmStorePath)) {
    for (const entry of fs.readdirSync(pnpmStorePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("@capacitor+status-bar@")) {
        continue;
      }

      const candidate = path.join(pnpmStorePath, entry.name, relativePluginPath);
      if (patchIfPresent(candidate, template)) {
        patchedCount += 1;
      }
    }
  }

  const message =
    patchedCount > 0
      ? `[patch-capacitor-status-bar] patched ${patchedCount} file(s)`
      : "[patch-capacitor-status-bar] no changes needed";
  console.log(message);
}

main();
