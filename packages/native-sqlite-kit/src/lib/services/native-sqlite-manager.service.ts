import { Injectable, inject } from '@angular/core';
import {
  NATIVE_SQLITE_HOST_CONFIG_TOKEN,
  SQLITE_DRIVER_TOKEN,
} from '../tokens';
import {
  SqlStatement,
  SqliteSeeder,
  SqliteTransactionContext,
} from '../contracts';
import { SqliteDriver } from '../driver';
import { NativeSqliteError } from '../errors';
import { mapSqlError, SqlLogger } from '../utils';
import { SqliteMigrationRunnerService } from './sqlite-migration-runner.service';

@Injectable()
export class NativeSqliteManager {
  private readonly config = inject(NATIVE_SQLITE_HOST_CONFIG_TOKEN);
  private readonly driver = inject<SqliteDriver>(SQLITE_DRIVER_TOKEN);
  private readonly migrationRunner = inject(SqliteMigrationRunnerService);
  private readonly logger = inject(SqlLogger);

  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private lastInitializationError: NativeSqliteError | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      this.logger.debug('Initialization already in progress; waiting shared promise.');
      return this.initializationPromise;
    }

    if (this.lastInitializationError) {
      throw this.lastInitializationError;
    }

    this.initializationPromise = this.doInitialize()
      .catch((error) => {
        const mapped = mapSqlError(
          'DATABASE_OPEN_FAILURE',
          'Native SQLite initialization failed.',
          error,
          { databaseName: this.config.databaseName }
        );
        this.lastInitializationError = mapped;
        throw mapped;
      })
      .finally(() => {
        this.initializationPromise = null;
      });

    return this.initializationPromise;
  }

  isReady(): boolean {
    return this.initialized;
  }

  async waitUntilReady(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    throw new NativeSqliteError(
      'DATABASE_NOT_INITIALIZED',
      'Native SQLite has not been initialized yet.'
    );
  }

  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.driver.close(this.config.databaseName);
    this.initialized = false;
  }

  async execute(sql: string, params: readonly unknown[] = []): Promise<void> {
    await this.ensureReady();

    try {
      await this.driver.execute(sql, params);
    } catch (error) {
      throw mapSqlError('INVALID_SQL_EXECUTION', 'SQLite execute failed.', error, {
        sql,
        paramCount: params.length,
      });
    }
  }

  async query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<T[]> {
    await this.ensureReady();

    try {
      return await this.driver.query<T>(sql, params);
    } catch (error) {
      throw mapSqlError('INVALID_SQL_EXECUTION', 'SQLite query failed.', error, {
        sql,
        paramCount: params.length,
      });
    }
  }

  async runBatch(statements: readonly SqlStatement[]): Promise<void> {
    await this.ensureReady();

    try {
      await this.driver.runBatch(statements);
    } catch (error) {
      throw mapSqlError('INVALID_SQL_EXECUTION', 'SQLite batch failed.', error, {
        statementCount: statements.length,
      });
    }
  }

  async runInTransaction<T>(
    worker: (tx: SqliteTransactionContext) => Promise<T>
  ): Promise<T> {
    await this.ensureReady();
    return this.runWithDriverTransaction(worker);
  }

  private async doInitialize(): Promise<void> {
    if (!this.driver.isAvailable()) {
      throw new NativeSqliteError(
        'UNSUPPORTED_RUNTIME_STATE',
        'Capacitor SQLite plugin is unavailable. Android native runtime is required.'
      );
    }

    this.logger.debug('Opening SQLite database.', {
      databaseName: this.config.databaseName,
    });

    await this.driver.open(this.config.databaseName);
    await this.migrationRunner.runMigrations();
    await this.runSeeders(this.config.seeders);

    this.initialized = true;
    this.lastInitializationError = null;
    this.logger.debug('SQLite initialization complete.', {
      databaseName: this.config.databaseName,
    });
  }

  private async runSeeders(seeders: readonly SqliteSeeder[] | undefined): Promise<void> {
    if (!seeders || seeders.length === 0) {
      return;
    }

    for (const seeder of seeders) {
      this.logger.debug('Running seeder.', { name: seeder.name });
      await this.runWithDriverTransaction(async (tx) => {
        await seeder.run(tx);
      });
      this.logger.debug('Seeder completed.', { name: seeder.name });
    }
  }

  private async runWithDriverTransaction<T>(
    worker: (tx: SqliteTransactionContext) => Promise<T>
  ): Promise<T> {
    const context: SqliteTransactionContext = {
      execute: (sql, params) => this.driver.execute(sql, params),
      query: (sql, params) => this.driver.query(sql, params),
      runBatch: (statements) => this.driver.runBatch(statements),
    };

    try {
      this.logger.debug('BEGIN transaction.');
      await this.driver.beginTransaction();
      const result = await worker(context);
      await this.driver.commitTransaction();
      this.logger.debug('COMMIT transaction.');
      return result;
    } catch (error) {
      try {
        await this.driver.rollbackTransaction();
        this.logger.debug('ROLLBACK transaction.');
      } catch (rollbackError) {
        this.logger.warn('Rollback failed after transaction error.', {
          rollbackError: String(rollbackError),
        });
      }

      throw mapSqlError('TRANSACTION_FAILURE', 'SQLite transaction failed.', error);
    }
  }

  private async ensureReady(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    throw new NativeSqliteError(
      'DATABASE_NOT_INITIALIZED',
      'SQLite access attempted before initialization.'
    );
  }
}
