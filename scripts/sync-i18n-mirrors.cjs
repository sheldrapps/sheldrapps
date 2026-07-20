const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const appsRoot = path.join(repoRoot, "apps");
const knownMirrorSuffixes = [
  path.join("public", "assets", "i18n"),
  path.join("www", "assets", "i18n"),
  path.join("android", "app", "src", "main", "assets", "public", "assets", "i18n"),
];

function parseArgs(argv) {
  const options = {
    appNames: new Set(),
    checkOnly: false,
  };

  for (const arg of argv) {
    if (arg === "--check") {
      options.checkOnly = true;
      continue;
    }

    if (arg.startsWith("--app=")) {
      for (const value of arg.slice("--app=".length).split(",")) {
        const appName = value.trim();
        if (appName) {
          options.appNames.add(appName);
        }
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function collectAppRoots(filterAppNames) {
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => filterAppNames.size === 0 || filterAppNames.has(name))
    .sort()
    .map((name) => path.join(appsRoot, name));
}

function collectLocaleFiles(srcDir) {
  return fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

function collectMirrorDirs(appRoot) {
  return knownMirrorSuffixes
    .map((suffix) => path.join(appRoot, suffix))
    .filter((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
}

function syncMirrorFile(srcPath, destPath, checkOnly) {
  const srcContent = readUtf8(srcPath);

  if (!fs.existsSync(destPath)) {
    if (checkOnly) {
      return {
        changed: true,
        reason: "missing",
      };
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, srcContent, "utf8");
    return {
      changed: true,
      reason: "created",
    };
  }

  const destContent = readUtf8(destPath);
  if (destContent === srcContent) {
    return {
      changed: false,
      reason: "same",
    };
  }

  if (!checkOnly) {
    fs.writeFileSync(destPath, srcContent, "utf8");
  }

  return {
    changed: true,
    reason: "updated",
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const appRoots = collectAppRoots(options.appNames);
  const driftIssues = [];
  let syncCount = 0;

  for (const appRoot of appRoots) {
    const srcDir = path.join(appRoot, "src", "assets", "i18n");
    if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
      continue;
    }

    const mirrorDirs = collectMirrorDirs(appRoot);
    if (mirrorDirs.length === 0) {
      continue;
    }

    const localeFiles = collectLocaleFiles(srcDir);
    for (const localeFile of localeFiles) {
      const srcPath = path.join(srcDir, localeFile);

      for (const mirrorDir of mirrorDirs) {
        const destPath = path.join(mirrorDir, localeFile);
        const result = syncMirrorFile(srcPath, destPath, options.checkOnly);
        if (!result.changed) {
          continue;
        }

        const relativeDest = normalizePath(path.relative(repoRoot, destPath));
        if (options.checkOnly) {
          driftIssues.push(`${relativeDest} (${result.reason})`);
          continue;
        }

        syncCount += 1;
        console.log(`synced ${relativeDest}`);
      }
    }
  }

  if (options.checkOnly && driftIssues.length > 0) {
    console.error("i18n mirror drift detected:");
    for (const issue of driftIssues) {
      console.error(`- ${issue}`);
    }
    console.error("Run: pnpm sync:i18n");
    process.exitCode = 1;
    return;
  }

  if (options.checkOnly) {
    console.log("i18n mirrors in sync");
    return;
  }

  console.log(`i18n mirrors synced: ${syncCount}`);
}

main();
