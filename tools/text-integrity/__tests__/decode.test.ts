import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_TEXT_INTEGRITY_CONFIG } from "../config.ts";
import { decodeUtf8Strict } from "../decode.ts";

const fixturesDir = resolve(
  process.cwd(),
  "tools",
  "text-integrity",
  "__tests__",
  "fixtures"
);

test("strict UTF-8 validation rejects invalid byte sequences with location", () => {
  const invalid = Uint8Array.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x7d]);
  const result = decodeUtf8Strict("memory.json", invalid, DEFAULT_TEXT_INTEGRITY_CONFIG);

  assert.equal(result.bytesValid, false);
  assert.equal(result.findings[0]?.kind, "utf8-invalid");
  assert.equal(result.findings[0]?.start.line, 1);
  assert.equal(result.findings[0]?.start.column, 3);
});

test("strict UTF-8 validation accepts valid multilingual UTF-8", () => {
  const buffer = readFileSync(resolve(fixturesDir, "valid-locale.json"));
  const result = decodeUtf8Strict(
    resolve(fixturesDir, "valid-locale.json"),
    buffer,
    DEFAULT_TEXT_INTEGRITY_CONFIG
  );

  assert.equal(result.bytesValid, true);
  assert.equal(result.findings.some((finding) => finding.kind === "utf8-invalid"), false);
});

test("UTF-8 BOM is reported as warning by default", () => {
  const text = "\uFEFF{\"title\":\"Hola\"}";
  const buffer = Buffer.from(text, "utf8");
  const result = decodeUtf8Strict("bom.json", buffer, DEFAULT_TEXT_INTEGRITY_CONFIG);

  assert.equal(result.bytesValid, true);
  assert.equal(result.findings.some((finding) => finding.kind === "utf8-bom"), true);
});
