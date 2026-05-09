const fs = require('fs');
const path = require('path');

const eccDir = path.join('apps','epub-cover-changer','src','assets','i18n');
const ccfkDir = path.join('apps','cover-creator-for-kindle','src','assets','i18n');

const locales = fs.readdirSync(eccDir).filter((f) => f.endsWith('.json')).sort();

const translations = {};
for (const file of locales) {
  const locale = file.replace('.json', '');
  const eccJson = JSON.parse(fs.readFileSync(path.join(eccDir, file), 'utf8'));
  const exportOptions = eccJson?.CHANGE?.EXPORT_OPTIONS;
  if (!exportOptions) {
    throw new Error(`Missing CHANGE.EXPORT_OPTIONS in ${file}`);
  }
  translations[locale] = {
    CHANGE: { EXPORT_OPTIONS: exportOptions },
    CREATE: { EXPORT_OPTIONS: exportOptions },
  };
}

const outPath = path.join('packages','export-quality-kit','src','lib','translations','export-quality-kit.translations.ts');
const out = [
  'export const EXPORT_QUALITY_KIT_TRANSLATIONS = ' + JSON.stringify(translations, null, 2) + ' as const;',
  ''
].join('\n');
fs.writeFileSync(outPath, out, 'utf8');

const removeExportOptions = (dir, scopeKey) => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const p = path.join(dir, file);
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (json?.[scopeKey]?.EXPORT_OPTIONS) {
      delete json[scopeKey].EXPORT_OPTIONS;
      fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n', 'utf8');
    }
  }
};

removeExportOptions(eccDir, 'CHANGE');
removeExportOptions(ccfkDir, 'CREATE');
