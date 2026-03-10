import { SqliteTransactionContext } from '../contracts';
import { NativeSqliteManager } from '../services';

export interface RepositoryContext {
  db: NativeSqliteManager;
  tx?: SqliteTransactionContext;
}
