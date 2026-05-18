import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { relative, sep } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function toRepoRelative(path) {
  return relative(repoRoot, path).split(sep).join("/");
}

function collectStrings(value, into = []) {
  if (typeof value === "string") {
    into.push(value);
    return into;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, into);
    }
    return into;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, into);
    }
  }

  return into;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

test("guardrail: locale files have no mojibake and preserve locale diacritics", () => {
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
    const alphaChars = joined.replace(/[^A-Za-zÀ-ÿ]/g, "").length;
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
