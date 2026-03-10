import { SqlStatement } from '../contracts';
import { SqliteDriver } from '../driver';

type QueryResponse = Record<string, unknown>[];

export class SqliteDriverMock implements SqliteDriver {
  opened = false;
  databaseName: string | null = null;
  transactionDepth = 0;

  readonly executed: Array<{ sql: string; params: readonly unknown[] }> = [];
  readonly batches: SqlStatement[][] = [];

  private readonly queryMap = new Map<string, QueryResponse>();
  private failNextError: unknown = null;

  isAvailable(): boolean {
    return true;
  }

  async open(databaseName: string): Promise<void> {
    this.databaseName = databaseName;
    this.opened = true;
  }

  async close(_: string): Promise<void> {
    this.databaseName = null;
    this.opened = false;
  }

  async execute(sql: string, params: readonly unknown[] = []): Promise<void> {
    this.throwIfFailNext();
    this.executed.push({ sql, params });
  }

  async query<T extends Record<string, unknown>>(
    sql: string,
    _params: readonly unknown[] = []
  ): Promise<T[]> {
    this.throwIfFailNext();
    const rows = this.queryMap.get(sql) ?? [];
    return rows as T[];
  }

  async runBatch(statements: readonly SqlStatement[]): Promise<void> {
    this.throwIfFailNext();
    this.batches.push([...statements]);
    for (const statement of statements) {
      await this.execute(statement.sql, statement.params ?? []);
    }
  }

  async beginTransaction(): Promise<void> {
    this.throwIfFailNext();
    this.transactionDepth += 1;
  }

  async commitTransaction(): Promise<void> {
    this.throwIfFailNext();
    this.transactionDepth = Math.max(0, this.transactionDepth - 1);
  }

  async rollbackTransaction(): Promise<void> {
    this.throwIfFailNext();
    this.transactionDepth = Math.max(0, this.transactionDepth - 1);
  }

  setQueryResponse(sql: string, rows: QueryResponse): void {
    this.queryMap.set(sql, rows);
  }

  failNext(error: unknown): void {
    this.failNextError = error;
  }

  private throwIfFailNext(): void {
    if (!this.failNextError) {
      return;
    }

    const error = this.failNextError;
    this.failNextError = null;
    throw error;
  }
}
