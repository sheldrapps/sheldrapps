import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { NativeSqliteManager, SqliteTransactionContext } from '@sheldrapps/native-sqlite-kit';
import {
  BROWSER_CATEGORY_DB_NAME,
  CategoryRepository,
  TaskCategory,
} from './category.repository';

interface CategoryRecord {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_archived: number;
  origin: string;
  seed_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

class FakeNativeSqliteManager {
  private readonly categories = new Map<string, CategoryRecord>();
  private readonly meta = new Map<string, string>();

  isReady(): boolean {
    return true;
  }

  async initialize(): Promise<void> {
    return;
  }

  async runInTransaction<T>(
    worker: (tx: SqliteTransactionContext) => Promise<T>
  ): Promise<T> {
    const tx: SqliteTransactionContext = {
      execute: async (sql, params) => this.execute(sql, params),
      query: async <U extends Record<string, unknown>>(sql: string, params?: readonly unknown[]) =>
        this.query<U>(sql, params),
      runBatch: async () => undefined,
    };

    return worker(tx);
  }

  async execute(sql: string, params: readonly unknown[] = []): Promise<void> {
    if (sql.includes('CREATE TABLE IF NOT EXISTS category_meta')) {
      return;
    }

    if (sql.includes('INSERT OR REPLACE INTO category_meta')) {
      const key = String(params[0] ?? '');
      this.meta.set(key, '1');
      return;
    }

    if (sql.includes('INSERT INTO categories')) {
      if (params.length === 10) {
        const record: CategoryRecord = {
          id: String(params[0]),
          name: String(params[1]),
          color: String(params[2]),
          icon: asNullableString(params[3]),
          description: asNullableString(params[4]),
          sort_order: Number(params[5] ?? 0),
          is_archived: 0,
          origin: String(params[6]),
          seed_key: asNullableString(params[7]),
          created_at: String(params[8]),
          updated_at: String(params[9]),
          deleted_at: null,
        };
        this.categories.set(record.id, record);
        return;
      }

      if (params.length === 7) {
        const record: CategoryRecord = {
          id: String(params[0]),
          name: String(params[1]),
          color: String(params[2]),
          icon: null,
          description: null,
          sort_order: Number(params[3] ?? 0),
          is_archived: 0,
          origin: 'seeded',
          seed_key: asNullableString(params[4]),
          created_at: String(params[5]),
          updated_at: String(params[6]),
          deleted_at: null,
        };
        this.categories.set(record.id, record);
      }
      return;
    }

    if (sql.includes('UPDATE categories') && sql.includes('name = ?')) {
      const id = String(params[5] ?? '');
      const existing = this.categories.get(id);
      if (!existing || existing.deleted_at !== null) {
        return;
      }
      existing.name = String(params[0]);
      existing.color = String(params[1]);
      existing.icon = asNullableString(params[2]);
      existing.description = asNullableString(params[3]);
      existing.updated_at = String(params[4]);
      return;
    }

    if (sql.includes('SET is_archived = 1') && !sql.includes('deleted_at = ?')) {
      const id = String(params[1] ?? '');
      const existing = this.categories.get(id);
      if (!existing || existing.deleted_at !== null) {
        return;
      }
      existing.is_archived = 1;
      existing.updated_at = String(params[0]);
      return;
    }

    if (sql.includes('SET is_archived = 0')) {
      const id = String(params[1] ?? '');
      const existing = this.categories.get(id);
      if (!existing || existing.deleted_at !== null) {
        return;
      }
      existing.is_archived = 0;
      existing.updated_at = String(params[0]);
      return;
    }

    if (sql.includes('SET deleted_at = ?, is_archived = 1')) {
      const id = String(params[2] ?? '');
      const existing = this.categories.get(id);
      if (!existing || existing.deleted_at !== null) {
        return;
      }
      existing.deleted_at = String(params[0]);
      existing.updated_at = String(params[1]);
      existing.is_archived = 1;
      return;
    }

    if (sql.includes('SET sort_order = ?')) {
      const id = String(params[2] ?? '');
      const existing = this.categories.get(id);
      if (!existing || existing.deleted_at !== null) {
        return;
      }
      existing.sort_order = Number(params[0] ?? 0);
      existing.updated_at = String(params[1]);
      return;
    }
  }

