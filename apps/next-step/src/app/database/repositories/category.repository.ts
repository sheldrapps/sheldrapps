import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativeSqliteManager } from '@sheldrapps/native-sqlite-kit';
import {
  CategoryNameValidationException,
  normalizeCategoryNameKey,
  validateCategoryName,
} from './category-name.validation';

export interface TaskCategory {
  id: string;
  name: string;
}

interface CategoryRow extends Record<string, unknown> {
  id: string;
  name: string;
}

const DEFAULT_CATEGORIES_SEEDED_META_KEY = 'default_categories_seeded';

@Injectable({ providedIn: 'root' })
export class CategoryRepository {
  private readonly sqliteManager = inject(NativeSqliteManager);
  private readonly inMemoryCategories: TaskCategory[] = [];
  private inMemoryDefaultCategoriesSeeded = false;

  async listCategories(): Promise<TaskCategory[]> {
    if (Capacitor.getPlatform() !== 'android') {
      return [...this.inMemoryCategories].sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }

    await this.ensureSqliteReady();

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

    if (Capacitor.getPlatform() !== 'android') {
      if (this.inMemoryDefaultCategoriesSeeded) {
        return this.listCategories();
      }

      if (this.inMemoryCategories.length === 0) {
        for (const name of normalizedDefaults) {
          this.inMemoryCategories.push({
            id: this.createUuid('cat'),
            name,
          });
        }
      }

      this.inMemoryDefaultCategoriesSeeded = true;
      return this.listCategories();
    }

    await this.ensureSqliteReady();
    await this.ensureCategoryMetaTable();
    const alreadySeeded = await this.hasDefaultCategoriesBeenSeeded();
    if (alreadySeeded) {
      return this.listCategories();
    }

    const existing = await this.listCategories();
    if (existing.length > 0 || normalizedDefaults.length === 0) {
      await this.markDefaultCategoriesAsSeeded();
      return existing;
    }

    const nowIso = new Date().toISOString();
    await this.sqliteManager.runInTransaction(async (tx) => {
      for (const name of normalizedDefaults) {
        await tx.execute(
          `
            INSERT INTO categories (id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `,
          [this.createUuid('cat'), name, nowIso, nowIso]
        );
      }

      await tx.execute(
        `
          INSERT OR REPLACE INTO category_meta (key, value, created_at, updated_at)
          VALUES (?, '1', ?, ?)
        `,
        [DEFAULT_CATEGORIES_SEEDED_META_KEY, nowIso, nowIso]
      );
    });

    return this.listCategories();
  }

  async createCategory(name: string): Promise<TaskCategory> {
    const existing = await this.listCategories();
    const validation = validateCategoryName(
      name,
      existing.map((category) => category.name)
    );
    if (validation.error) {
      throw new CategoryNameValidationException(validation.error);
    }

    const id = this.createUuid('cat');
    const category: TaskCategory = { id, name: validation.normalizedName };
    const createdAt = new Date().toISOString();

    if (Capacitor.getPlatform() !== 'android') {
      this.inMemoryCategories.push(category);
      return category;
    }

    await this.ensureSqliteReady();
    try {
      await this.sqliteManager.execute(
        `
          INSERT INTO categories (id, name, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `,
        [id, validation.normalizedName, createdAt, createdAt]
      );
    } catch (error: unknown) {
      if (this.isCategoryDuplicateConstraintError(error)) {
        throw new CategoryNameValidationException('duplicate');
      }
      throw error;
    }

    return category;
  }

