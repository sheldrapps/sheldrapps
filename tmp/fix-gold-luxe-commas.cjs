const fs = require("fs");
const path = require("path");

const roots = [
  "apps/cover-creator-for-kindle/src/assets/i18n",
  "apps/epub-cover-changer/src/assets/i18n",
];

for (const root of roots) {
  const absRoot = path.join(process.cwd(), root);
  const files = fs.readdirSync(absRoot).filter((name) => name.endsWith(".json"));
  for (const file of files) {
    const filePath = path.join(absRoot, file);
    const content = fs.readFileSync(filePath, "utf8");
    const updated = content.replace(
      /"THEME_GOLD_LUXE":\s*"Oro"(\r?\n)/g,
      '"THEME_GOLD_LUXE": "Oro",$1'
    );
    if (updated !== content) {
      fs.writeFileSync(filePath, updated, "utf8");
    }
  }
}
