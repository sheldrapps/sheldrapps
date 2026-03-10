import { Injectable } from '@angular/core';
import { SqlStatement } from '../contracts';
import { NativeSqliteError } from '../errors';
import { mapSqlError } from '../utils';
import { SqliteDriver } from './sqlite-driver';

type SQLitePluginResult = {
  values?: unknown[];
};

type CapacitorSQLitePlugin = {
  createConnection?: (options: Record<string, unknown>) => Promise<unknown>;
  open?: (options: Record<string, unknown>) => Promise<unknown>;
  closeConnection?: (options: Record<string, unknown>) => Promise<unknown>;
  close?: (options: Record<string, unknown>) => Promise<unknown>;
  execute?: (options: Record<string, unknown>) => Promise<unknown>;
  run?: (options: Record<string, unknown>) => Promise<unknown>;
  query?: (options: Record<string, unknown>) => Promise<SQLitePluginResult>;
  executeSet?: (options: Record<string, unknown>) => Promise<unknown>;
  beginTransaction?: (options?: Record<string, unknown>) => Promise<unknown>;
  commitTransaction?: (options?: Record<string, unknown>) => Promise<unknown>;
  rollbackTransaction?: (options?: Record<string, unknown>) => Promise<unknown>;
};

@Injectable()
export class CapacitorSqliteDriver implements SqliteDriver {
  private databaseName: string | null = null;
  private opened = false;

  isAvailable(): boolean {
    return !!this.getPlugin();
  }

  async open(databaseName: string): Promise<void> {
    const plugin = this.requirePlugin();

    if (this.opened && this.databaseName === databaseName) {
      return;
    }

    if (this.opened && this.databaseName) {
      await this.close(this.databaseName);
    }

    try {
      if (typeof plugin.createConnection === 'function') {
        await this.tryCreateConnection(plugin, databaseName);
      }

      if (typeof plugin.open === 'function') {
        await plugin.open({ database: databaseName });
      }

      this.databaseName = databaseName;
      this.opened = true;
    } catch (error) {
      throw mapSqlError(
        'DATABASE_OPEN_FAILURE',
        `Failed to open SQLite database "${databaseName}".`,
        error,
        { databaseName }
      );
    }
  }

  async close(databaseName: string): Promise<void> {
    const plugin = this.requirePlugin();

    if (!this.opened || this.databaseName !== databaseName) {
      return;
    }

    try {
      if (typeof plugin.closeConnection === 'function') {
        await plugin.closeConnection({ database: databaseName });
      } else if (typeof plugin.close === 'function') {
        await plugin.close({ database: databaseName });
      }
    } catch (error) {
      throw mapSqlError(
        'CONNECTION_STATE_INVALID',
        `Failed to close SQLite database "${databaseName}".`,
        error,
        { databaseName }
      );
    } finally {
      this.opened = false;
      this.databaseName = null;
    }
  }

  async execute(sql: string, params: readonly unknown[] = []): Promise<void> {
    const plugin = this.requirePlugin();
    const database = this.requireDatabaseName();

    try {
      if (params.length > 0 && typeof plugin.run === 'function') {
        await plugin.run({ database, statement: sql, values: [...params] });
        return;
      }

      if (typeof plugin.execute === 'function') {
        await plugin.execute({
          database,
          statements: sql,
          values: params.length > 0 ? [...params] : undefined,
        });
        return;
      }

      if (typeof plugin.run === 'function') {
        await plugin.run({ database, statement: sql, values: [...params] });
        return;
      }

      throw new NativeSqliteError(
        'UNSUPPORTED_RUNTIME_STATE',
        'Capacitor SQLite plugin does not support execute or run methods.'
      );
    } catch (error) {
      throw mapSqlError(
        'INVALID_SQL_EXECUTION',
        'Failed to execute SQLite statement.',
        error,
        {
          sql,
          paramCount: params.length,
        }
      );
    }
  }

