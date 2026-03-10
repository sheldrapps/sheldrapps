import { SqlStatement, SqliteTransactionContext } from '../contracts';
import { NativeSqliteManager } from '../services';

export abstract class BaseRepository {
  constructor(protected readonly sqlite: NativeSqliteManager) {}

  protected execute(sql: string, params: readonly unknown[] = []): Promise<void> {
    return this.sqlite.execute(sql, params);
  }

  protected query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<T[]> {
    return this.sqlite.query<T>(sql, params);
  }

  protected runBatch(statements: readonly SqlStatement[]): Promise<void> {
    return this.sqlite.runBatch(statements);
  }

  protected runInTransaction<T>(
    worker: (tx: SqliteTransactionContext) => Promise<T>
  ): Promise<T> {
    return this.sqlite.runInTransaction(worker);
  }
}
