import { SqlStatement } from './sql-statement';

export interface SqliteTransactionContext {
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<T[]>;
  runBatch(statements: readonly SqlStatement[]): Promise<void>;
}
