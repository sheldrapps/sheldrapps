import { SqlStatement } from '../contracts';

export interface SqliteDriver {
  isAvailable(): boolean;
  open(databaseName: string): Promise<void>;
  close(databaseName: string): Promise<void>;
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
  query<T extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<T[]>;
  runBatch(statements: readonly SqlStatement[]): Promise<void>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}
