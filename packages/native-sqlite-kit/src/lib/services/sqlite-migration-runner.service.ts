import { Injectable, inject } from '@angular/core';
import {
  SqliteMigration,
  SqliteTransactionContext,
} from '../contracts';
import { SqliteDriver } from '../driver';
import { mapSqlError, SqlLogger } from '../utils';
import { SQLITE_DRIVER_TOKEN, NATIVE_SQLITE_HOST_CONFIG_TOKEN } from '../tokens';

const MIGRATIONS_TABLE = '__migrations';

@Injectable()
export class SqliteMigrationRunnerService {
  private readonly config = inject(NATIVE_SQLITE_HOST_CONFIG_TOKEN);
  private readonly driver = inject<SqliteDriver>(SQLITE_DRIVER_TOKEN);
  private readonly logger = inject(SqlLogger);

  async runMigrations(): Promise<void> {
    await this.ensureMigrationsTable();
    const appliedVersions = await this.loadAppliedVersions();
    const orderedMigrations = [...this.config.migrations].sort(
      (a, b) => a.version - b.version
    );

    for (const migration of orderedMigrations) {
      if (appliedVersions.has(migration.version)) {
        this.logger.debug('Skipping applied migration.', {
          version: migration.version,
          name: migration.name,
        });
        continue;
      }

      await this.runSingleMigration(migration);
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    await this.driver.execute(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )`
    );
  }

  private async loadAppliedVersions(): Promise<Set<number>> {
    const rows = await this.driver.query<{ version: number }>(
      `SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version ASC`
    );

    return new Set(rows.map((row) => Number(row.version)));
  }

  private async runSingleMigration(migration: SqliteMigration): Promise<void> {
    this.logger.debug('Running migration.', {
      version: migration.version,
      name: migration.name,
    });

    try {
      await this.driver.beginTransaction();

      const context: SqliteTransactionContext = {
        execute: (sql, params) => this.driver.execute(sql, params),
        query: (sql, params) => this.driver.query(sql, params),
        runBatch: (statements) => this.driver.runBatch(statements),
      };

      await migration.up(context);
      await this.driver.execute(
        `INSERT INTO ${MIGRATIONS_TABLE} (version, name, applied_at) VALUES (?, ?, ?)`,
        [migration.version, migration.name, new Date().toISOString()]
      );
      await this.driver.commitTransaction();

      this.logger.debug('Migration completed.', {
        version: migration.version,
        name: migration.name,
      });
    } catch (error) {
      try {
        await this.driver.rollbackTransaction();
      } catch (rollbackError) {
        this.logger.warn('Rollback failed after migration error.', {
          version: migration.version,
          name: migration.name,
          rollbackError: String(rollbackError),
        });
      }

      throw mapSqlError(
        'MIGRATION_FAILURE',
        `Migration failed: v${migration.version} (${migration.name}).`,
        error,
        {
          version: migration.version,
          name: migration.name,
        }
      );
    }
  }
}
