import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativeSqliteManager } from '@sheldrapps/native-sqlite-kit';

export interface TaskCategory {
  id: string;
  name: string;
}

interface CategoryRow extends Record<string, unknown> {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryRepository {
  private readonly sqliteManager = inject(NativeSqliteManager);

  async listCategories(): Promise<TaskCategory[]> {
    if (Capacitor.getPlatform() !== 'android') {
      return [];
    }

    if (!this.sqliteManager.isReady()) {
      await this.sqliteManager.initialize();
    }

    const rows = await this.sqliteManager.query<CategoryRow>(`
      SELECT id, name
      FROM categories
      ORDER BY sort_order ASC, name COLLATE NOCASE ASC
    `);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));
  }
}
