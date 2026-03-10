import { Injectable, inject } from '@angular/core';
import { NativeSqliteManager } from './native-sqlite-manager.service';

@Injectable()
export class SqliteBootstrapService {
  private readonly manager = inject(NativeSqliteManager);

  async bootstrap(): Promise<void> {
    await this.manager.initialize();
  }

  async waitUntilReady(): Promise<void> {
    await this.manager.waitUntilReady();
  }
}
