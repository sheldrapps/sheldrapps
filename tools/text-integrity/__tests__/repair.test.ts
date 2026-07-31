import test from "node:test";
import assert from "node:assert/strict";

import { scoreCorruption, suggestRepair } from "../repair.ts";

test("repair suggests reversible fix for double mojibake", () => {
  const suggestion = suggestRepair("FranÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ais");

  assert.ok(suggestion);
  const repaired = suggestion as NonNullable<typeof suggestion>;
  assert.equal(repaired.value, "FranÃƒÂ§ais");
  assert.equal(repaired.passes >= 1, true);
});

test("repair is idempotent on already repaired text", () => {
  const repaired = suggestRepair("ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n")?.value ?? "ConfiguraciÃƒÂ³n";

  assert.equal(suggestRepair(repaired), undefined);
});

test("repair lowers corruption score", () => {
  const original = "DonÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢t stop ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬";
  const suggestion = suggestRepair(original);

  assert.ok(suggestion);
  const repaired = suggestion as NonNullable<typeof suggestion>;
  assert.equal(scoreCorruption(repaired.value) < scoreCorruption(original), true);
});

test("valid text is not changed", () => {
  assert.equal(suggestRepair("Configuraci\u00f3n"), undefined);
  assert.equal(suggestRepair("\u0625\u0635\u0644\u0627\u062d EPUB"), undefined);
});

test("repair suggests fix for single-pass multilingual mojibake", () => {
  const suggestion = suggestRepair("\u00eb\u2039\u00a4\u00ec\u2039\u0153 \u00ec\u2039\u0153\u00ec\u017e\u0091");

  assert.ok(suggestion);
  assert.equal(suggestion.value, "\ub2e4\uc2dc \uc2dc\uc791");
});
