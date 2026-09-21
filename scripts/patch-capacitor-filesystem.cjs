const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const pnpmStorePath = path.join(workspaceRoot, "node_modules", ".pnpm");
const pluginRootRelativePath = path.join(
  "node_modules",
  "@capacitor",
  "filesystem",
  "android",
  "src",
  "main",
  "kotlin",
  "com",
  "capacitorjs",
  "plugins",
  "filesystem",
);

const filesystemPluginPath = path.join(pluginRootRelativePath, "FilesystemPlugin.kt");
const legacyFilesystemPath = path.join(pluginRootRelativePath, "LegacyFilesystemImplementation.kt");
const filesystemBuildGradlePath = path.join(
  "node_modules",
  "@capacitor",
  "filesystem",
  "android",
  "build.gradle",
);

const replacements = [
  {
    filePath: filesystemPluginPath,
    find: "    @PermissionCallback\n    private fun permissionCallback(call: PluginCall) {\n",
    replace: "    @PermissionCallback\n    @Suppress(\"DEPRECATION\")\n    private fun permissionCallback(call: PluginCall) {\n",
  },
  {
    filePath: legacyFilesystemPath,
    find: '                return File(u.path)\n',
    replace: '                return File(requireNotNull(u.path) { "path is required" })\n',
  },
];

function patchFile(filePath, operations) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const original = fs.readFileSync(filePath, "utf8");
  let current = original;
  let changed = false;

  for (const operation of operations) {
    if (!current.includes(operation.find)) {
      continue;
    }

    current = current.replace(operation.find, operation.replace);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, current, "utf8");
  }

  return changed;
}

function patchFilesystemBuildGradle(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const original = fs.readFileSync(filePath, "utf8");
  const updated = original
    .replace(
      "classpath 'com.android.tools.build:gradle:8.13.0'",
      "classpath 'com.android.tools.build:gradle:9.0.1'",
    )
    .replace(
      /^\s*classpath "org\.jetbrains\.kotlin:kotlin-gradle-plugin:\$kotlin_version"\r?\n/m,
      "",
    )
    .replace(/^apply plugin: 'kotlin-android'\r?\n/m, "");

  if (updated === original) {
    return false;
  }

  fs.writeFileSync(filePath, updated, "utf8");
  return true;
}

function main() {
  let patchedCount = 0;

  const directBuildGradlePath = path.join(workspaceRoot, filesystemBuildGradlePath);
  if (patchFilesystemBuildGradle(directBuildGradlePath)) {
    patchedCount += 1;
  }

  if (fs.existsSync(pnpmStorePath)) {
    for (const entry of fs.readdirSync(pnpmStorePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("@capacitor+filesystem@")) {
        continue;
      }

      const candidate = path.join(pnpmStorePath, entry.name, filesystemBuildGradlePath);
      if (patchFilesystemBuildGradle(candidate)) {
        patchedCount += 1;
      }
    }
  }

  for (const replacement of replacements) {
    const directInstallPath = path.join(workspaceRoot, replacement.filePath);
    if (patchFile(directInstallPath, [replacement])) {
      patchedCount += 1;
    }

    if (!fs.existsSync(pnpmStorePath)) {
      continue;
    }

    for (const entry of fs.readdirSync(pnpmStorePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("@capacitor+filesystem@")) {
        continue;
      }

      const candidate = path.join(pnpmStorePath, entry.name, replacement.filePath);
      if (patchFile(candidate, [replacement])) {
        patchedCount += 1;
      }
    }
  }

  const message =
    patchedCount > 0
      ? `[patch-capacitor-filesystem] patched ${patchedCount} file(s)`
      : "[patch-capacitor-filesystem] no changes needed";
  console.log(message);
}

main();
