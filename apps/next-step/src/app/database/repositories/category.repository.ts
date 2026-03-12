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
  private readonly inMemoryCategories: TaskCategory[] = [];

  async listCategories(): Promise<TaskCategory[]> {
    if (Capacitor.getPlatform() !== 'android') {
      return [...this.inMemoryCategories].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }

    if (!this.sqliteManager.isReady()) {
      await this.sqliteManager.initialize();
    }

    const rows = await this.sqliteManager.query<CategoryRow>(`
      SELECT id, name
      FROM categories
      ORDER BY name COLLATE NOCASE ASC
    `);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));
  }

  async ensureDefaultCategories(defaultNames: readonly string[]): Promise<TaskCategory[]> {
    const normalizedDefaults = this.normalizeDefaultNames(defaultNames);
    if (normalizedDefaults.length === 0) {
      return this.listCategories();
    }

    const existing = await this.listCategories();
    const existingNames = new Set(existing.map((category) => this.normalizeName(category.name)));

    for (const name of normalizedDefaults) {
      if (existingNames.has(this.normalizeName(name))) {
        continue;
      }

      await this.createCategory(name);
      existingNames.add(this.normalizeName(name));
    }

    return this.listCategories();
  }

  async createCategory(name: string): Promise<TaskCategory> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error('Category name is required');
    }

    const id = this.createUuid('cat');
    const category: TaskCategory = { id, name: normalizedName };
    const createdAt = new Date().toISOString();

    if (Capacitor.getPlatform() !== 'android') {
      this.inMemoryCategories.push(category);
      return category;
    }

    if (!this.sqliteManager.isReady()) {
      await this.sqliteManager.initialize();
    }

    await this.sqliteManager.execute(
      `
        INSERT INTO categories (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
      [id, normalizedName, createdAt, createdAt]
    );

    return category;
  }

  private normalizeDefaultNames(defaultNames: readonly string[]): string[] {
    const unique = new Set<string>();
    const normalized: string[] = [];

    for (const rawName of defaultNames) {
      const name = rawName.trim();
      if (!name) {
        continue;
      }

      const key = this.normalizeName(name);
      if (unique.has(key)) {
        continue;
      }

      unique.add(key);
      normalized.push(name);
    }

    return normalized;
  }

  private normalizeName(name: string): string {
    return name.trim().toLocaleLowerCase();
  }

  private createUuid(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch {
        // Fall through to timestamp-based id.
      }
    }

    return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  }
}
