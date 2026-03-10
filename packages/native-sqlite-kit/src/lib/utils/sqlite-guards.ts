import {
  NativeSqliteHostConfig,
  SqliteMigration,
  SqliteSeeder,
} from '../contracts';
import { NativeSqliteError } from '../errors';

export function validateNativeSqliteHostConfig(
  config: NativeSqliteHostConfig
): NativeSqliteHostConfig {
  if (!config || typeof config !== 'object') {
    throw new NativeSqliteError(
      'CONFIG_VALIDATION_FAILURE',
      'Native SQLite config must be an object.'
    );
  }

  const databaseName = normalizeDatabaseName(config.databaseName);
  const migrations = normalizeMigrations(config.migrations);
  const seeders = normalizeSeeders(config.seeders);
  const debug = Boolean(config.debug);

  return {
    databaseName,
    migrations,
    seeders,
    debug,
  };
}

function normalizeDatabaseName(databaseName: string): string {
  if (typeof databaseName !== 'string' || databaseName.trim().length === 0) {
    throw new NativeSqliteError(
      'CONFIG_VALIDATION_FAILURE',
      'Native SQLite config.databaseName must be a non-empty string.'
    );
  }

  return databaseName.trim();
}

function normalizeMigrations(
  migrations: readonly SqliteMigration[] | undefined
): readonly SqliteMigration[] {
  if (!Array.isArray(migrations)) {
    throw new NativeSqliteError(
      'CONFIG_VALIDATION_FAILURE',
      'Native SQLite config.migrations must be an array.'
    );
  }

  const seenVersions = new Set<number>();

  for (const migration of migrations) {
    if (
      !migration ||
      typeof migration.version !== 'number' ||
      migration.version <= 0 ||
      !Number.isInteger(migration.version)
    ) {
      throw new NativeSqliteError(
        'CONFIG_VALIDATION_FAILURE',
        'Each migration must have a positive integer version.'
      );
    }

    if (typeof migration.name !== 'string' || migration.name.trim().length === 0) {
      throw new NativeSqliteError(
        'CONFIG_VALIDATION_FAILURE',
        `Migration v${migration.version} must have a non-empty name.`
      );
    }

    if (typeof migration.up !== 'function') {
      throw new NativeSqliteError(
        'CONFIG_VALIDATION_FAILURE',
        `Migration v${migration.version} must provide an up() function.`
      );
    }

    if (seenVersions.has(migration.version)) {
      throw new NativeSqliteError(
        'CONFIG_VALIDATION_FAILURE',
        `Duplicate migration version detected: ${migration.version}.`
      );
    }

    seenVersions.add(migration.version);
  }

  return [...migrations];
}

function normalizeSeeders(
  seeders: readonly SqliteSeeder[] | undefined
): readonly SqliteSeeder[] | undefined {
  if (!seeders) {
    return undefined;
  }

  if (!Array.isArray(seeders)) {
    throw new NativeSqliteError(
      'CONFIG_VALIDATION_FAILURE',
      'Native SQLite config.seeders must be an array when provided.'
    );
  }

  const seenNames = new Set<string>();

  for (const seeder of seeders) {
    if (!seeder || typeof seeder.name !== 'string' || seeder.name.trim() === '') {
      throw new NativeSqliteError(
        'CONFIG_VALIDATION_FAILURE',
        'Each seeder must have a non-empty name.'
      );
    }

    if (typeof seeder.run !== 'function') {
      throw new NativeSqliteError(
        'CONFIG_VALIDATION_FAILURE',
        `Seeder "${seeder.name}" must provide a run() function.`
      );
    }

    if (seenNames.has(seeder.name)) {
      throw new NativeSqliteError(
        'CONFIG_VALIDATION_FAILURE',
        `Duplicate seeder name detected: ${seeder.name}.`
      );
    }

    seenNames.add(seeder.name);
  }

  return [...seeders];
}
