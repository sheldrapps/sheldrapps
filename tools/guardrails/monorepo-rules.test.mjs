import { existsSync, readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { basename, dirname, sep } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  hasSemanticMojibake,
  hasSuspiciousQuestionMark,
} from "../text-integrity/detect.ts";

const repoRoot = process.cwd();
const I18N_ALLOWLIST_VALUES = new Set([
  "EPUB",
  "PDF",
  "PRO",
  "System",
  "Gold",
  "EPUB Merger & Splitter",
  "E-Reader Cover Creator",
  "EPUB Cover Changer",
  "PDF Cover Maker",
  "EPUB Fixer",
  "container.xml",
  "content.opf",
  "Error",
  "Guide",
  "Instructions",
  "Note",
  "Home",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLocaleCode(value) {
  return /^[a-z]{2,3}(?:-(?:[A-Z]{2}|\d{3}|[A-Z][a-z]{3}))?$/.test(value);
}

function flattenLeafStrings(value, path = [], into = []) {
  if (typeof value === "string") {
    into.push({ path: path.join("."), value });
    return into;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenLeafStrings(item, [...path, String(index)], into);
    });
    return into;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      flattenLeafStrings(item, [...path, key], into);
    }
  }

  return into;
}

function collectStrings(value) {
  return flattenLeafStrings(value).map((entry) => entry.value);
}

function countLetters(value) {
  return Array.from(value).filter((char) => /\p{Letter}/u.test(char)).length;
}


function hasMojibake(raw) {
  return hasSemanticMojibake(raw);
}

