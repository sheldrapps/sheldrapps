import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const cliPath = resolve(process.cwd(), "tools", "text-integrity", "cli.ts");
const tmpAppRoot = resolve(process.cwd(), "apps", "__tmp_text_integrity__");
const localeDir = resolve(tmpAppRoot, "src", "assets", "i18n");
const localeFile = resolve(localeDir, "es-MX.json");
const baseLocaleFile = resolve(localeDir, "en-US.json");

function runCli(...args: string[]) {
  return spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function resetTempFile(content: string): void {
  mkdirSync(localeDir, { recursive: true });
  writeFileSync(localeFile, content, "utf8");
}

function resetBaseLocale(content: string): void {
  mkdirSync(localeDir, { recursive: true });
  writeFileSync(baseLocaleFile, content, "utf8");
}

test.after(() => {
  if (existsSync(tmpAppRoot)) {
    rmSync(tmpAppRoot, { recursive: true, force: true });
  }
});

test("normal mode never writes files", () => {
  const original = '{\n  "title": "ConfiguraciÃƒÂ³n"\n}\n';
  resetTempFile(original);

  const result = runCli("--path", "apps/__tmp_text_integrity__");
  const after = readFileSync(localeFile, "utf8");

  assert.equal(result.status, 1);
  assert.equal(after, original);
});

test("fix mode repairs only high-confidence findings and preserves JSON validity", () => {
  resetTempFile('{\n  "title": "ConfiguraciÃƒÂ³n",\n  "ok": "Configuración"\n}\n');

  const result = runCli("--fix", "--path", "apps/__tmp_text_integrity__");
  const after = readFileSync(localeFile, "utf8");

  assert.equal(result.status, 0);
  assert.equal(after.includes("Configuración"), true);
  assert.equal(after.includes("ConfiguraciÃƒÂ³n"), false);
  assert.doesNotThrow(() => JSON.parse(after));
});

test("json output is stable and reports findings", () => {
  resetTempFile('{\n  "title": "Donâ€™t"\n}\n');
  const result = runCli("--path", "apps/__tmp_text_integrity__", "--format", "json");
  const payload = JSON.parse(result.stdout);

  assert.equal(typeof payload.ok, "boolean");
  assert.equal(Array.isArray(payload.findings), true);
  assert.equal(payload.findings.length > 0, true);
});

test("fails when a non-English locale copies a translatable value from en-US", () => {
  resetBaseLocale('{\n  "FIX": {\n    "ISSUE_CRIT_SEC_001": "This EPUB cannot be repaired."\n  }\n}\n');
  resetTempFile('{\n  "FIX": {\n    "ISSUE_CRIT_SEC_001": "This EPUB cannot be repaired."\n  }\n}\n');

  const result = runCli("--path", "apps/__tmp_text_integrity__");

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Translation value is identical to en-US/u);
  assert.match(result.stdout, /FIX\.ISSUE_CRIT_SEC_001/u);
});

test("allows explicitly shared product and format tokens", () => {
  resetBaseLocale('{\n  "APP": { "TITLE": "EPUB Fixer" },\n  "COMMON": { "PRO_ONLY": "PRO" },\n  "MY_EPUBS": { "PLACEHOLDER": "EPUB" }\n}\n');
  resetTempFile('{\n  "APP": { "TITLE": "EPUB Fixer" },\n  "COMMON": { "PRO_ONLY": "PRO" },\n  "MY_EPUBS": { "PLACEHOLDER": "EPUB" }\n}\n');

  const result = runCli("--path", "apps/__tmp_text_integrity__");

  assert.equal(result.status, 0);
});
