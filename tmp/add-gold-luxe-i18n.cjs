const fs = require("fs");
const path = require("path");

const roots = [
  "apps/cover-creator-for-kindle/src/assets/i18n",
  "apps/epub-cover-changer/src/assets/i18n",
  "apps/just-one-step/src/assets/i18n",
];

for (const root of roots) {
  const absRoot = path.join(process.cwd(), root);
  const files = fs.readdirSync(absRoot).filter((name) => name.endsWith(".json"));
  for (const file of files) {
    const filePath = path.join(absRoot, file);
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes('"THEME_GOLD_LUXE"')) {
      continue;
    }

    const updated = content.replace(
      /(^\s*"THEME_MINT_FRESH":\s*"[^"]*")\s*,?$/m,
      '$1,\n    "THEME_GOLD_LUXE": "Oro"'
    );

    if (updated !== content) {
      fs.writeFileSync(filePath, updated, "utf8");
    }
  }
}
