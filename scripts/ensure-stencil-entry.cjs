const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const pnpmDir = path.join(rootDir, "node_modules", ".pnpm");

const ensureEntry = (dir) => {
  const clientDir = path.join(
    pnpmDir,
    dir,
    "node_modules",
    "@stencil",
    "core",
    "internal",
    "client",
  );
  if (!fs.existsSync(clientDir)) return;
  const entryPath = path.join(clientDir, "__empty.entry.js");
  if (fs.existsSync(entryPath)) return;
  try {
    fs.writeFileSync(entryPath, "export {};\n");
  } catch {
    // ignore write errors
  }
};

if (fs.existsSync(pnpmDir)) {
  const entries = fs.readdirSync(pnpmDir);
  for (const entry of entries) {
    if (entry.startsWith("@stencil+core@")) {
      ensureEntry(entry);
    }
  }
}