function extractObjectLiteralSource(source) {
  const match = source.match(
    /(?:^|\n)\s*(?:export\s+)?const\s+[A-Za-z0-9_]+\s*(?::[^=]+)?=\s*{/m
  );
  if (!match) {
    return null;
  }

  const start = source.indexOf("{", match.index);

  let depth = 0;
  let state = "code";
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "line-comment") {
      if (char === "\n") {
        state = "code";
      }
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }

    if (state === "string") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        state = "code";
      }
      continue;
    }

    if (state === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "`") {
        state = "code";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      state = "line-comment";
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      state = "block-comment";
      index += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      state = "string";
      quote = char;
      continue;
    }

    if (char === "`") {
      state = "template";
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseTranslationSource(source) {
  const objectLiteral = extractObjectLiteralSource(source);
  if (!objectLiteral) {
    throw new Error("Could not find a translation object literal");
  }

  return Function(`"use strict"; return (${objectLiteral});`)();
}

function isAllowlistedTranslation(value, path) {
  return (
    I18N_ALLOWLIST_VALUES.has(value) ||
    /(?:^|\.)(?:FILE|PATH|URL|ID|GUID|UUID|SHA|MD5|PNG|JPG|JPEG|SVG|XML|JSON|OPF|OPDS|ISBN|ISBN10|ISBN13)\b/i.test(
      path
    )
  );
}

function compareLocalizedMaps(file, baseLocale, localizedLocale, baseValue, localizedValue) {
  const baseEntries = flattenLeafStrings(baseValue);
  const localizedEntries = flattenLeafStrings(localizedValue);
  const localizedByPath = new Map(
    localizedEntries.map((entry) => [entry.path, entry.value])
  );
  const basePaths = new Set(baseEntries.map((entry) => entry.path));
  const missing = [];
  const extra = [];
  const untranslated = [];
  const suspiciousQuestionMarks = [];

  for (const entry of baseEntries) {
    if (!localizedByPath.has(entry.path)) {
      missing.push(entry.path);
      continue;
    }

    const localizedString = localizedByPath.get(entry.path);
    if (
      typeof localizedString === "string" &&
      hasSuspiciousQuestionMark(localizedString, entry.value) &&
      !isAllowlistedTranslation(localizedString, entry.path)
    ) {
      suspiciousQuestionMarks.push(`${entry.path}: ${localizedString}`);
    }

    if (
      typeof localizedString === "string" &&
      localizedString === entry.value &&
      !isAllowlistedTranslation(localizedString, entry.path)
    ) {
      untranslated.push(`${entry.path}: ${localizedString}`);
    }
  }

  for (const entry of localizedEntries) {
    if (!basePaths.has(entry.path)) {
      extra.push(entry.path);
    }
  }

  return {
    file,
    baseLocale,
    localizedLocale,
    missing,
    extra,
    untranslated,
    suspiciousQuestionMarks,
  };
}

function collectI18nFiles() {
  const patterns = [
    "apps/**/src/assets/i18n/*.json",
    "apps/**/public/assets/i18n/*.json",
    "packages/**/src/assets/i18n/*.json",
    "packages/**/src/**/i18n/*.ts",
    "packages/**/src/**/*.translations.ts",
  ];

  return patterns
    .flatMap((pattern) =>
      globSync(pattern, { cwd: repoRoot }).map((p) => p.split(sep).join("/"))
    )
    .filter(
      (file) =>
        !file.includes("/editor/") &&
        !file.includes("provide-") &&
        !file.includes("/build/") &&
        !file.includes("/dist/") &&
        !file.includes("/public/assets/i18n/") &&
        !file.includes("/www/assets/i18n/") &&
        !file.includes("/android/app/src/main/assets/public/")
    )
    .sort();
}

function readLocaleData(file) {
  const raw = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  if (file.endsWith(".json")) {
    return { raw, data: JSON.parse(raw) };
  }

  if (
    /\bexport\s+type\b|\btype\s+\w+\s*=|\bfunction\b|=>|\bclass\b|ENVIRONMENT_INITIALIZER|mergeDeep\(|buildLocale\(|applyLocaleCopies\(/.test(
      raw
    )
  ) {
    return { raw, data: null };
  }

  return { raw, data: parseTranslationSource(raw) };
}

function findSiblingBaseLocaleFile(file) {
  const extension = file.endsWith(".json") ? ".json" : ".ts";
  const localeName = basename(file, extension);
  if (localeName === "en-US") {
    return null;
  }

  const sibling = `${dirname(file).split(sep).join("/")}/en-US${extension}`;
  return existsSync(sibling) ? sibling : null;
}

test("guardrail: no new SCSS files in apps outside allowlist", () => {
  const allowlist = JSON.parse(
    readFileSync("tools/guardrails/scss-allowlist.json", "utf8")
  );
  const allowed = new Set(allowlist.allowedAppScssFiles);

  const found = globSync("apps/**/*.scss", { cwd: repoRoot })
    .map((p) => p.split(sep).join("/"))
    .sort();

  const unexpected = found.filter((f) => !allowed.has(f));
  assert.deepEqual(
    unexpected,
    [],
    `Unexpected app SCSS files detected:\n${unexpected.join("\n")}`
  );
});

test("guardrail: settings tab is last tab where app has 3+ tabs", () => {
  const tabsHtmlFiles = globSync("apps/**/tabs.page.html", { cwd: repoRoot })
    .map((p) => p.split(sep).join("/"))
    .sort();

  const nonCompliant = [];
  const notApplicable = [];

  for (const file of tabsHtmlFiles) {
    const html = readFileSync(file, "utf8");
    const matches = [...html.matchAll(/<ion-tab-button\s+tab="([^"]+)"/g)].map(
      (m) => m[1]
    );

    if (matches.length < 3) {
      notApplicable.push(file);
      continue;
    }

    const last = matches[matches.length - 1];
    if (last !== "settings") {
      nonCompliant.push(`${file} (last tab: ${last})`);
    }
  }

  assert.deepEqual(
    nonCompliant,
    [],
    `Last tab must be "settings" for 3+ tabs:\n${nonCompliant.join("\n")}`
  );

  const expectedNotApplicable = new Set([
    "apps/presupuesto-ninos/src/app/pages/tabs/tabs.page.html",
  ]);
  assert.deepEqual(
    new Set(notApplicable),
    expectedNotApplicable,
    `Unexpected tabs files with <3 tabs (review convention):\n${notApplicable.join(
      "\n"
    )}`
  );
});

test("guardrail note: kits-first duplicate UI scan is not automated yet", () => {
  const notePath = "AGENTS.md";
  const content = readFileSync(notePath, "utf8");
  assert.match(
    content,
    /Kits-First Rule/,
    "Root AGENTS.md must include Kits-first rule until duplicate-UI scanner exists"
  );
});

test.skip("guardrail: locale files have no mojibake and preserve locale diacritics", () => {
  const localeFiles = globSync("apps/**/src/assets/i18n/*.json", {
    cwd: repoRoot,
  })
    .map((p) => p.split(sep).join("/"))
    .filter((p) => !p.includes("/editor/"))
    .sort();

  const localeSignature = {
    "de-DE": /[äöüÄÖÜß]/u,
    "es-MX": /[áéíóúñÁÉÍÓÚÑ¿¡]/u,
    "fr-FR": /[àâçéèêëîïôûùüÿœæÀÂÇÉÈÊËÎÏÔÛÙÜŸŒÆ]/u,
    "it-IT": /[àèéìíîòóùÀÈÉÌÍÎÒÓÙ]/u,
    "pt-BR": /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/u,
  };

  const mojibakeIssues = [];
  const signatureIssues = [];

  for (const file of localeFiles) {
    const raw = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const json = JSON.parse(raw);
    const strings = collectStrings(json);

    const hasMojibake = strings.some((s) =>
      /\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC.|\uFFFD/u.test(
        s
      )
    );
    if (hasMojibake) {
      mojibakeIssues.push(file);
    }

    const locale = file.split("/").pop();
    const signature = localeSignature[locale];
    if (!signature) {
      continue;
    }

    const joined = strings.join(" ");
    const alphaChars = countLetters(joined);
    if (alphaChars >= 80 && !signature.test(joined)) {
      signatureIssues.push(file);
    }
  }

  assert.deepEqual(
    mojibakeIssues,
    [],
    `Mojibake detected in locale files:\n${mojibakeIssues.join("\n")}`
  );

  assert.deepEqual(
    signatureIssues,
    [],
    `Likely diacritic stripping detected in locale files:\n${signatureIssues.join(
      "\n"
    )}`
  );
});

test("guardrail: translation tooling uses explicit utf8 and restricts latin1 to repair paths", () => {
  const requiredUtf8Files = [
    "scripts/add-ems-web-entry.cjs",
    "scripts/sync-app-i18n-structure.cjs",
    "scripts/sync-i18n-mirrors.cjs",
    "scripts/update-emas-visible-i18n.cjs",
    "scripts/repair-app-i18n.cjs",
    "scripts/repair-emas-i18n.cjs",
  ];
  const transcodeAllowlist = new Set([
    "scripts/generate-epub-fixer-samples.cjs",
    "scripts/repair-app-i18n.cjs",
    "scripts/repair-emas-i18n.cjs",
    "tools/text-integrity/repair.ts",
  ]);

  for (const file of requiredUtf8Files) {
    const source = readFileSync(file, "utf8");
    assert.match(
      source,
      /["']utf8["']/,
      `${file} must use explicit utf8 for maintained text reads/writes`
    );
  }

  const scopedFiles = [
    ...globSync("scripts/*.cjs", { cwd: repoRoot }).map((p) => p.split(sep).join("/")),
    ...globSync("tools/text-integrity/**/*.{ts,js,mjs,cjs}", { cwd: repoRoot }).map((p) =>
      p.split(sep).join("/")
    ),
  ].sort();

  const offenders = [];
  for (const file of scopedFiles) {
    const source = readFileSync(file, "utf8");
    if (!/latin1|ascii|binary/u.test(source)) {
      continue;
    }

    if (transcodeAllowlist.has(file)) {
      continue;
    }

    if (
      /Buffer\.from\(.+,\s*["']latin1["']\)|toString\(["']latin1["']\)|readFileSync\(.+["']ascii["']|writeFileSync\(.+["']ascii["']/su.test(
        source
      )
    ) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Only controlled repair paths may use latin1/ascii text transcoding:\n${offenders.join("\n")}`
  );
});

test("guardrail: ccfk locale files have no mojibake and preserve locale diacritics", () => {
  const localeFiles = globSync(
    "apps/cover-creator-for-kindle/src/assets/i18n/*.json",
    { cwd: repoRoot }
  )
    .map((p) => p.split(sep).join("/"))
    .sort();

  const localeSignature = {
    "de-DE": /[Ã¤Ã¶Ã¼Ã„Ã–ÃœÃŸ]/u,
    "es-MX": /[Ã¡Ã©Ã­Ã³ÃºÃ±ÃÃ‰ÃÃ“ÃšÃ‘Â¿Â¡]/u,
    "fr-FR": /[Ã Ã¢Ã§Ã©Ã¨ÃªÃ«Ã®Ã¯Ã´Ã»Ã¹Ã¼Ã¿Å“Ã¦Ã€Ã‚Ã‡Ã‰ÃˆÃŠÃ‹ÃŽÃÃ”Ã›Ã™ÃœÅ¸Å’Ã†]/u,
    "it-IT": /[Ã Ã¨Ã©Ã¬Ã­Ã®Ã²Ã³Ã¹Ã€ÃˆÃ‰ÃŒÃÃŽÃ’Ã“Ã™]/u,
    "pt-BR": /[Ã¡Ã Ã¢Ã£Ã©ÃªÃ­Ã³Ã´ÃµÃºÃ§ÃÃ€Ã‚ÃƒÃ‰ÃŠÃÃ“Ã”Ã•ÃšÃ‡]/u,
  };

  const mojibakeIssues = [];
  const signatureIssues = [];

  for (const file of localeFiles) {
    const raw = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const json = JSON.parse(raw);
    const strings = collectStrings(json);

    const hasMojibake = strings.some((s) =>
      /\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2\u20AC.|\uFFFD/u.test(
        s
      )
    );
    if (hasMojibake) {
      mojibakeIssues.push(file);
    }

    const locale = file.split("/").pop();
    const signature = localeSignature[locale];
    if (!signature) {
      continue;
    }

    const joined = strings.join(" ");
    const alphaChars = countLetters(joined);
    if (alphaChars >= 80 && !signature.test(joined)) {
      signatureIssues.push(file);
    }
  }

  assert.deepEqual(
    mojibakeIssues,
    [],
    `Mojibake detected in ccfk locale files:\n${mojibakeIssues.join("\n")}`
  );

  assert.deepEqual(
    signatureIssues,
    [],
    `Likely diacritic stripping detected in ccfk locale files:\n${signatureIssues.join(
      "\n"
    )}`
  );
});

test("guardrail: epub-merger-and-splitter locale assets are utf-8 clean", () => {
  const localeFiles = globSync(
    "apps/epub-merger-and-splitter/src/assets/i18n/*.json",
    { cwd: repoRoot }
  )
    .map((p) => p.split(sep).join("/"))
    .sort();

  const mojibakeIssues = [];
  const untranslatedIssues = [];
  const suspiciousQuestionIssues = [];

  const baseLocaleFile =
    "apps/epub-merger-and-splitter/src/assets/i18n/en-US.json";
  const { data: baseData } = readLocaleData(baseLocaleFile);

  for (const file of localeFiles) {
    const { raw, data } = readLocaleData(file);
    const strings = flattenLeafStrings(data);
    const content = strings.map((entry) => entry.value).join(" ");

    if (hasMojibake(raw) || hasMojibake(content)) {
      mojibakeIssues.push(file);
    }

    if (basename(file, ".json") === "en-US") {
      continue;
    }

    const report = compareLocalizedMaps(
      file,
      "en-US",
      basename(file, ".json"),
      baseData,
      data
    );

    if (report.untranslated.length) {
      untranslatedIssues.push(
        `${file} has ${report.untranslated.length} untranslated entries:\n${report.untranslated
          .slice(0, 8)
          .join("\n")}`
      );
    }

    if (report.suspiciousQuestionMarks.length) {
      suspiciousQuestionIssues.push(
        `${file} has suspicious question-mark replacements:\n${report.suspiciousQuestionMarks
          .slice(0, 8)
          .join("\n")}`
      );
    }
  }

  assert.deepEqual(
    mojibakeIssues,
    [],
    `Mojibake detected in epub-merger-and-splitter locale files:\n${mojibakeIssues.join(
      "\n"
    )}`
  );

  assert.deepEqual(
    untranslatedIssues,
    [],
    `epub-merger-and-splitter locale files still contain untranslated English fallback:\n${untranslatedIssues.join(
      "\n"
    )}`
  );

  assert.deepEqual(
    suspiciousQuestionIssues,
    [],
    `epub-merger-and-splitter locale files contain suspicious question-mark replacements:\n${suspiciousQuestionIssues.join(
      "\n"
    )}`
  );
});

test("guardrail: locale assets stay localized across the monorepo", () => {
  const files = collectI18nFiles();
  const mojibakeIssues = [];
  const structureIssues = [];
  const suspiciousQuestionIssues = [];

  for (const file of files) {
    const { raw, data } = readLocaleData(file);
    const leafStrings = flattenLeafStrings(data);
    const content = leafStrings.map((entry) => entry.value).join(" ");


    if (hasMojibake(content) || hasMojibake(raw)) {
      mojibakeIssues.push(file);
    }

    if (!data) {
      continue;
    }

    const keys = Object.keys(data);
    const hasLocaleMap = keys.some(isLocaleCode);
    const fileLocale = basename(file, file.endsWith(".json") ? ".json" : ".ts");

    if (hasLocaleMap) {
      const baseLocale = data["en-US"];
      if (!baseLocale) {
        structureIssues.push(`${file} (missing en-US base locale)`);
        continue;
      }

      for (const locale of keys.filter(isLocaleCode)) {
        if (locale === "en-US") {
          continue;
        }

        const report = compareLocalizedMaps(
          file,
          "en-US",
          locale,
          baseLocale,
          data[locale]
        );

        if (report.missing.length) {
          structureIssues.push(
            `${file} [${locale}] missing keys: ${report.missing
              .slice(0, 8)
              .join(", ")}`
          );
        }

        if (report.extra.length) {
          structureIssues.push(
            `${file} [${locale}] extra keys: ${report.extra.slice(0, 8).join(", ")}`
          );
        }

        if (report.suspiciousQuestionMarks.length) {
          suspiciousQuestionIssues.push(
            `${file} [${locale}] suspicious question-mark replacements:\n${report.suspiciousQuestionMarks
              .slice(0, 8)
              .join("\n")}`
          );
        }

      }

      continue;
    }

    const siblingBase = findSiblingBaseLocaleFile(file);
    if (!siblingBase || fileLocale === "en-US") {
      continue;
    }

    const { data: baseData } = readLocaleData(siblingBase);
    const report = compareLocalizedMaps(file, "en-US", fileLocale, baseData, data);

    if (report.missing.length) {
      structureIssues.push(
        `${file} missing keys: ${report.missing.slice(0, 8).join(", ")}`
      );
    }

    if (report.extra.length) {
      structureIssues.push(
        `${file} extra keys: ${report.extra.slice(0, 8).join(", ")}`
      );
    }

    if (report.suspiciousQuestionMarks.length) {
      suspiciousQuestionIssues.push(
        `${file} suspicious question-mark replacements:\n${report.suspiciousQuestionMarks
          .slice(0, 8)
          .join("\n")}`
      );
    }

  }
  assert.deepEqual(
    mojibakeIssues,
    [],
    `Mojibake detected in locale assets:\n${mojibakeIssues.join("\n")}`
  );

  assert.deepEqual(
    structureIssues,
    [],
    `Locale structure drift detected:\n${structureIssues.join("\n")}`
  );

  assert.deepEqual(
    suspiciousQuestionIssues,
    [],
    `Suspicious question-mark replacements detected in locale assets:\n${suspiciousQuestionIssues.join(
      "\n"
    )}`
  );
});

test("guardrail: app index.html declares utf-8 charset", () => {
  const indexFiles = globSync("apps/**/src/index.html", { cwd: repoRoot })
    .map((p) => p.split(sep).join("/"))
    .sort();

  const missing = [];
  for (const file of indexFiles) {
    const html = readFileSync(file, "utf8");
    if (!/<meta\s+charset=["']utf-8["']\s*\/?>/i.test(html)) {
      missing.push(file);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `Missing UTF-8 charset declaration in index.html:\n${missing.join("\n")}`
  );
});

test("guardrail: ui-theme palettes expose the full theme token contract", () => {
  const palette = readFileSync(
    "packages/ui-theme/styles/_palette.scss",
    "utf8",
  );
  const themeMixins = [
    "light",
    "dark",
    "warm-reading",
    "pop-rose",
    "nocturne-violet",
    "obsidian-red",
    "terminal-green",
    "mint-fresh",
    "silver-tech",
    "gold-luxe",
  ];
  const semanticTokens = [
    "--app-background",
    "--app-surface",
    "--app-text-primary",
    "--app-text-secondary",
    "--app-divider",
    "--ion-color-primary",
    "--ion-color-primary-rgb",
    "--ion-color-primary-contrast",
    "--ion-color-primary-contrast-rgb",
    "--ion-color-primary-shade",
    "--ion-color-primary-shade-rgb",
    "--ion-color-primary-tint",
    "--ion-color-primary-tint-rgb",
    "--ion-color-secondary",
    "--ion-color-secondary-rgb",
    "--ion-color-secondary-contrast",
    "--ion-color-secondary-contrast-rgb",
    "--ion-color-secondary-shade",
    "--ion-color-secondary-shade-rgb",
    "--ion-color-secondary-tint",
    "--ion-color-secondary-tint-rgb",
    "--ion-color-tertiary",
    "--ion-color-tertiary-rgb",
    "--ion-color-tertiary-contrast",
    "--ion-color-tertiary-contrast-rgb",
    "--ion-color-tertiary-shade",
    "--ion-color-tertiary-shade-rgb",
    "--ion-color-tertiary-tint",
    "--ion-color-tertiary-tint-rgb",
    "--ion-color-success",
    "--ion-color-success-rgb",
    "--ion-color-success-contrast",
    "--ion-color-success-contrast-rgb",
    "--ion-color-success-shade",
    "--ion-color-success-shade-rgb",
    "--ion-color-success-tint",
    "--ion-color-success-tint-rgb",
    "--ion-color-warning",
    "--ion-color-warning-rgb",
    "--ion-color-warning-contrast",
    "--ion-color-warning-contrast-rgb",
    "--ion-color-warning-shade",
    "--ion-color-warning-shade-rgb",
    "--ion-color-warning-tint",
    "--ion-color-warning-tint-rgb",
    "--ion-color-danger",
    "--ion-color-danger-rgb",
    "--ion-color-danger-contrast",
    "--ion-color-danger-contrast-rgb",
    "--ion-color-danger-shade",
    "--ion-color-danger-shade-rgb",
    "--ion-color-danger-tint",
    "--ion-color-danger-tint-rgb",
  ];
  const stepTokens = [
    "--ion-color-step-50",
    "--ion-color-step-50-rgb",
    "--ion-color-step-100",
    "--ion-color-step-100-rgb",
    "--ion-color-step-150",
    "--ion-color-step-150-rgb",
    "--ion-color-step-200",
    "--ion-color-step-200-rgb",
    "--ion-color-step-250",
    "--ion-color-step-250-rgb",
    "--ion-color-step-300",
    "--ion-color-step-300-rgb",
    "--ion-color-step-350",
    "--ion-color-step-350-rgb",
    "--ion-color-step-400",
    "--ion-color-step-400-rgb",
    "--ion-color-step-450",
    "--ion-color-step-450-rgb",
    "--ion-color-step-500",
    "--ion-color-step-500-rgb",
    "--ion-color-step-550",
    "--ion-color-step-550-rgb",
    "--ion-color-step-600",
    "--ion-color-step-600-rgb",
    "--ion-color-step-650",
    "--ion-color-step-650-rgb",
    "--ion-color-step-700",
    "--ion-color-step-700-rgb",
    "--ion-color-step-750",
    "--ion-color-step-750-rgb",
    "--ion-color-step-800",
    "--ion-color-step-800-rgb",
    "--ion-color-step-850",
    "--ion-color-step-850-rgb",
    "--ion-color-step-900",
    "--ion-color-step-900-rgb",
  ];

  for (const theme of themeMixins) {
    const match = palette.match(
      new RegExp(
        `@mixin\\s+palette-${escapeRegExp(theme)}\\s*\\{([\\s\\S]*?)\\n\\}`,
        "m",
      ),
    );
    assert.ok(match, `Missing palette mixin for theme "${theme}"`);

    const body = match[1];
    for (const token of [...semanticTokens, ...stepTokens]) {
      assert.match(
        body,
        new RegExp(`${escapeRegExp(token)}\\s*:`),
        `Theme "${theme}" is missing token "${token}"`,
      );
    }
  }

  const selectors = [
    ":root.theme-light",
    ":root.theme-dark",
    ":root.theme-warm-reading",
    ":root.theme-pop-rose",
    ":root.theme-nocturne-violet",
    ":root.theme-obsidian-red",
    ":root.theme-terminal-green",
    ":root.theme-mint-fresh",
    ":root.theme-silver-tech",
    ":root.theme-gold-luxe",
  ];

  for (const selector of selectors) {
    assert.match(
      palette,
      new RegExp(escapeRegExp(selector)),
      `Missing root selector for "${selector}"`,
    );
  }
});

test("guardrail: ui-theme shared semantic chrome tokens exist", () => {
  const tokens = readFileSync("packages/ui-theme/styles/tokens.scss", "utf8");
  const requiredTokens = [
    "--app-toolbar-background",
    "--app-toolbar-text",
    "--app-toolbar-icon",
    "--app-toolbar-border",
    "--app-tabbar-background",
    "--app-tabbar-border",
    "--app-tabbar-active-background",
    "--app-tabbar-active-color",
    "--app-tabbar-inactive-color",
    "--app-page-title-color",
    "--app-section-title-color",
    "--app-body-text-color",
    "--app-muted-text-color",
    "--app-disabled-text-color",
    "--app-control-background",
    "--app-control-text",
    "--app-control-placeholder",
    "--app-control-disabled-background",
    "--app-control-disabled-text",
    "--app-control-disabled-icon",
    "--app-control-icon",
    "--app-button-primary-background",
    "--app-button-primary-text",
    "--app-button-outline-border",
    "--app-button-outline-text",
    "--app-button-outline-icon",
    "--app-premium-border",
    "--app-premium-text",
    "--app-premium-background",
    "--app-editor-background",
    "--app-editor-surface",
    "--app-editor-toolbar-background",
    "--app-editor-toolbar-text",
    "--app-editor-toolbar-icon",
    "--app-editor-grid-line",
    "--app-editor-preview-border",
    "--app-editor-helper-text",
    "--app-focus-ring",
  ];

  for (const token of requiredTokens) {
    assert.match(
      tokens,
      new RegExp(`${escapeRegExp(token)}\\s*:`),
      `Missing shared semantic token "${token}"`,
    );
  }
});

test("guardrail: discovery note exists with concrete repo paths", () => {
  const note =
    "docs/pr-notes/2026-03-05-discovery-monorepo-guardrails.md";
  const content = readFileSync(note, "utf8");
  assert.match(content, /packages\/settings-kit/);
  assert.match(content, /apps\/epub-cover-changer\/src\/main\.ts/);
  assert.match(content, /config\.json/);
});

test("regression: rating-kit must not eagerly register all locale translations on initialize", () => {
  // Root cause of the i18n bug: calling setTranslation for every locale at startup marked
  // all locales as "already loaded" in ngx-translate, preventing the HTTP loader from
  // fetching the app's own JSON files when the user switched language.
  const source = readFileSync(
    "packages/rating-kit/src/lib/rating.service.ts",
    "utf8",
  );

  // The bad pattern: iterating over ALL RATING_KIT_TRANSLATIONS entries and calling
  // setTranslation for each one inside initialize() or registerTranslations().
  const badPatternAllEntries =
    /for\s*\(.*Object\.entries\(RATING_KIT_TRANSLATIONS\).*\)\s*\{[^}]*setTranslation/s;
  assert.ok(
    !badPatternAllEntries.test(source),
    "rating.service.ts must not iterate over all RATING_KIT_TRANSLATIONS and call setTranslation in bulk. " +
      "This blocks ngx-translate from loading the app's own locale JSON files.",
  );
});

test("regression: rating-kit must register translations only for active locale and on language change", () => {
  // After the fix, registerTranslations() must:
  // 1. Register only the currently active locale (currentLang / defaultLang).
  // 2. Subscribe to onLangChange to register when the user switches language.
  const source = readFileSync(
    "packages/rating-kit/src/lib/rating.service.ts",
    "utf8",
  );

  assert.match(
    source,
    /translate\.currentLang|translate\.defaultLang/,
    "registerTranslations must read the active locale from translateService.currentLang or defaultLang",
  );

  assert.match(
    source,
    /onLangChange/,
    "registerTranslations must subscribe to translateService.onLangChange to handle language switches",
  );
});

test("regression: ECC and CCFK launcher aliases default to system locale on fresh install", () => {
  const manifests = [
    "apps/epub-cover-changer/android/app/src/main/AndroidManifest.xml",
    "apps/cover-creator-for-kindle/android/app/src/main/AndroidManifest.xml",
  ];

  for (const manifestPath of manifests) {
    const manifest = readFileSync(manifestPath, "utf8");
    const aliasBlocks = [...manifest.matchAll(/<activity-alias[\s\S]*?<\/activity-alias>/g)].map(
      (m) => m[0],
    );
    const launcherAliases = aliasBlocks
      .map((block) => {
        const nameMatch = block.match(/android:name="([^"]+)"/);
        const enabledMatch = block.match(/android:enabled="([^"]+)"/);
        return {
          name: nameMatch?.[1] ?? "",
          enabled: enabledMatch?.[1] ?? "",
        };
      })
      .filter((alias) => alias.name.includes(".MainActivityAlias_"));

    const enabledAliases = launcherAliases.filter((alias) => alias.enabled === "true");
    assert.equal(
      enabledAliases.length,
      1,
      `${manifestPath} must have exactly one enabled launcher alias`,
    );
    assert.equal(
      enabledAliases[0]?.name,
      ".MainActivityAlias_system",
      `${manifestPath} must enable .MainActivityAlias_system by default`,
    );

    const enUsAlias = launcherAliases.find(
      (alias) => alias.name === ".MainActivityAlias_en_US",
    );
    assert.ok(
      enUsAlias,
      `${manifestPath} must declare .MainActivityAlias_en_US`,
    );
    assert.equal(
      enUsAlias.enabled,
      "false",
      `${manifestPath} must keep .MainActivityAlias_en_US disabled by default`,
    );
  }
});

test("regression: launcher locale native mapping defaults to system in ECC and CCFK MainActivity", () => {
  const mainActivities = [
    "apps/epub-cover-changer/android/app/src/main/java/com/sheldrapps/epubcoverchanger/MainActivity.java",
    "apps/cover-creator-for-kindle/android/app/src/main/java/com/sheldrapps/covercreatorforkindle/MainActivity.java",
  ];

  for (const activityPath of mainActivities) {
    const source = readFileSync(activityPath, "utf8");
    assert.match(
      source,
      /DEFAULT_ALIAS_LOCALE\s*=\s*"system"/,
      `${activityPath} must default launcher alias locale to "system"`,
    );
    assert.match(
      source,
      /ALL_ALIAS_LOCALES\s*=\s*Arrays\.asList\(\s*"system"/s,
      `${activityPath} must include "system" as first launcher alias locale`,
    );
    assert.match(
      source,
      /if\s*\("system"\.equalsIgnoreCase\(normalized\)\)\s*\{\s*return\s*"system";\s*\}/s,
      `${activityPath} must resolve "system" locale explicitly`,
    );
  }
});

test("regression: language service must not sync launcher alias during startup/init language set", () => {
  const source = readFileSync("packages/i18n-kit/src/lib/language.service.ts", "utf8");
  assert.ok(
    !source.includes("syncLauncherAlias("),
    "LanguageService must not call syncLauncherAlias(); launcher alias switching must remain in explicit restart/change-language flow",
  );
  assert.ok(
    !/from\s+['"]\.\/launcher-alias-sync['"]/.test(source),
    "LanguageService must not import launcher alias sync helper",
  );
});

