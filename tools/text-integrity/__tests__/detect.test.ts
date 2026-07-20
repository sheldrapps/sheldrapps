import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { collectSemanticMojibakeFindings, hasSemanticMojibake } from "../detect.ts";

const fixturesDir = resolve(
  process.cwd(),
  "tools",
  "text-integrity",
  "__tests__",
  "fixtures"
);

test("detects mojibake that is still valid UTF-8", () => {
  const text = readFileSync(resolve(fixturesDir, "corrupted-locale.json"), "utf8");
  const findings = collectSemanticMojibakeFindings("corrupted-locale.json", text);

  assert.equal(findings.length > 0, true);
  assert.equal(findings.some((finding) => finding.original.includes("ConfiguraciÃƒÂ³n")), true);
  assert.equal(
    findings.some((finding) => finding.suggested?.includes("Configuración")),
    true
  );
});

test("does not flag valid multilingual text", () => {
  const text = readFileSync(resolve(fixturesDir, "valid-locale.json"), "utf8");
  const findings = collectSemanticMojibakeFindings("valid-locale.json", text);

  assert.deepEqual(findings, []);
  assert.equal(hasSemanticMojibake(text), false);
});

test("detects damaged emoji and quotes", () => {
  const findings = collectSemanticMojibakeFindings(
    "memory.txt",
    "Broken: â€œTextoâ€ ðŸš€"
  );

  assert.equal(findings.length > 0, true);
  assert.equal(
    findings.some((finding) => finding.suggested?.includes("“Texto” 🚀")),
    true
  );
});

test("reports exact line and column for semantic mojibake", () => {
  const findings = collectSemanticMojibakeFindings(
    "memory.txt",
    "ok\nConfiguraciÃƒÂ³n\nfine"
  );

  assert.equal(findings.length > 0, true);
  assert.equal(findings[0]?.start.line, 2);
  assert.equal(findings[0]?.start.column, 1);
});
