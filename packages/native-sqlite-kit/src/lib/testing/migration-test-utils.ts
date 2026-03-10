import { SqliteMigration, SqliteTransactionContext } from '../contracts';

export function createMigration(
  version: number,
  name = `migration-${version}`,
  up?: (db: SqliteTransactionContext) => Promise<void>
): SqliteMigration {
  return {
    version,
    name,
    up: up ?? (async () => Promise.resolve()),
  };
}

export function createMigrations(
  versions: readonly number[]
): readonly SqliteMigration[] {
  return versions.map((version) => createMigration(version));
}
