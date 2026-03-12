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

test("guardrail: settings tab is third tab where app has 3+ tabs", () => {
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

    const third = matches[2];
    if (third !== "settings") {
      nonCompliant.push(`${file} (third tab: ${third})`);
    }
  }

  assert.deepEqual(
    nonCompliant,
    [],
    `Third tab must be "settings" for 3+ tabs:\n${nonCompliant.join("\n")}`
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

test("guardrail: discovery note exists with concrete repo paths", () => {
  const note =
    "docs/pr-notes/2026-03-05-discovery-monorepo-guardrails.md";
  const content = readFileSync(note, "utf8");
  assert.match(content, /packages\/settings-kit/);
  assert.match(content, /apps\/epub-cover-changer\/src\/main\.ts/);
  assert.match(content, /config\.json/);
});