  async getCategoryById(id: string): Promise<TaskCategory | null> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return null;
    }

    if (Capacitor.getPlatform() !== 'android') {
      return this.inMemoryCategories.find((category) => category.id === normalizedId) ?? null;
    }

    await this.ensureSqliteReady();
    const rows = await this.sqliteManager.query<CategoryRow>(
      `
        SELECT id, name
        FROM categories
        WHERE id = ?
        LIMIT 1
      `,
      [normalizedId]
    );
    const category = rows[0];
    if (!category) {
      return null;
    }

    return {
      id: category.id,
      name: category.name,
    };
  }

  async updateCategory(id: string, name: string): Promise<TaskCategory> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('Category id is required');
    }

    const existingCategory = await this.getCategoryById(normalizedId);
    if (!existingCategory) {
      throw new Error(`Category not found: ${normalizedId}`);
    }

    const categories = await this.listCategories();
    const validation = validateCategoryName(
      name,
      categories.map((category) => category.name),
      { excludeName: existingCategory.name }
    );
    if (validation.error) {
      throw new CategoryNameValidationException(validation.error);
    }

    const updatedCategory: TaskCategory = {
      id: existingCategory.id,
      name: validation.normalizedName,
    };

    if (Capacitor.getPlatform() !== 'android') {
      const index = this.inMemoryCategories.findIndex(
        (category) => category.id === normalizedId
      );
      if (index >= 0) {
        this.inMemoryCategories[index] = updatedCategory;
      }
      return updatedCategory;
    }

    await this.ensureSqliteReady();
    try {
      await this.sqliteManager.execute(
        `
          UPDATE categories
          SET
            name = ?,
            updated_at = ?
          WHERE id = ?
        `,
        [validation.normalizedName, new Date().toISOString(), normalizedId]
      );
    } catch (error: unknown) {
      if (this.isCategoryDuplicateConstraintError(error)) {
        throw new CategoryNameValidationException('duplicate');
      }
      throw error;
    }

    return updatedCategory;
  }

  async findCategoryByName(name: string): Promise<TaskCategory | null> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return null;
    }

    const normalizedKey = normalizeCategoryNameKey(normalizedName);
    const categories = await this.listCategories();
    return (
      categories.find(
        (category) => normalizeCategoryNameKey(category.name) === normalizedKey
      ) ?? null
    );
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const normalizedId = categoryId.trim();
    if (!normalizedId) {
      return;
    }

    if (Capacitor.getPlatform() !== 'android') {
      const index = this.inMemoryCategories.findIndex(
        (category) => category.id === normalizedId
      );
      if (index > -1) {
        this.inMemoryCategories.splice(index, 1);
      }
      return;
    }

    await this.ensureSqliteReady();

    await this.sqliteManager.execute(
      `
        DELETE FROM categories
        WHERE id = ?
      `,
      [normalizedId]
    );
  }

  async deleteCategoryById(categoryId: string): Promise<void> {
    await this.deleteCategory(categoryId);
  }

  private normalizeDefaultNames(defaultNames: readonly string[]): string[] {
    const unique = new Set<string>();
    const normalized: string[] = [];

    for (const rawName of defaultNames) {
      const name = rawName.trim();
      if (!name) {
        continue;
      }

      const key = normalizeCategoryNameKey(name);
      if (unique.has(key)) {
        continue;
      }

      unique.add(key);
      normalized.push(name);
    }

    return normalized;
  }

  private async ensureSqliteReady(): Promise<void> {
    if (!this.sqliteManager.isReady()) {
      await this.sqliteManager.initialize();
    }
  }

  private async ensureCategoryMetaTable(): Promise<void> {
    await this.sqliteManager.execute(`
      CREATE TABLE IF NOT EXISTS category_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  private async hasDefaultCategoriesBeenSeeded(): Promise<boolean> {
    const rows = await this.sqliteManager.query<{ value: string }>(
      `
        SELECT value
        FROM category_meta
        WHERE key = ?
        LIMIT 1
      `,
      [DEFAULT_CATEGORIES_SEEDED_META_KEY]
    );
    return rows[0]?.value === '1';
  }

  private async markDefaultCategoriesAsSeeded(): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.sqliteManager.execute(
      `
        INSERT OR REPLACE INTO category_meta (key, value, created_at, updated_at)
        VALUES (?, '1', ?, ?)
      `,
      [DEFAULT_CATEGORIES_SEEDED_META_KEY, nowIso, nowIso]
    );
  }

  private isCategoryDuplicateConstraintError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('unique constraint failed: categories.name') ||
      message.includes('idx_categories_name_ci')
    );
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
