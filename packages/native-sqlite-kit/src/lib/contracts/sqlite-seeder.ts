import { SqliteTransactionContext } from './sqlite-transaction-context';

export interface SqliteSeeder {
  name: string;
  run(db: SqliteTransactionContext): Promise<void>;
}
