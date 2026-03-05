import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { relative, sep } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function toRepoRelative(path) {
  return relative(repoRoot, path).split(sep).join("/");
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

test("guardrail: discovery note exists with concrete repo paths", () => {
  const note =
    "docs/pr-notes/2026-03-05-discovery-monorepo-guardrails.md";
  const content = readFileSync(note, "utf8");
  assert.match(content, /packages\/settings-kit/);
  assert.match(content, /apps\/epub-cover-changer\/src\/main\.ts/);
  assert.match(content, /config\.json/);
});
