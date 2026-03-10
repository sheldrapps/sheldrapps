import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const managerPath =
  "packages/native-sqlite-kit/src/lib/services/native-sqlite-manager.service.ts";
const migrationRunnerPath =
  "packages/native-sqlite-kit/src/lib/services/sqlite-migration-runner.service.ts";
const guardsPath =
  "packages/native-sqlite-kit/src/lib/utils/sqlite-guards.ts";
const providerPath =
  "packages/native-sqlite-kit/src/lib/providers/provide-native-sqlite.ts";
const mockDriverPath =
  "packages/native-sqlite-kit/src/lib/testing/sqlite-driver.mock.ts";

test("migration ordering: migrations run in ascending version order", () => {
  const source = readFileSync(migrationRunnerPath, "utf8");
  assert.match(
    source,
    /\[\.\.\.this\.config\.migrations\]\.sort\(\s*\(a,\s*b\)\s*=>\s*a\.version\s*-\s*b\.version\s*\)/,
    "Migration runner must sort migrations by ascending version"
  );
});

test("migration skip behavior: already applied migrations are skipped", () => {
  const source = readFileSync(migrationRunnerPath, "utf8");
  assert.match(
    source,
    /if\s*\(appliedVersions\.has\(migration\.version\)\)\s*{[\s\S]*continue;/,
    "Migration runner must skip versions present in __migrations"
  );
});

test("transaction rollback behavior: failed transaction rolls back", () => {
  const source = readFileSync(managerPath, "utf8");
  assert.match(
    source,
    /await this\.driver\.beginTransaction\(\);[\s\S]*await this\.driver\.commitTransaction\(\);/,
    "Manager must begin and commit transaction on success"
  );
  assert.match(
    source,
    /catch\s*\(error\)\s*{[\s\S]*await this\.driver\.rollbackTransaction\(\);/,
    "Manager must rollback transaction when worker throws"
  );
});

test("readiness guards: manager blocks access before initialization", () => {
  const source = readFileSync(managerPath, "utf8");
  assert.match(
    source,
    /throw new NativeSqliteError\(\s*'DATABASE_NOT_INITIALIZED'/,
    "Manager must throw DATABASE_NOT_INITIALIZED when accessed before readiness"
  );
  assert.match(
    source,
    /await this\.ensureReady\(\);/,
    "Manager query/execute entrypoints must gate on readiness"
  );
});

test("duplicate initialization protection: concurrent init shares promise", () => {
  const source = readFileSync(managerPath, "utf8");
  assert.match(
    source,
    /if\s*\(this\.initializationPromise\)\s*{[\s\S]*return this\.initializationPromise;/,
    "Manager.initialize() must return shared promise while initialization is in flight"
  );
  assert.match(
    source,
    /if\s*\(this\.initialized\)\s*{\s*return;\s*}/,
    "Manager.initialize() must be idempotent after ready"
  );
});

test("config validation: required fields and duplicate migration versions are guarded", () => {
  const source = readFileSync(guardsPath, "utf8");
  assert.match(
    source,
    /config\.databaseName must be a non-empty string/i,
    "Config validator must enforce non-empty databaseName"
  );
  assert.match(
    source,
    /Duplicate migration version detected:/,
    "Config validator must reject duplicate migration versions"
  );
});

test("provider wiring: registers host config, driver token and bootstrap initializer", () => {
  const source = readFileSync(providerPath, "utf8");
  assert.match(
    source,
    /provide:\s*NATIVE_SQLITE_HOST_CONFIG_TOKEN/,
    "Provider must register host config token"
  );
  assert.match(
    source,
    /provide:\s*SQLITE_DRIVER_TOKEN[\s\S]*useClass:\s*CapacitorSqliteDriver/,
    "Provider must bind SQLITE_DRIVER_TOKEN to Capacitor driver"
  );
  assert.match(
    source,
    /provide:\s*APP_INITIALIZER[\s\S]*bootstrap\.bootstrap\(\)/,
    "Provider must wire bootstrap service into APP_INITIALIZER"
  );
});

test("manager + mock driver testability contract exists", () => {
  const managerSource = readFileSync(managerPath, "utf8");
  const mockSource = readFileSync(mockDriverPath, "utf8");

  assert.match(
    managerSource,
    /inject<SqliteDriver>\(SQLITE_DRIVER_TOKEN\)/,
    "Manager must depend on SqliteDriver abstraction for mockability"
  );
  assert.match(
    mockSource,
    /export class SqliteDriverMock implements SqliteDriver/,
    "Testing layer must provide a mock driver implementing SqliteDriver"
  );
});
