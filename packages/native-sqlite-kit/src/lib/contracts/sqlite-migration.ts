import { SqliteTransactionContext } from './sqlite-transaction-context';

export interface SqliteMigration {
  version: number;
  name: string;
  up(db: SqliteTransactionContext): Promise<void>;
}
