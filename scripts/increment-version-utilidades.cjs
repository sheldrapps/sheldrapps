#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const repoRoot = process.cwd();
const ALIASES = {
  ccfk: 'cover-creator-for-kindle',
  ecc: 'epub-cover-changer',
  jos: 'just-one-step',
  ef: 'epub-fixer',
  pn: 'presupuesto-ninos',
};

const NOTE_LOCALES = [
  'en-US',
  'de-DE',
  'es-419',
  'fr-FR',
  'it-IT',
  'pt-BR',
];
const ZERO_HASH = '0000000000000000000000000000000000000000';
const VERSION_NOTES_FALLBACK = {
  'en-US': 'Maintenance release with internal quality improvements.',
  'de-DE': 'Wartungsrelease mit internen Qualit\u00e4tsverbesserungen.',
  'es-419': 'Lanzamiento de mantenimiento con mejoras internas de calidad.',
  'fr-FR': 'Mise \u00e0 jour de maintenance avec am\u00e9liorations internes de qualit\u00e9.',
  'it-IT': 'Versione di manutenzione con miglioramenti interni alla qualit\u00e0.',
  'pt-BR': 'Vers\u00e3o de manuten\u00e7\u00e3o com melhorias internas de qualidade.',
};

const CAPABILITY_RULES = [
  {
    id: 'brightness',
    pattern: /brightness/i,
    title: 'Ajuste de brillo',
    benefit: 'Mejora portadas oscuras o planas para lectura en e-ink.',
  },
  {
    id: 'contrast',
    pattern: /contrast/i,
    title: 'Ajuste de contraste',
    benefit: 'Mejora separacion de tonos y legibilidad.',
  },
  {
    id: 'sharpness',
    pattern: /sharp|unsharp|clarity/i,
    title: 'Ajuste de nitidez',
    benefit: 'Reduce sensacion de imagen borrosa en miniatura.',
  },
  {
    id: 'grayscale',
    pattern: /grayscale|black.?and.?white|monochrome/i,
    title: 'Modo blanco y negro',
    benefit: 'Simula salida monocromatica para lectores e-ink.',
  },
  {
    id: 'artifact',
    pattern: /artifact|noise|denoise|dither/i,
    title: 'Reduccion de artefactos',
    benefit: 'Disminuye ruido visual y mejora limpieza de bordes.',
  },
  {
    id: 'quality',
    pattern: /quality|jpeg|compression|export/i,
    title: 'Control de calidad de exportacion',
    benefit: 'Balancea peso y calidad segun el uso final.',
  },
  {
    id: 'preview',
    pattern: /preview|simulate|reader|device/i,
    title: 'Previsualizacion en lector',
    benefit: 'Permite ver resultado aproximado antes de exportar.',
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function exec(command) {
  return execSync(command, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function execSafe(command) {
  try {
    return exec(command);
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const parsed = {
    target: '',
    dryRun: false,
    versionName: '',
    keepVersionName: false,
    printNotes: false,
    refreshDocs: false,
    onlyBump: false,
    onlyUtility: false,
    onlyNotes: false,
    collectOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!parsed.target && !token.startsWith('--')) {
      parsed.target = token;
      continue;
    }

    if (token === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (token === '--keep-version-name') {
      parsed.keepVersionName = true;
      continue;
    }

    if (token === '--print-notes') {
      parsed.printNotes = true;
      continue;
    }

    if (token === '--refresh-docs') {
      parsed.refreshDocs = true;
      continue;
    }
    if (token === '--only-bump') {
      parsed.onlyBump = true;
      continue;
    }
    if (token === '--only-utility') {
      parsed.onlyUtility = true;
      continue;
    }
    if (token === '--only-notes') {
      parsed.onlyNotes = true;
      continue;
    }
    if (token === '--collect-only') {
      parsed.collectOnly = true;
      continue;
    }

    if (token.startsWith('--version-name=')) {
      parsed.versionName = token.slice('--version-name='.length);
      continue;
    }

    if (token === '--version-name') {
      parsed.versionName = argv[index + 1] || '';
      index += 1;
    }
  }

  return parsed;
}

function resolveProject(target) {
  const normalized = (target || '').trim().toLowerCase();
  if (!normalized) {
    fail('Uso: pnpm increment:version <ccfk|ecc|jos|ef|pn|app-name> [--version-name "..."] [--keep-version-name] [--dry-run] [--refresh-docs]');
  }

  if (ALIASES[normalized]) {
    return { shortName: normalized, project: ALIASES[normalized] };
  }

  const appPath = path.join(repoRoot, 'apps', normalized);
  if (fs.existsSync(appPath)) {
    return {
      shortName: normalized.split('-').map((part) => part[0]).join(''),
      project: normalized,
    };
  }

  fail(`Proyecto no reconocido: ${target}`);
}

function readFileUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFileUtf8(filePath, content, dryRun) {
  if (dryRun) return;
  fs.writeFileSync(filePath, content, 'utf8');
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readJsonFileSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = readFileUtf8(filePath).replace(/^\uFEFF/, '');
  return parseJsonSafe(raw);
}

function readJsonFromHead(relativePath) {
  const raw = execSafe(`git show HEAD:${relativePath}`);
  if (!raw) return null;
  return parseJsonSafe(raw);
}

function readTextFromHead(relativePath) {
  return execSafe(`git show HEAD:${relativePath}`);
}

function readBuildGradle(buildGradlePath) {
  const content = readFileUtf8(buildGradlePath);
  const codeMatch = content.match(/versionCode\s+(\d+)/);
  const nameMatch = content.match(/versionName\s+"([^"]*)"/);

  if (!codeMatch || !nameMatch) {
    fail(`No se pudo leer versionCode/versionName en ${buildGradlePath}`);
  }

  const lines = content.split(/\r?\n/);
  const codeLine = lines.findIndex((line) => /^\s*versionCode\s+\d+\s*$/.test(line));
  if (codeLine === -1) {
    fail(`No se encontro linea versionCode en ${buildGradlePath}`);
  }

  return {
    content,
    line: codeLine + 1,
    versionCode: Number(codeMatch[1]),
    versionName: nameMatch[1],
  };
}

function applyBuildGradleVersion(content, newVersionCode, newVersionName) {
  return content
    .replace(/(versionCode\s+)\d+/, `$1${newVersionCode}`)
    .replace(/(versionName\s+")([^"]*)(")/, `$1${newVersionName}$3`);
}

function getHeadCommit() {
  return execSafe('git rev-parse HEAD');
}

function getVersionCodeAnchorCommit(buildGradleRelativePath, lineNumber) {
  const blame = execSafe(`git blame -L ${lineNumber},${lineNumber} --porcelain -- ${buildGradleRelativePath}`);
  const firstLine = blame.split(/\r?\n/)[0] || '';
  const hashMatch = firstLine.match(/^([0-9a-f]{40})\s/);
  if (hashMatch && hashMatch[1] !== ZERO_HASH) return hashMatch[1];
  return execSafe(`git log -n 1 --pretty=format:%H -- ${buildGradleRelativePath}`);
}

function parsePorcelainPath(line) {
  const match = line.match(/^..\s+(.+)$/);
  const raw = match ? match[1].trim() : line.trim();
  const parts = raw.split(' -> ');
  return parts[parts.length - 1].trim();
}

function getScopedStatusLines(project) {
  const out = execSafe(`git status --porcelain -- apps/${project} packages`);
  return out.split(/\r?\n/).filter(Boolean);
}

function getWorkingTreeFingerprint(project) {
  const status = getScopedStatusLines(project).join('\n');
  return crypto.createHash('sha1').update(status).digest('hex');
}

function collectDeltaFiles(project, fromCommit, toCommit) {
  const commitFiles = fromCommit && toCommit
    ? execSafe(`git diff --name-only ${fromCommit}..${toCommit} -- apps/${project} packages`)
        .split(/\r?\n/)
        .filter(Boolean)
    : [];

  const localFiles = getScopedStatusLines(project)
    .map(parsePorcelainPath)
    .filter(Boolean);

  return Array.from(new Set([...commitFiles, ...localFiles]));
}

function collectProjectFiles(projectPath) {
  const appRoot = path.join(projectPath, 'src', 'app');
  if (!fs.existsSync(appRoot)) return [];

  const stack = [appRoot];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile()) files.push(fullPath);
    }
  }

  return files;
}

function isPreferredEvidenceFile(relativePath) {
  if (/\.spec\.[jt]s$/i.test(relativePath)) return false;
  if (/\.test\.[jt]s$/i.test(relativePath)) return false;
  if (/\/app\.component\.ts$/i.test(relativePath)) return false;
  return true;
}

function scoreEvidencePath(relativePath) {
  let score = 0;
  if (/\/pages\/create\//i.test(relativePath)) score += 8;
  if (/\/services\//i.test(relativePath)) score += 6;
  if (/\/components\//i.test(relativePath)) score += 4;
  if (/\/settings\//i.test(relativePath)) score += 3;
  if (/\.html$/i.test(relativePath)) score += 1;
  if (/\.spec\.[jt]s$/i.test(relativePath)) score -= 10;
  if (/\.test\.[jt]s$/i.test(relativePath)) score -= 10;
  if (/\/app\.component\.ts$/i.test(relativePath)) score -= 6;
  return score;
}

function detectCapabilities(projectPath) {
  const files = collectProjectFiles(projectPath);
  const detected = [];

  for (const rule of CAPABILITY_RULES) {
    const candidates = [];

    for (const filePath of files) {
      const content = readFileUtf8(filePath);
      if (rule.pattern.test(content)) {
        const relative = path.relative(repoRoot, filePath).replace(/\\/g, '/');
        candidates.push(relative);
      }
    }

    const preferred = candidates.filter(isPreferredEvidenceFile);
    const source = preferred.length > 0 ? preferred : candidates;
    if (source.length === 0) continue;
    source.sort((a, b) => scoreEvidencePath(b) - scoreEvidencePath(a));
    const hit = source[0];

    detected.push({
      id: rule.id,
      title: rule.title,
      benefit: rule.benefit,
      evidence: hit,
    });
  }

  return detected;
}

function summarizeDeltaTag(deltaFiles, capabilities, releaseInsightKeys, nextCode) {
  const fileText = deltaFiles.join(' ').toLowerCase();
  const capText = capabilities.map((cap) => cap.id).join(' ');
  const insightText = releaseInsightKeys.join(' ').toLowerCase();
  const joined = `${fileText} ${capText} ${insightText}`;

  const tags = [
    { pattern: /app_name_localization|translations_refined|i18n|locale|strings/, value: 'Localization' },
    { pattern: /preview|reader|device/, value: 'Preview' },
    { pattern: /export|jpeg|quality/, value: 'Export' },
    { pattern: /pipeline|image|sharp|artifact|dither/, value: 'Image' },
    { pattern: /settings|schema/, value: 'Settings' },
    { pattern: /ads?|admob/, value: 'Monetization' },
  ];

  for (const tag of tags) {
    if (tag.pattern.test(joined)) {
      return `v${nextCode} ${tag.value}`;
    }
  }

  return `Release ${nextCode}`;
}

function buildVersionName(currentVersionName, deltaFiles, capabilities, releaseInsights, nextCode, explicit, keep) {
  if (explicit) return explicit.trim();
  if (keep) return currentVersionName;
  return summarizeDeltaTag(deltaFiles, capabilities, releaseInsights, nextCode);
}

function loadJson(filePath) {
  return readJsonFileSafe(filePath);
}

function ensureDir(dirPath, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(dirPath, { recursive: true });
}

function getI18nLocales(projectPath) {
  const i18nPath = path.join(projectPath, 'src', 'assets', 'i18n');
  if (!fs.existsSync(i18nPath)) return [];
  return fs.readdirSync(i18nPath)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}

function parseAndroidStringMap(xml) {
  const map = {};
  if (!xml) return map;
  const regex = /<string\s+name="([^"]+)">([\s\S]*?)<\/string>/g;
  let match = regex.exec(xml);
  while (match) {
    const key = match[1];
    const value = match[2].trim();
    map[key] = value;
    match = regex.exec(xml);
  }
  return map;
}

function detectI18nTitleChanges(project, deltaFiles) {
  const changes = [];
  const regex = new RegExp(`^apps/${project}/src/assets/i18n/([^/]+)\\.json$`, 'i');

  for (const relativePath of deltaFiles) {
    const hit = relativePath.match(regex);
    if (!hit) continue;

    const locale = hit[1];
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) continue;

    const current = readJsonFileSafe(absolutePath);
    const previous = readJsonFromHead(relativePath);
    const currentTitle = current && current.APP ? current.APP.TITLE : null;
    const previousTitle = previous && previous.APP ? previous.APP.TITLE : null;

    if (!currentTitle || !previousTitle) continue;
    if (currentTitle === previousTitle) continue;

    changes.push({
      locale,
      from: previousTitle,
      to: currentTitle,
    });
  }

  return changes;
}

function detectAndroidAppNameChanges(project, deltaFiles) {
  const relativePath = `apps/${project}/android/app/src/main/res/values/strings.xml`;
  if (!deltaFiles.includes(relativePath) && !deltaFiles.includes(`M ${relativePath}`)) {
    return [];
  }

  const currentPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(currentPath)) return [];

  const currentMap = parseAndroidStringMap(readFileUtf8(currentPath));
  const previousMap = parseAndroidStringMap(readTextFromHead(relativePath));
  const keys = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);
  const changes = [];

  for (const key of keys) {
    if (key !== 'app_name' && !key.startsWith('app_name_')) continue;
    const current = currentMap[key] || '';
    const previous = previousMap[key] || '';
    if (!current || !previous || current === previous) continue;
    changes.push({ key, from: previous, to: current });
  }

  return changes;
}

function detectReleaseInsights(project, deltaFiles, capabilities) {
  const titleChanges = detectI18nTitleChanges(project, deltaFiles);
  const appNameChanges = detectAndroidAppNameChanges(project, deltaFiles);
  const i18nFilesChanged = deltaFiles.filter((filePath) =>
    filePath.startsWith(`apps/${project}/src/assets/i18n/`) && filePath.endsWith('.json'),
  );

  const insights = [];
  if (titleChanges.length > 0 || appNameChanges.length > 0) {
    insights.push({
      key: 'app_name_localization',
      locales: titleChanges.map((item) => item.locale),
      androidNameKeys: appNameChanges.map((item) => item.key),
      count: Math.max(titleChanges.length, appNameChanges.length),
    });
  }

  if (i18nFilesChanged.length > 0) {
    insights.push({
      key: 'translations_refined',
      count: i18nFilesChanged.length,
    });
  }

  const capIds = capabilities.map((item) => item.id);
  if (capIds.includes('preview')) {
    insights.push({ key: 'preview_flow_available' });
  }
  if (capIds.includes('quality') || capIds.includes('artifact')) {
    insights.push({ key: 'image_optimization_available' });
  }

  return {
    insights,
    titleChanges,
    appNameChanges,
  };
}

function buildLocaleNotes(locale, releaseInsights) {
  const primaryCount = releaseInsights.titleChanges.length || releaseInsights.appNameChanges.length;
  const hasNaming = primaryCount > 0;
  const hasTranslations = releaseInsights.insights.some((item) => item.key === 'translations_refined');

  const dict = {
    'en-US': {
      naming: `Updated app name localization across ${primaryCount} languages for clearer store listings.`,
      translations: 'Refined translated labels for a more consistent in-app experience.',
      fallback: VERSION_NOTES_FALLBACK['en-US'],
    },
    'de-DE': {
      naming: `Die Lokalisierung des App-Namens wurde in ${primaryCount} Sprachen aktualisiert, damit der Store-Eintrag klarer ist.`,
      translations: '\u00dcbersetzte Bezeichnungen wurden f\u00fcr eine konsistentere App-Erfahrung verbessert.',
      fallback: VERSION_NOTES_FALLBACK['de-DE'],
    },
    'es-419': {
      naming: `Se actualiz\u00f3 el nombre de la app en ${primaryCount} idiomas para una ficha m\u00e1s clara en tienda.`,
      translations: 'Se ajustaron textos traducidos para una experiencia m\u00e1s consistente en la app.',
      fallback: VERSION_NOTES_FALLBACK['es-419'],
    },
    'fr-FR': {
      naming: `La localisation du nom de l\'application a \u00e9t\u00e9 mise \u00e0 jour dans ${primaryCount} langues pour une fiche plus claire.`,
      translations: 'Des libell\u00e9s traduits ont \u00e9t\u00e9 ajust\u00e9s pour une exp\u00e9rience plus coh\u00e9rente dans l\'application.',
      fallback: VERSION_NOTES_FALLBACK['fr-FR'],
    },
    'it-IT': {
      naming: `La localizzazione del nome dell\'app \u00e8 stata aggiornata in ${primaryCount} lingue per una scheda store pi\u00f9 chiara.`,
      translations: 'Sono state migliorate le etichette tradotte per un\'esperienza pi\u00f9 coerente nell\'app.',
      fallback: VERSION_NOTES_FALLBACK['it-IT'],
    },
    'pt-BR': {
      naming: `A localiza\u00e7\u00e3o do nome do app foi atualizada em ${primaryCount} idiomas para uma ficha mais clara na loja.`,
      translations: 'Textos traduzidos foram ajustados para uma experi\u00eancia mais consistente no app.',
      fallback: VERSION_NOTES_FALLBACK['pt-BR'],
    },
  };

  const source = dict[locale] || dict['en-US'];
  const lines = [];
  if (hasNaming) lines.push(source.naming);
  if (hasTranslations) lines.push(source.translations);
  if (lines.length === 0) lines.push(source.fallback);
  return lines.join('\n');
}

function getCatalogStats(projectPath) {
  const catalogPath = path.join(projectPath, 'src', 'assets', 'data', 'kindle-model-groups.json');
  if (!fs.existsSync(catalogPath)) {
    return { brands: 0, groups: 0, models: 0, maxWidth: 0, maxHeight: 0 };
  }

  const groups = parseJsonSafe(readFileUtf8(catalogPath));
  if (!Array.isArray(groups)) {
    return { brands: 0, groups: 0, models: 0, maxWidth: 0, maxHeight: 0 };
  }

  const brandSet = new Set();
  let models = 0;
  let maxWidth = 0;
  let maxHeight = 0;

  for (const group of groups) {
    if (group && typeof group.brandId === 'string') brandSet.add(group.brandId);
    const items = Array.isArray(group?.items) ? group.items : [];
    models += items.length;
    for (const item of items) {
      const width = Number(item?.width || 0);
      const height = Number(item?.height || 0);
      if (width > maxWidth) maxWidth = width;
      if (height > maxHeight) maxHeight = height;
    }
  }

  return {
    brands: brandSet.size,
    groups: groups.length,
    models,
    maxWidth,
    maxHeight,
  };
}

function buildCcfkCapabilities(projectPath) {
  const stats = getCatalogStats(projectPath);
  return [
    {
      capability: 'Catalogo multi-dispositivo con resolucion real',
      userValue: `Permite crear portadas para multiples familias de e-reader sin ajuste manual. Actualmente: ${stats.brands} marcas, ${stats.groups} grupos y ${stats.models} modelos.`,
      evidence: 'apps/cover-creator-for-kindle/src/assets/data/kindle-model-groups.json',
    },
    {
      capability: 'Seleccion inteligente de modelo y fallback seguro',
      userValue: 'Resuelve modelo/brand por defecto y evita selecciones invalidas.',
      evidence: 'apps/cover-creator-for-kindle/src/app/services/kindle-catalog.service.ts',
    },
    {
      capability: 'Validacion fuerte de imagen de entrada',
      userValue: 'Detecta tipo no soportado, tamano fuera de limite y archivos corruptos antes de exportar.',
      evidence: 'apps/cover-creator-for-kindle/src/app/services/image-pipeline.service.ts',
    },
    {
      capability: 'Previsualizacion antes de guardar/compartir',
      userValue: 'Permite validar el resultado final de portada sin salir del flujo de edicion.',
      evidence: 'apps/cover-creator-for-kindle/src/app/pages/create/create.page.ts',
    },
    {
      capability: 'Reduccion de artefactos y metadatos de dithering',
      userValue: 'Mejora legibilidad en pantallas e-ink y conserva informacion de procesamiento por portada.',
      evidence: 'apps/cover-creator-for-kindle/src/app/services/file.service.ts',
    },
    {
      capability: 'Calidad de exportacion configurable',
      userValue: 'Balancea calidad visual y tamano de archivo segun preferencia del usuario.',
      evidence: 'apps/cover-creator-for-kindle/src/app/settings/ccfk-settings.schema.ts',
    },
    {
      capability: 'Guardado y compartido de EPUB generado',
      userValue: 'Permite flujo completo desde edicion hasta envio a app/servicio de lectura.',
      evidence: 'apps/cover-creator-for-kindle/src/app/services/file.service.ts',
    },
    {
      capability: 'Persistencia de preferencias y hints de onboarding',
      userValue: 'Recuerda modelo y opciones de exportacion para reducir friccion en usos repetidos.',
      evidence: 'apps/cover-creator-for-kindle/src/app/settings/ccfk-settings.schema.ts',
    },
  ];
}

function buildUtilityMarkdown(context) {
  const lines = [];
  const ccfkCaps = context.shortName === 'ccfk' ? buildCcfkCapabilities(context.projectPath) : [];

  lines.push(`# ${context.shortName.toUpperCase()} utility`);
  lines.push('');
  lines.push('## Project');
  lines.push(`- app: ${context.project}`);
  lines.push(`- alias: ${context.shortName}`);
  lines.push(`- versionCode: ${context.currentVersionCode} -> ${context.newVersionCode}`);
  lines.push(`- versionName: "${context.currentVersionName}" -> "${context.newVersionName}"`);
  lines.push('');
  lines.push('## Product goal');
  lines.push('- Convert images into e-reader covers with model-safe output.');
  lines.push('- Reduce incompatibility issues across device models and resolutions.');
  lines.push('- Keep a short flow: choose model, adjust, preview, export, share.');
  lines.push('');
  lines.push('## Verified capabilities from code');

  if (ccfkCaps.length > 0) {
    for (const item of ccfkCaps) {
      lines.push(`- ${item.capability}`);
      lines.push(`  - user-value: ${item.userValue}`);
      lines.push(`  - evidence: ${item.evidence}`);
    }
  } else if (context.capabilities.length > 0) {
    for (const cap of context.capabilities) {
      lines.push(`- ${cap.title}`);
      lines.push(`  - user-value: ${cap.benefit}`);
      lines.push(`  - evidence: ${cap.evidence}`);
    }
  } else {
    lines.push('- No capabilities auto-detected; manual review required.');
  }

  lines.push('');
  lines.push('## Play Store ficha inputs');
  lines.push('- Main value: cover creation optimized by e-reader model.');
  lines.push('- Secondary value: preview and quality control before export.');
  lines.push('- Differentiator: artifact reduction focused on e-ink output.');
  if (context.releaseInsights.titleChanges.length > 0) {
    lines.push(`- Release highlight: app rename/localization in ${context.releaseInsights.titleChanges.length} locales.`);
  }

  lines.push('');
  lines.push('## Legit additional use cases');
  if (context.shortName === 'ccfk') {
    lines.push('- Generate personal placeholders for books read in physical format.');
    lines.push('- Build uniform thumbnails by collection, saga, or author.');
    lines.push('- Prepare high-contrast variants for readability.');
  } else {
    lines.push('- Reuse the main flow for adjacent user scenarios.');
  }

  lines.push('');
  lines.push('## User-facing changes in this increment');
  if (context.releaseInsights.titleChanges.length > 0) {
    const locales = context.releaseInsights.titleChanges.map((item) => item.locale).sort();
    lines.push(`- APP.TITLE updated locales (${locales.length}): ${locales.join(', ')}`);
  } else {
    lines.push('- No APP.TITLE locale changes detected against HEAD.');
  }
  if (context.releaseInsights.appNameChanges.length > 0) {
    const keys = context.releaseInsights.appNameChanges.map((item) => item.key).sort();
    lines.push(`- Android app_name keys updated (${keys.length}): ${keys.join(', ')}`);
  }

  lines.push('');
  lines.push('## Increment scope');
  lines.push(`- deltaFrom: ${context.deltaFrom}`);
  lines.push(`- deltaTo: ${context.head}`);
  lines.push(`- changedFiles: ${context.deltaFiles.length}`);
  for (const filePath of context.deltaFiles) {
    lines.push(`- ${filePath}`);
  }
  if (context.deltaFiles.length === 0) {
    lines.push('- No changed files in apps/packages for this cut.');
  }

  lines.push('');
  lines.push('## Locales detected in app');
  lines.push(`- count: ${context.locales.length}`);
  if (context.locales.length > 0) {
    lines.push(`- ${context.locales.join(', ')}`);
  }

  lines.push('');
  lines.push('## Tracking');
  lines.push(`- versionCodeAnchorCommit: ${context.versionCodeAnchorCommit || 'N/A'}`);
  lines.push(`- generatedAt: ${context.generatedAt}`);

  return `${lines.join('\n')}\n`;
}

function buildState(existingState, context) {
  const baseline = existingState && existingState.baseline
    ? existingState.baseline
    : {
        createdAt: context.generatedAt,
        anchorCommit: context.versionCodeAnchorCommit || context.head,
        versionCode: context.newVersionCode,
        versionName: context.newVersionName,
      };

  return {
    project: context.project,
    shortName: context.shortName,
    baseline,
    current: {
      updatedAt: context.generatedAt,
      head: context.head,
      versionCode: context.newVersionCode,
      versionName: context.newVersionName,
      versionCodeAnchorCommit: context.versionCodeAnchorCommit || context.head,
      deltaFrom: context.deltaFrom,
      deltaTo: context.head,
      changedFilesCount: context.deltaFiles.length,
      userFacingSummary: context.releaseInsights.insights.map((item) => item.key),
    },
    tracking: {
      lastProcessedHead: context.head,
      lastProcessedAt: context.generatedAt,
      lastWorkingTreeFingerprint: context.workingTreeFingerprint,
    },
  };
}

function buildDeltaDocument(context) {
  return {
    project: context.project,
    shortName: context.shortName,
    generatedAt: context.generatedAt,
    head: context.head,
    versionCodeAnchorCommit: context.versionCodeAnchorCommit || context.head,
    version: {
      currentCode: context.currentVersionCode,
      currentName: context.currentVersionName,
      proposedCode: context.newVersionCode,
      proposedName: context.newVersionName,
    },
    delta: {
      mode: context.isFirstRun ? 'snapshot-first-run' : 'incremental',
      from: context.deltaFrom,
      to: context.head,
      changedFilesCount: context.deltaFiles.length,
      changedFiles: context.deltaFiles,
    },
    locales: context.locales,
    capabilities: context.capabilities,
    releaseInsights: context.releaseInsights,
  };
}

function buildVersionNotesXml(releaseInsights) {
  return `${NOTE_LOCALES
    .map((locale) => `<${locale}>\n${buildLocaleNotes(locale, releaseInsights)}\n</${locale}>`)
    .join('\n\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const modeFlags = [args.onlyBump, args.onlyUtility, args.onlyNotes, args.collectOnly].filter(Boolean).length;
  if (modeFlags > 1) {
    fail('Usa solo un modo a la vez: --only-bump | --only-utility | --only-notes | --collect-only');
  }
  const { shortName, project } = resolveProject(args.target);

  const projectPath = path.join(repoRoot, 'apps', project);
  const buildGradlePath = path.join(projectPath, 'android', 'app', 'build.gradle');
  if (!fs.existsSync(buildGradlePath)) {
    fail(`No existe ${buildGradlePath}`);
  }

  const build = readBuildGradle(buildGradlePath);
  const head = getHeadCommit();
  const buildGradleRelativePath = path.relative(repoRoot, buildGradlePath).replace(/\\/g, '/');
  const versionCodeAnchorCommit = getVersionCodeAnchorCommit(buildGradleRelativePath, build.line);

  const utilitiesDir = path.join(repoRoot, 'docs', 'utilities', shortName);
  const utilityFile = path.join(utilitiesDir, 'utility.md');
  const stateFile = path.join(utilitiesDir, 'state.json');
  const versionNotesFile = path.join(utilitiesDir, 'version-notes.xml');
  const deltaFile = path.join(utilitiesDir, 'delta.json');
  const existingState = loadJson(stateFile);
  const isFirstRun = !existingState;

  const deltaFrom = (existingState && existingState.tracking && existingState.tracking.lastProcessedHead)
    ? existingState.tracking.lastProcessedHead
    : head;

  const deltaFiles = collectDeltaFiles(project, deltaFrom, head);
  const capabilities = detectCapabilities(projectPath);
  const releaseInsights = detectReleaseInsights(project, deltaFiles, capabilities);
  const shouldBumpVersion = !args.refreshDocs && !args.collectOnly && (args.onlyBump || (!args.onlyUtility && !args.onlyNotes));
  const nextVersionCode = shouldBumpVersion ? (build.versionCode + 1) : build.versionCode;
  const nextVersionName = (!shouldBumpVersion)
    ? build.versionName
    : buildVersionName(
        build.versionName,
        deltaFiles,
        capabilities,
        releaseInsights.insights.map((item) => item.key),
        nextVersionCode,
        args.versionName,
        args.keepVersionName,
      );

  if (!nextVersionName) {
    fail('versionName no puede quedar vacio');
  }
  if (nextVersionName.length > 30) {
    fail(`versionName supera 30 caracteres: "${nextVersionName}" (${nextVersionName.length})`);
  }

  const updatedBuildGradle = applyBuildGradleVersion(build.content, nextVersionCode, nextVersionName);
  const generatedAt = new Date().toISOString();
  const locales = getI18nLocales(projectPath);
  const workingTreeFingerprint = getWorkingTreeFingerprint(project);

  const context = {
    project,
    projectPath,
    shortName,
    currentVersionCode: build.versionCode,
    newVersionCode: nextVersionCode,
    currentVersionName: build.versionName,
    newVersionName: nextVersionName,
    head,
    versionCodeAnchorCommit,
    deltaFrom,
    deltaFiles,
    capabilities,
    releaseInsights,
    locales,
    generatedAt,
    workingTreeFingerprint,
    isFirstRun,
  };

  const utilityContent = buildUtilityMarkdown(context);
  const stateContent = `${JSON.stringify(buildState(existingState, context), null, 2)}\n`;
  const deltaContent = `${JSON.stringify(buildDeltaDocument(context), null, 2)}\n`;
  const notesContent = buildVersionNotesXml(releaseInsights);

  if (!args.dryRun) {
    if (shouldBumpVersion) {
      writeFileUtf8(buildGradlePath, updatedBuildGradle, false);
    }
    ensureDir(utilitiesDir, false);
    writeFileUtf8(deltaFile, deltaContent, false);
    if (!args.onlyBump && !args.onlyNotes && !args.collectOnly) {
      writeFileUtf8(utilityFile, utilityContent, false);
    }
    if (!args.onlyBump && !args.onlyUtility && !args.collectOnly) {
      writeFileUtf8(versionNotesFile, notesContent, false);
    }
    if (!args.collectOnly) {
      writeFileUtf8(stateFile, stateContent, false);
    }
  }

  const output = [
    `project=${project}`,
    `shortName=${shortName}`,
    `versionCode=${build.versionCode}->${nextVersionCode}`,
    `versionName="${build.versionName}"->"${nextVersionName}"`,
    `deltaFrom=${deltaFrom}`,
    `deltaTo=${head}`,
    `buildGradle=${buildGradleRelativePath}`,
    `utility=${path.relative(repoRoot, utilityFile).replace(/\\/g, '/')}`,
    `state=${path.relative(repoRoot, stateFile).replace(/\\/g, '/')}`,
    `versionNotes=${path.relative(repoRoot, versionNotesFile).replace(/\\/g, '/')}`,
    `delta=${path.relative(repoRoot, deltaFile).replace(/\\/g, '/')}`,
    `firstRun=${isFirstRun}`,
    `dryRun=${args.dryRun}`,
    `refreshDocs=${args.refreshDocs}`,
    `mode=${args.collectOnly ? 'collect-only' : args.onlyBump ? 'only-bump' : args.onlyUtility ? 'only-utility' : args.onlyNotes ? 'only-notes' : 'all'}`,
  ].join('\n');

  console.log(output);
  if (args.printNotes) {
    console.log('\n--- version-notes.xml preview ---\n');
    console.log(notesContent);
  }
}

main();

