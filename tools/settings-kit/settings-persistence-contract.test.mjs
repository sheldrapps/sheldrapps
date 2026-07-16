import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const settingsStorePath =
  "packages/settings-kit/src/lib/settings-store/settings.store.ts";
const configAdapterPath =
  "packages/settings-kit/src/lib/storage/config-json-file.adapter.ts";

test("settings-store contract: load path prefers persisted payload when present", () => {
  const source = readFileSync(settingsStorePath, "utf8");

  assert.match(
    source,
    /const rawJson = await this\.storage\.get\(this\.storageKey\);/,
    "SettingsStore.load() must read from primary storage adapter first"
  );
  assert.match(
    source,
    /if \(rawJson\)/,
    "SettingsStore must branch on existing persisted payload"
  );
  assert.match(
    source,
    /const payload = JSON\.parse\(rawJson\)/,
    "SettingsStore must parse persisted payload JSON"
  );
});

test("settings-store contract: fallback to defaults when no payload or on error", () => {
  const source = readFileSync(settingsStorePath, "utf8");

  assert.match(
    source,
    /this\.subject\.next\(this\.schema\.defaults\);\s*return this\.schema\.defaults;/,
    "SettingsStore must fallback to schema defaults when no persisted payload exists"
  );
  assert.match(
    source,
    /console\.error\('\[settings-kit\] Error loading settings:'/,
    "SettingsStore should log load errors"
  );
});

test("settings-store contract: writes persist and are re-readable via storage key", () => {
  const source = readFileSync(settingsStorePath, "utf8");

  assert.match(
    source,
    /await this\.storage\.set\(this\.storageKey,\s*JSON\.stringify\(payload\)\);/,
    "SettingsStore.persist() must write JSON payload into storage"
  );
  assert.match(
    source,
    /async set\(/,
    "SettingsStore must expose set() update operation"
  );
  assert.match(
    source,
    /const next =\s*typeof update === 'function'/,
    "SettingsStore.set() must support patch function update pattern"
  );
  assert.match(
    source,
    /await this\.load\(\);\s*return this\.enqueueWrite\(/,
    "SettingsStore.set() must load before writing and serialize writes"
  );
});

test("settings-store contract: writes are queued to avoid race conditions", () => {
  const source = readFileSync(settingsStorePath, "utf8");

  assert.match(
    source,
    /private writeQueue: Promise<void> = Promise\.resolve\(\);/,
    "SettingsStore should keep an internal FIFO queue for writes"
  );
  assert.match(
    source,
    /private async enqueueWrite<R>\(operation: \(\) => Promise<R>\): Promise<R>/,
    "SettingsStore should expose an internal enqueueWrite helper"
  );
  assert.match(
    source,
    /const pending = this\.writeQueue;/,
    "enqueueWrite should wait for the previous write before running"
  );
  assert.match(
    source,
    /await pending;/,
    "enqueueWrite must await previous writes"
  );
  assert.match(
    source,
    /async setForScope\(/,
    "SettingsStore should expose setForScope() for scoped writes"
  );
  assert.match(
    source,
    /Protected keys require setForScope/,
    "SettingsStore should block protected keys in generic set()"
  );
});

test("config-json adapter contract: default file path is config.json", () => {
  const source = readFileSync(configAdapterPath, "utf8");
  assert.match(
    source,
    /return this\.options\.path \|\| 'config\.json';/,
    "ConfigJsonFileAdapter must default file path to config.json"
  );
});

test("app wiring contract: config.json adapter is the source of truth where implemented", () => {
  const eccBootstrap = readFileSync(
    "apps/epub-cover-changer/src/app/bootstrap.providers.ts",
    "utf8"
  );
  const ccfkBootstrap = readFileSync(
    "apps/cover-creator-for-kindle/src/app/bootstrap.providers.ts",
    "utf8"
  );

  for (const [name, source] of [
    ["epub-cover-changer", eccBootstrap],
    ["cover-creator-for-kindle", ccfkBootstrap],
  ]) {
    assert.match(
      source,
      /storageAdapter:\s*new ConfigJsonFileAdapter\(/,
      `${name} must wire ConfigJsonFileAdapter as settings storage adapter`
    );
    assert.match(
      source,
      /fallbackAdapter:\s*new WebLocalStorageAdapter\(\)/,
      `${name} must keep web fallback adapter in config.json storage wiring`
    );
    assert.match(
      source,
      /writeAccess:\s*\{/,
      `${name} must define write access policy`
    );
    assert.match(
      source,
      /protectedKeys:\s*\[\s*'theme',\s*'language',\s*'exportQualityMode'\s*\]/,
      `${name} must protect theme/language/exportQualityMode from generic writes`
    );
  }
});

test("theme ownership contract: shared ThemeService persists theme via scoped write", () => {
  const source = readFileSync(
    "packages/ui-theme/src/lib/theme/theme.service.ts",
    "utf8"
  );

  assert.match(
    source,
    /setForScope\('theme',\s*\{\s*theme:/,
    "ThemeService must persist theme through theme scope"
  );
});

test("documented limitation: presupuesto-ninos does not implement config.json wiring yet", () => {
  const presupuestoMain = readFileSync(
    "apps/presupuesto-ninos/src/main.ts",
    "utf8"
  );
  assert.doesNotMatch(
    presupuestoMain,
    /ConfigJsonFileAdapter/,
    "This test guards current state; migration to config.json should update this test and AGENTS docs"
  );
});
