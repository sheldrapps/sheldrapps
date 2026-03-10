import { Injectable, inject } from '@angular/core';
import { SqliteTransactionContext } from '../contracts';
import { NativeSqliteManager } from './native-sqlite-manager.service';

@Injectable()
export class SqliteTransactionManagerService {
  private readonly manager = inject(NativeSqliteManager);

  runInTransaction<T>(
    worker: (tx: SqliteTransactionContext) => Promise<T>
  ): Promise<T> {
    return this.manager.runInTransaction(worker);
  }
}