  async query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<T[]> {
    if (sql.includes('SELECT value') && sql.includes('FROM category_meta')) {
      const key = String(params[0] ?? '');
      const value = this.meta.get(key);
      if (!value) {
        return [];
      }
      return [{ value } as unknown as T];
    }

    if (sql.includes('SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order')) {
      const active = [...this.categories.values()].filter(
        (category) => category.deleted_at === null && category.is_archived === 0
      );
      const max = active.reduce(
        (current, category) => Math.max(current, category.sort_order),
        -1
      );
      return [{ max_sort_order: max } as unknown as T];
    }

    if (sql.includes('FROM categories') && sql.includes('WHERE id = ?')) {
      const id = String(params[0] ?? '');
      const row = this.categories.get(id);
      if (!row || row.deleted_at !== null) {
        return [];
      }
      return [row as unknown as T];
    }

    if (sql.includes('FROM categories')) {
      const includeDeleted = !sql.includes('deleted_at IS NULL');
      const includeArchived = !sql.includes('is_archived = 0');
      const list = [...this.categories.values()]
        .filter((category) => (includeDeleted ? true : category.deleted_at === null))
        .filter((category) => (includeArchived ? true : category.is_archived === 0))
        .sort((a, b) => a.sort_order - b.sort_order);
      return list as unknown as T[];
    }

    return [];
  }
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function clearBrowserCategoryDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    return;
  }

  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(BROWSER_CATEGORY_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function runCategoryContractSuite(platform: 'android' | 'web'): void {
  describe(`CategoryRepository (${platform})`, () => {
    let repository: CategoryRepository;

    beforeEach(async () => {
      if (platform === 'web') {
        await clearBrowserCategoryDb();
      }

      spyOn(Capacitor, 'getPlatform').and.returnValue(platform);

      const nativeStub =
        platform === 'android'
          ? (new FakeNativeSqliteManager() as unknown as NativeSqliteManager)
          : ({
              isReady: () => true,
              initialize: async () => undefined,
              query: async () => [],
              execute: async () => undefined,
              runInTransaction: async (worker: (tx: SqliteTransactionContext) => Promise<unknown>) =>
                worker({
                  execute: async () => undefined,
                  query: async () => [],
                  runBatch: async () => undefined,
                }),
            } as unknown as NativeSqliteManager);

      TestBed.configureTestingModule({
        providers: [
          CategoryRepository,
          { provide: NativeSqliteManager, useValue: nativeStub },
        ],
      });

      repository = TestBed.inject(CategoryRepository);
    });

    it('creates, updates, archives and soft-deletes categories using the same contract', async () => {
      const created = await repository.createCategory({
        name: 'Focus',
        color: '#6366F1',
      });
      expect(created.name).toBe('Focus');
      expect(created.color).toBe('#6366F1');

      const updated = await repository.updateCategory(created.id, {
        name: 'Deep Work',
        color: '#2563EB',
      });
      expect(updated.name).toBe('Deep Work');
      expect(updated.color).toBe('#2563EB');

      await repository.archiveCategory(created.id);
      const activeAfterArchive = await repository.listCategories();
      expect(activeAfterArchive.length).toBe(0);
      const withArchived = await repository.listCategories({ includeArchived: true });
      expect(withArchived.length).toBe(1);
      expect(withArchived[0].isArchived).toBeTrue();

      await repository.deleteCategory(created.id);
      const activeAfterDelete = await repository.listCategories({
        includeArchived: true,
      });
      expect(activeAfterDelete.length).toBe(0);

      const withDeleted = await repository.listCategories({
        includeArchived: true,
        includeDeleted: true,
      });
      expect(withDeleted.length).toBe(1);
      expect(withDeleted[0].deletedAt).not.toBeNull();
    });

    it('assigns sort order based on max(active) + 1', async () => {
      const first = await repository.createCategory({
        name: 'One',
        color: '#6366F1',
      });
      const second = await repository.createCategory({
        name: 'Two',
        color: '#2563EB',
      });

      expect(first.sortOrder).toBe(0);
      expect(second.sortOrder).toBe(1);
    });

    it('reports a storage mode', () => {
      const mode = repository.getStorageMode();
      if (platform === 'android') {
        expect(mode).toBe('native-sqlite');
      } else if (typeof indexedDB === 'undefined') {
        expect(mode).toBe('memory-debug');
      } else {
        expect(mode).toBe('browser-indexeddb');
      }
    });
  });
}

describe('CategoryRepository parity', () => {
  runCategoryContractSuite('android');
  runCategoryContractSuite('web');
});
