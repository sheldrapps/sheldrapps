import test from "node:test";
import assert from "node:assert/strict";

import { scoreCorruption, suggestRepair } from "../repair.ts";

test("repair suggests reversible fix for double mojibake", () => {
  const suggestion = suggestRepair("FranÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ais");

  assert.ok(suggestion);
  const repaired = suggestion as NonNullable<typeof suggestion>;
  assert.equal(repaired.value, "FranÃ§ais");
  assert.equal(repaired.passes >= 1, true);
});

test("repair is idempotent on already repaired text", () => {
  const repaired = suggestRepair("ConfiguraciÃƒÆ’Ã‚Â³n")?.value ?? "ConfiguraciÃ³n";

  assert.equal(suggestRepair(repaired), undefined);
});

test("repair lowers corruption score", () => {
  const original = "DonÃ¢â‚¬â„¢t stop Ã°Å¸Å¡â‚¬";
  const suggestion = suggestRepair(original);

  assert.ok(suggestion);
  const repaired = suggestion as NonNullable<typeof suggestion>;
  assert.equal(scoreCorruption(repaired.value) < scoreCorruption(original), true);
});

test("valid text is not changed", () => {
  assert.equal(suggestRepair("ConfiguraciÃ³n"), undefined);
  assert.equal(suggestRepair("Ø¥ØµÙ„Ø§Ø­ EPUB"), undefined);
});
