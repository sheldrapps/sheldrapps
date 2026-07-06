const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const pnpmStorePath = path.join(workspaceRoot, "node_modules", ".pnpm");
const pluginRootRelativePath = path.join(
  "node_modules",
  "@capacitor-community",
  "admob",
  "android",
  "src",
  "main",
  "java",
  "com",
  "getcapacitor",
  "community",
  "admob",
);
const patchTargets = [
  {
    templateRelativePath: "BannerAdSizeEnum.kt",
    pluginRelativePath: path.join("banner", "BannerAdSizeEnum.kt"),
  },
  {
    templateRelativePath: path.join("rewarded", "AdRewardExecutor.java"),
    pluginRelativePath: path.join("rewarded", "AdRewardExecutor.java"),
  },
  {
    templateRelativePath: path.join("rewarded", "RewardedAdCallbackAndListeners.kt"),
    pluginRelativePath: path.join("rewarded", "RewardedAdCallbackAndListeners.kt"),
  },
];

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
  let patchedCount = 0;

  for (const target of patchTargets) {
    const templatePath = path.join(
      __dirname,
      "templates",
      "capacitor-admob",
      target.templateRelativePath,
    );
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Missing template: ${templatePath}`);
    }

    const template = fs.readFileSync(templatePath, "utf8");
    const directInstallPath = path.join(
      workspaceRoot,
      pluginRootRelativePath,
      target.pluginRelativePath,
    );
    if (patchIfPresent(directInstallPath, template)) {
      patchedCount += 1;
    }

    if (!fs.existsSync(pnpmStorePath)) {
      continue;
    }

    for (const entry of fs.readdirSync(pnpmStorePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("@capacitor-community+admob@")) {
        continue;
      }

      const candidate = path.join(
        pnpmStorePath,
        entry.name,
        pluginRootRelativePath,
        target.pluginRelativePath,
      );
      if (patchIfPresent(candidate, template)) {
        patchedCount += 1;
      }
    }
  }

  const message =
    patchedCount > 0
      ? `[patch-capacitor-admob] patched ${patchedCount} file(s)`
      : "[patch-capacitor-admob] no changes needed";
  console.log(message);
}

main();
