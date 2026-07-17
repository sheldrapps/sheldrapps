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
const bannerExecutorRelativePath = path.join(
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
  "banner",
  "BannerExecutor.java",
);
const bannerExecutorSingle = "@SuppressWarnings(\"deprecation\")\npublic class BannerExecutor extends Executor {\n";
const bannerExecutorDuplicate = "@SuppressWarnings(\"deprecation\")\n@SuppressWarnings(\"deprecation\")\npublic class BannerExecutor extends Executor {\n";

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

function patchByReplacement(filePath, find, replace) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const current = fs.readFileSync(filePath, "utf8");
  if (current.includes(replace)) {
    return false;
  }
  if (!current.includes(find)) {
    return false;
  }

  const updated = current.replace(find, replace);
  if (updated === current) {
    return false;
  }

  fs.writeFileSync(filePath, updated, "utf8");
  return true;
}

function patchBannerExecutor(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const current = fs.readFileSync(filePath, "utf8");
  let updated = current;

  if (current.includes(bannerExecutorDuplicate)) {
    updated = current.replace(bannerExecutorDuplicate, bannerExecutorSingle);
  } else if (!current.includes(bannerExecutorSingle) && current.includes("public class BannerExecutor extends Executor {\n")) {
    updated = current.replace("public class BannerExecutor extends Executor {\n", bannerExecutorSingle);
  } else {
    return false;
  }

  if (updated === current) {
    return false;
  }

  fs.writeFileSync(filePath, updated, "utf8");
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

  if (patchBannerExecutor(path.join(workspaceRoot, bannerExecutorRelativePath))) {
    patchedCount += 1;
  }

  if (fs.existsSync(pnpmStorePath)) {
    for (const entry of fs.readdirSync(pnpmStorePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("@capacitor-community+admob@")) {
        continue;
      }

      const candidate = path.join(pnpmStorePath, entry.name, bannerExecutorRelativePath);
      if (patchBannerExecutor(candidate)) {
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