  async query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<T[]> {
    const plugin = this.requirePlugin();
    const database = this.requireDatabaseName();

    if (typeof plugin.query !== 'function') {
      throw new NativeSqliteError(
        'UNSUPPORTED_RUNTIME_STATE',
        'Capacitor SQLite plugin does not support query method.'
      );
    }

    try {
      const result = await plugin.query({
        database,
        statement: sql,
        values: [...params],
      });

      const values = Array.isArray(result?.values) ? result.values : [];
      return values as T[];
    } catch (error) {
      throw mapSqlError('INVALID_SQL_EXECUTION', 'Failed to query SQLite rows.', error, {
        sql,
        paramCount: params.length,
      });
    }
  }

  async runBatch(statements: readonly SqlStatement[]): Promise<void> {
    const plugin = this.requirePlugin();
    const database = this.requireDatabaseName();

    if (statements.length === 0) {
      return;
    }

    try {
      if (typeof plugin.executeSet === 'function') {
        await plugin.executeSet({
          database,
          set: statements.map((statement) => ({
            statement: statement.sql,
            values: statement.params ? [...statement.params] : [],
          })),
        });
        return;
      }

      for (const statement of statements) {
        await this.execute(statement.sql, statement.params);
      }
    } catch (error) {
      throw mapSqlError(
        'INVALID_SQL_EXECUTION',
        'Failed to execute SQLite batch.',
        error,
        {
          statementCount: statements.length,
        }
      );
    }
  }

  async beginTransaction(): Promise<void> {
    const plugin = this.requirePlugin();
    const database = this.requireDatabaseName();

    if (typeof plugin.beginTransaction === 'function') {
      await plugin.beginTransaction({ database });
      return;
    }

    await this.execute('BEGIN TRANSACTION');
  }

  async commitTransaction(): Promise<void> {
    const plugin = this.requirePlugin();
    const database = this.requireDatabaseName();

    if (typeof plugin.commitTransaction === 'function') {
      await plugin.commitTransaction({ database });
      return;
    }

    await this.execute('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    const plugin = this.requirePlugin();
    const database = this.requireDatabaseName();

    if (typeof plugin.rollbackTransaction === 'function') {
      await plugin.rollbackTransaction({ database });
      return;
    }

    await this.execute('ROLLBACK');
  }

  private async tryCreateConnection(
    plugin: CapacitorSQLitePlugin,
    databaseName: string
  ): Promise<void> {
    if (!plugin.createConnection) {
      return;
    }

    try {
      await plugin.createConnection({
        database: databaseName,
        encrypted: false,
        mode: 'no-encryption',
        version: 1,
        readonly: false,
      });
    } catch (error) {
      const text = String(error ?? '').toLowerCase();
      if (
        text.includes('already') &&
        text.includes('connection')
      ) {
        return;
      }

      throw error;
    }
  }

  private requireDatabaseName(): string {
    if (!this.opened || !this.databaseName) {
      throw new NativeSqliteError(
        'CONNECTION_STATE_INVALID',
        'SQLite connection is not open.'
      );
    }

    return this.databaseName;
  }

  private requirePlugin(): CapacitorSQLitePlugin {
    const plugin = this.getPlugin();
    if (!plugin) {
      throw new NativeSqliteError(
        'UNSUPPORTED_RUNTIME_STATE',
        'Capacitor SQLite plugin is not available in current runtime.'
      );
    }

    return plugin;
  }

  private getPlugin(): CapacitorSQLitePlugin | null {
    const cap = getCapacitorGlobal();
    return cap?.Plugins?.CapacitorSQLite ?? null;
  }
}

type CapacitorGlobal = {
  Plugins?: {
    CapacitorSQLite?: CapacitorSQLitePlugin;
  };
};

function getCapacitorGlobal(): CapacitorGlobal | null {
  const direct = (
    globalThis as typeof globalThis & { Capacitor?: CapacitorGlobal }
  ).Capacitor;
  if (direct) {
    return direct;
  }

  return (
    globalThis as typeof globalThis & {
      window?: { Capacitor?: CapacitorGlobal };
    }
  ).window?.Capacitor ?? null;
}
