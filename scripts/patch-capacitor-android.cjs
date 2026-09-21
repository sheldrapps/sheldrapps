const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const pnpmStorePath = path.join(workspaceRoot, "node_modules", ".pnpm");
const targets = [
  {
    relativePath: path.join(
      "node_modules",
      "@capacitor",
      "android",
      "capacitor",
      "src",
      "main",
      "java",
      "com",
      "getcapacitor",
      "Bridge.java",
    ),
    find: "        CapacitorPlugin annotation = plugin.getPluginHandle().getPluginAnnotation();\n        for (Permission perm : annotation.permissions()) {\n",
    replace: "        CapacitorPlugin annotation = plugin.getPluginHandle().getPluginAnnotation();\n        if (annotation == null) {\n            return permissionsResults;\n        }\n        for (Permission perm : annotation.permissions()) {\n",
  },
  {
    relativePath: path.join(
      "node_modules",
      "@capacitor",
      "android",
      "capacitor",
      "src",
      "main",
      "java",
      "com",
      "getcapacitor",
      "Plugin.java",
    ),
    find: "        CapacitorPlugin annotation = handle.getPluginAnnotation();\n        HashSet<String> perms = new HashSet<>();\n        for (Permission perm : annotation.permissions()) {\n",
    replace: "        CapacitorPlugin annotation = handle.getPluginAnnotation();\n        HashSet<String> perms = new HashSet<>();\n        if (annotation == null) {\n            return new String[0];\n        }\n        for (Permission perm : annotation.permissions()) {\n",
  },
  {
    relativePath: path.join(
      "node_modules",
      "@capacitor",
      "android",
      "capacitor",
      "src",
      "main",
      "java",
      "com",
      "getcapacitor",
      "plugin",
      "SystemBars.java",
    ),
    find: "    private void setStyle(String style, String bar) {\n",
    replace: "    private int getSafeSystemBarsType() {\n        // Avoid Type.systemBars(): some API 34+ firmwares lack systemOverlays().\n        return WindowInsetsCompat.Type.statusBars()\n            | WindowInsetsCompat.Type.navigationBars()\n            | WindowInsetsCompat.Type.captionBar();\n    }\n\n    private void setStyle(String style, String bar) {\n",
  },
  {
    relativePath: path.join(
      "node_modules",
      "@capacitor",
      "android",
      "capacitor",
      "src",
      "main",
      "java",
      "com",
      "getcapacitor",
      "plugin",
      "SystemBars.java",
    ),
    find: "WindowInsetsCompat.Type.systemBars()",
    replace: "getSafeSystemBarsType()",
    replaceAll: true,
  },
];

function patchFile(filePath, target) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const current = fs.readFileSync(filePath, "utf8");
  if (target.replaceAll) {
    if (!current.includes(target.find)) {
      return false;
    }

    fs.writeFileSync(filePath, current.replaceAll(target.find, target.replace), "utf8");
    return true;
  }

  if (current.includes(target.replace)) {
    return false;
  }
  if (!current.includes(target.find)) {
    return false;
  }

  fs.writeFileSync(filePath, current.replace(target.find, target.replace), "utf8");
  return true;
}

function main() {
  let patchedCount = 0;
  const installRoots = [path.join(workspaceRoot, "node_modules")];

  if (fs.existsSync(pnpmStorePath)) {
    for (const entry of fs.readdirSync(pnpmStorePath, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("@capacitor+android@")) {
        installRoots.push(path.join(pnpmStorePath, entry.name));
      }
    }
  }

  for (const target of targets) {
    for (const installRoot of installRoots) {
      if (patchFile(path.join(installRoot, target.relativePath), target)) {
        patchedCount += 1;
      }
    }
  }

  console.log(
    patchedCount > 0
      ? `[patch-capacitor-android] patched ${patchedCount} file(s)`
      : "[patch-capacitor-android] no changes needed",
  );
}

main();
