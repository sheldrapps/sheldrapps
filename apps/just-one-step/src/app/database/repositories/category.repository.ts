import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativeSqliteManager } from '@sheldrapps/native-sqlite-kit';
import { environment } from '../../../environments/environment';
import {
  CategoryNameValidationException,
  normalizeCategoryNameKey,
  validateCategoryName,
} from './category-name.validation';

export type CategoryOrigin = 'seeded' | 'user';
export type CategoryStorageMode =
  | 'native-sqlite'
  | 'browser-indexeddb'
  | 'memory-debug';
export type DeleteCategoryStrategy = 'clear' | 'reassign';

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  origin: CategoryOrigin;
  seedKey: string | null;
}

export interface CategoryListOptions {
  includeArchived?: boolean;
  includeDeleted?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  color: string;
  icon?: string | null;
  description?: string | null;
  origin?: CategoryOrigin;
  seedKey?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  icon?: string | null;
  description?: string | null;
}

export interface DeleteCategoryOptions {
  strategy?: DeleteCategoryStrategy;
  targetCategoryId?: string | null;
}

export interface CategoryRepositoryDebugEvent {
  event: string;
  mode: CategoryStorageMode;
  at: string;
  payload?: Record<string, unknown>;
  error?: string;
}

interface CategoryRow extends Record<string, unknown> {
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

interface SeedCategoryDefinition {
  name: string;
  color: string;
  sortOrder: number;
  seedKey: string | null;
}

const DEFAULT_CATEGORIES_SEEDED_META_KEY = 'default_categories_seeded';
const DEBUG_PREFIX = '[just-one-step][categories-repository]';
const DEFAULT_SEEDED_CATEGORY_KEYS = [
  'DEFAULT_CATEGORY_PERSONAL',
  'DEFAULT_CATEGORY_WORK',
  'DEFAULT_CATEGORY_HEALTH',
  'DEFAULT_CATEGORY_STUDY',
  'DEFAULT_CATEGORY_HOME',
] as const;
const DEFAULT_SEEDED_CATEGORY_COLORS = [
  '#6366F1',
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#EC4899',
] as const;
const DEFAULT_USER_CATEGORY_COLOR = DEFAULT_SEEDED_CATEGORY_COLORS[0];

export const CATEGORY_COLOR_PALETTE = [
  '#6366F1',
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#14B8A6',
  '#4F46E5',
  '#4338CA',
  '#312E81',
  '#818CF8',
  '#A5B4FC',
  '#3B82F6',
  '#60A5FA',
  '#1D4ED8',
  '#1E40AF',
  '#0284C7',
  '#38BDF8',
  '#0EA5E9',
  '#22D3EE',
  '#0891B2',
  '#0E7490',
  '#06B6D4',
  '#22C55E',
  '#16A34A',
  '#34D399',
  '#059669',
  '#15803D',
  '#4ADE80',
  '#84CC16',
  '#65A30D',
  '#FBBF24',
  '#D97706',
  '#FCD34D',
  '#CA8A04',
  '#EAB308',
  '#F97316',
  '#FB923C',
  '#EA580C',
  '#C2410C',
  '#FDBA74',
  '#DC2626',
  '#F87171',
  '#B91C1C',
  '#991B1B',
  '#FB7185',
  '#E11D48',
  '#DB2777',
  '#F472B6',
  '#BE185D',
  '#F9A8D4',
  '#D946EF',
  '#E879F9',
  '#A855F7',
  '#7C3AED',
  '#6D28D9',
  '#A78BFA',
  '#C4B5FD',
  '#334155',
  '#475569',
  '#64748B',
  '#1F2937',
  '#111827',
] as const;
export const BROWSER_CATEGORY_DB_NAME = 'just-one-step-categories-debug';

@Injectable({ providedIn: 'root' })
export class CategoryRepository {
  private readonly sqliteManager = inject(NativeSqliteManager);
  private readonly inMemoryCategories = new Map<string, TaskCategory>();
  private inMemoryDefaultCategoriesSeeded = false;
  private readonly debugEnabled = environment.debugDatabase === true;

  private browserFallbackToMemory = false;
  private browserDbPromise: Promise<IDBDatabase> | null = null;
  private lastDebugEvent: CategoryRepositoryDebugEvent | null = null;

  constructor() {
    this.emitDebug('categories.repository.mode', {
      storageMode: this.getStorageMode(),
    });
  }

  getStorageMode(): CategoryStorageMode {
    if (this.isNativeMode()) {
      return 'native-sqlite';
    }

    if (this.shouldUseIndexedDb()) {
      return 'browser-indexeddb';
    }

    return 'memory-debug';
  }

  getLastDebugEvent(): CategoryRepositoryDebugEvent | null {
    return this.lastDebugEvent;
  }

  async listCategories(options: CategoryListOptions = {}): Promise<TaskCategory[]> {
    return this.runOperation(
      'categories.list',
      {
        options,
        operation: this.resolveOperationLabel('listCategories'),
      },
      async () => {
        if (this.isNativeMode()) {
          return this.listCategoriesNative(options);
        }

        return this.listCategoriesBrowser(options);
      }
    );
  }

  async ensureDefaultCategories(defaultNames: readonly string[]): Promise<TaskCategory[]> {
    const definitions = this.resolveSeedDefinitions(defaultNames);
    return this.runOperation(
      'categories.seedDefaults',
      {
        inputCount: defaultNames.length,
        normalizedCount: definitions.length,
        operation: this.resolveOperationLabel('ensureDefaultCategories'),
      },
      async () => {
        if (this.isNativeMode()) {
          return this.ensureDefaultCategoriesNative(definitions);
        }

        return this.ensureDefaultCategoriesBrowser(definitions);
      }
    );
  }

  async createCategory(input: string | CreateCategoryInput): Promise<TaskCategory> {
    return this.runOperation(
      'categories.create',
      {
        input:
          typeof input === 'string'
            ? { name: input, color: DEFAULT_USER_CATEGORY_COLOR }
            : input,
        operation: this.resolveOperationLabel('createCategory'),
      },
      async () => {
        const normalized = await this.normalizeCreateInput(input);
        if (this.isNativeMode()) {
          return this.createCategoryNative(normalized);
        }

        return this.createCategoryBrowser(normalized);
      }
    );
  }

  async getCategoryById(id: string): Promise<TaskCategory | null> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return null;
    }

    return this.runOperation(
      'categories.getById',
      {
        id: normalizedId,
        operation: this.resolveOperationLabel('getCategoryById'),
      },
      async () => {
        if (this.isNativeMode()) {
          const rows = await this.sqliteManager.query<CategoryRow>(
            `
              SELECT
                id,
                name,
                color,
                icon,
                description,
                sort_order,
                is_archived,
                origin,
                seed_key,
                created_at,
                updated_at,
                deleted_at
              FROM categories
              WHERE id = ? AND deleted_at IS NULL
              LIMIT 1
            `,
            [normalizedId]
          );
          return rows[0] ? mapCategoryRow(rows[0]) : null;
        }

        const category = await this.getBrowserCategoryById(normalizedId);
        if (!category || category.deletedAt !== null) {
          return null;
        }
        return category;
      }
    );
  }

  async updateCategory(id: string, patch: string | UpdateCategoryInput): Promise<TaskCategory> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('Category id is required');
    }

    return this.runOperation(
      'categories.update',
      {
        id: normalizedId,
        patch: typeof patch === 'string' ? { name: patch } : patch,
        operation: this.resolveOperationLabel('updateCategory'),
      },
      async () => {
        const existing = await this.getCategoryById(normalizedId);
        if (!existing) {
          throw new Error(`Category not found: ${normalizedId}`);
        }

        const requested = typeof patch === 'string' ? { name: patch } : patch;
        const normalizedName = await this.normalizeUpdatedName(
          requested.name,
          existing.name,
          existing.id
        );
        const color =
          requested.color === undefined
            ? existing.color
            : this.normalizeColor(requested.color);
        const icon =
          requested.icon === undefined
            ? existing.icon
            : this.normalizeOptionalText(requested.icon);
        const description =
          requested.description === undefined
            ? existing.description
            : this.normalizeOptionalText(requested.description);
        const updatedAt = new Date().toISOString();

        const updated: TaskCategory = {
          ...existing,
          name: normalizedName,
          color,
          icon,
          description,
          updatedAt,
        };

        if (this.isNativeMode()) {
          await this.ensureSqliteReady();
          await this.sqliteManager.execute(
            `
              UPDATE categories
              SET
                name = ?,
                color = ?,
                icon = ?,
                description = ?,
                updated_at = ?
              WHERE id = ? AND deleted_at IS NULL
            `,
            [updated.name, updated.color, updated.icon, updated.description, updatedAt, normalizedId]
          );
          return updated;
        }

        await this.putBrowserCategory(updated);
        return updated;
      }
    );
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
  async archiveCategory(categoryId: string): Promise<void> {
    const normalizedId = categoryId.trim();
    if (!normalizedId) {
      return;
    }

    await this.runOperation(
      'categories.archive',
      {
        categoryId: normalizedId,
        operation: this.resolveOperationLabel('archiveCategory'),
      },
      async () => {
        if (this.isNativeMode()) {
          await this.ensureSqliteReady();
          await this.sqliteManager.execute(
            `
              UPDATE categories
              SET is_archived = 1, updated_at = ?
              WHERE id = ? AND deleted_at IS NULL
            `,
            [new Date().toISOString(), normalizedId]
          );
          return;
        }

        const category = await this.getBrowserCategoryById(normalizedId);
        if (!category || category.deletedAt !== null) {
          return;
        }

        await this.putBrowserCategory({
          ...category,
          isArchived: true,
          updatedAt: new Date().toISOString(),
        });
      }
    );
  }

  async restoreCategory(categoryId: string): Promise<void> {
    const normalizedId = categoryId.trim();
    if (!normalizedId) {
      return;
    }

    await this.runOperation(
      'categories.restore',
      {
        categoryId: normalizedId,
        operation: this.resolveOperationLabel('restoreCategory'),
      },
      async () => {
        if (this.isNativeMode()) {
          await this.ensureSqliteReady();
          await this.sqliteManager.execute(
            `
              UPDATE categories
              SET is_archived = 0, updated_at = ?
              WHERE id = ? AND deleted_at IS NULL
            `,
            [new Date().toISOString(), normalizedId]
          );
          return;
        }

        const category = await this.getBrowserCategoryById(normalizedId);
        if (!category || category.deletedAt !== null) {
          return;
        }

        await this.putBrowserCategory({
          ...category,
          isArchived: false,
          updatedAt: new Date().toISOString(),
        });
      }
    );
  }

  async deleteCategory(categoryId: string, options: DeleteCategoryOptions = {}): Promise<void> {
    const normalizedId = categoryId.trim();
    if (!normalizedId) {
      return;
    }

    const strategy = options.strategy === 'reassign' ? 'reassign' : 'clear';
    const targetCategoryId =
      strategy === 'reassign' ? options.targetCategoryId?.trim() ?? null : null;
    if (strategy === 'reassign' && !targetCategoryId) {
      throw new Error('targetCategoryId is required when strategy is reassign.');
    }
    if (strategy === 'reassign' && targetCategoryId === normalizedId) {
      throw new Error('Category cannot be reassigned to itself.');
    }

    await this.runOperation(
      'categories.delete',
      {
        categoryId: normalizedId,
        strategy,
        targetCategoryId,
        operation: this.resolveOperationLabel('deleteCategory'),
      },
      async () => {
        const nowIso = new Date().toISOString();

        if (this.isNativeMode()) {
          await this.ensureSqliteReady();
          await this.sqliteManager.runInTransaction(async (tx) => {
            if (strategy === 'reassign' && targetCategoryId) {
              await tx.execute(
                `
                  UPDATE tasks
                  SET category_id = ?
                  WHERE category_id = ?
                `,
                [targetCategoryId, normalizedId]
              );
            } else {
              await tx.execute(
                `
                  UPDATE tasks
                  SET category_id = NULL
                  WHERE category_id = ?
                `,
                [normalizedId]
              );
            }

            await tx.execute(
              `
                UPDATE categories
                SET deleted_at = ?, is_archived = 1, updated_at = ?
                WHERE id = ? AND deleted_at IS NULL
              `,
              [nowIso, nowIso, normalizedId]
            );
          });
          return;
        }

        const category = await this.getBrowserCategoryById(normalizedId);
        if (!category || category.deletedAt !== null) {
          return;
        }

        await this.putBrowserCategory({
          ...category,
          isArchived: true,
          updatedAt: nowIso,
          deletedAt: nowIso,
        });
      }
    );
  }

  async deleteCategoryById(categoryId: string): Promise<void> {
    await this.deleteCategory(categoryId);
  }

  async reorderCategories(idsInOrder: readonly string[]): Promise<void> {
    const normalizedIds = Array.from(
      new Set(idsInOrder.map((id) => id.trim()).filter((id) => id.length > 0))
    );
    if (normalizedIds.length === 0) {
      return;
    }

    await this.runOperation(
      'categories.reorder',
      {
        idsInOrder: normalizedIds,
        operation: this.resolveOperationLabel('reorderCategories'),
      },
      async () => {
        const nowIso = new Date().toISOString();

        if (this.isNativeMode()) {
          await this.ensureSqliteReady();
          await this.sqliteManager.runInTransaction(async (tx) => {
            for (const [index, id] of normalizedIds.entries()) {
              await tx.execute(
                `
                  UPDATE categories
                  SET sort_order = ?, updated_at = ?
                  WHERE id = ? AND deleted_at IS NULL
                `,
                [index, nowIso, id]
              );
            }
          });
          return;
        }

        const categories = await this.getAllBrowserCategories();
        const activeById = new Map(
          categories
            .filter((category) => category.deletedAt === null)
            .map((category) => [category.id, category])
        );

        for (const [index, id] of normalizedIds.entries()) {
          const existing = activeById.get(id);
          if (!existing) {
            continue;
          }

          await this.putBrowserCategory({
            ...existing,
            sortOrder: index,
            updatedAt: nowIso,
          });
        }
      }
    );
  }

  private async listCategoriesNative(options: CategoryListOptions): Promise<TaskCategory[]> {
    await this.ensureSqliteReady();

    const whereClauses: string[] = [];
    if (!options.includeDeleted) {
      whereClauses.push('deleted_at IS NULL');
    }
    if (!options.includeArchived) {
      whereClauses.push('is_archived = 0');
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await this.sqliteManager.query<CategoryRow>(`
      SELECT
        id,
        name,
        color,
        icon,
        description,
        sort_order,
        is_archived,
        origin,
        seed_key,
        created_at,
        updated_at,
        deleted_at
      FROM categories
      ${whereSql}
      ORDER BY sort_order ASC, created_at ASC, name COLLATE NOCASE ASC
    `);

    return rows.map((row) => mapCategoryRow(row));
  }

  private async listCategoriesBrowser(options: CategoryListOptions): Promise<TaskCategory[]> {
    const categories = await this.getAllBrowserCategories();
    return sortAndFilterCategories(categories, options);
  }

  private async ensureDefaultCategoriesNative(
    defaultDefinitions: readonly SeedCategoryDefinition[]
  ): Promise<TaskCategory[]> {
    await this.ensureSqliteReady();
    await this.ensureCategoryMetaTable();

    const seeded = await this.hasDefaultCategoriesBeenSeeded();
    if (seeded) {
      return this.listCategoriesNative({});
    }

    const existing = await this.listCategoriesNative({
      includeArchived: true,
      includeDeleted: false,
    });
    if (existing.length > 0 || defaultDefinitions.length === 0) {
      await this.markDefaultCategoriesAsSeeded();
      return existing;
    }

    const nowIso = new Date().toISOString();
    await this.sqliteManager.runInTransaction(async (tx) => {
      for (const definition of defaultDefinitions) {
        await tx.execute(
          `
            INSERT INTO categories (
              id,
              name,
              color,
              icon,
              description,
              sort_order,
              is_archived,
              origin,
              seed_key,
              created_at,
              updated_at,
              deleted_at
            )
            VALUES (?, ?, ?, NULL, NULL, ?, 0, 'seeded', ?, ?, ?, NULL)
          `,
          [
            createUuid('cat'),
            definition.name,
            definition.color,
            definition.sortOrder,
            definition.seedKey,
            nowIso,
            nowIso,
          ]
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

    return this.listCategoriesNative({});
  }
  private async ensureDefaultCategoriesBrowser(
    defaultDefinitions: readonly SeedCategoryDefinition[]
  ): Promise<TaskCategory[]> {
    if (!this.shouldUseIndexedDb()) {
      return this.ensureDefaultCategoriesMemory(defaultDefinitions);
    }

    try {
      const seeded = (await this.getBrowserMetaValue(DEFAULT_CATEGORIES_SEEDED_META_KEY)) === '1';
      if (seeded) {
        return this.listCategoriesBrowser({});
      }

      const existing = await this.listCategoriesBrowser({
        includeArchived: true,
        includeDeleted: false,
      });
      if (existing.length > 0 || defaultDefinitions.length === 0) {
        await this.setBrowserMetaValue(DEFAULT_CATEGORIES_SEEDED_META_KEY, '1');
        return existing;
      }

      const nowIso = new Date().toISOString();
      for (const definition of defaultDefinitions) {
        await this.putBrowserCategory({
          id: createUuid('cat'),
          name: definition.name,
          color: definition.color,
          icon: null,
          description: null,
          sortOrder: definition.sortOrder,
          isArchived: false,
          origin: 'seeded',
          seedKey: definition.seedKey,
          createdAt: nowIso,
          updatedAt: nowIso,
          deletedAt: null,
        });
      }

      await this.setBrowserMetaValue(DEFAULT_CATEGORIES_SEEDED_META_KEY, '1');
      return this.listCategoriesBrowser({});
    } catch {
      this.browserFallbackToMemory = true;
      return this.ensureDefaultCategoriesMemory(defaultDefinitions);
    }
  }

  private async ensureDefaultCategoriesMemory(
    defaultDefinitions: readonly SeedCategoryDefinition[]
  ): Promise<TaskCategory[]> {
    if (this.inMemoryDefaultCategoriesSeeded) {
      return this.listCategoriesMemory({});
    }

    const existing = await this.listCategoriesMemory({
      includeArchived: true,
      includeDeleted: false,
    });
    if (existing.length > 0 || defaultDefinitions.length === 0) {
      this.inMemoryDefaultCategoriesSeeded = true;
      return existing;
    }

    const nowIso = new Date().toISOString();
    for (const definition of defaultDefinitions) {
      const seeded: TaskCategory = {
        id: createUuid('cat'),
        name: definition.name,
        color: definition.color,
        icon: null,
        description: null,
        sortOrder: definition.sortOrder,
        isArchived: false,
        origin: 'seeded',
        seedKey: definition.seedKey,
        createdAt: nowIso,
        updatedAt: nowIso,
        deletedAt: null,
      };
      this.inMemoryCategories.set(seeded.id, seeded);
    }

    this.inMemoryDefaultCategoriesSeeded = true;
    return this.listCategoriesMemory({});
  }

  private async createCategoryNative(input: {
    name: string;
    color: string;
    icon: string | null;
    description: string | null;
    origin: CategoryOrigin;
    seedKey: string | null;
  }): Promise<TaskCategory> {
    await this.ensureSqliteReady();
    const nowIso = new Date().toISOString();
    const id = createUuid('cat');
    const sortOrder = await this.resolveNextSortOrderNative();

    await this.sqliteManager.execute(
      `
        INSERT INTO categories (
          id,
          name,
          color,
          icon,
          description,
          sort_order,
          is_archived,
          origin,
          seed_key,
          created_at,
          updated_at,
          deleted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NULL)
      `,
      [
        id,
        input.name,
        input.color,
        input.icon,
        input.description,
        sortOrder,
        input.origin,
        input.seedKey,
        nowIso,
        nowIso,
      ]
    );

    return {
      id,
      name: input.name,
      color: input.color,
      icon: input.icon,
      description: input.description,
      sortOrder,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
      origin: input.origin,
      seedKey: input.seedKey,
    };
  }

  private async createCategoryBrowser(input: {
    name: string;
    color: string;
    icon: string | null;
    description: string | null;
    origin: CategoryOrigin;
    seedKey: string | null;
  }): Promise<TaskCategory> {
    const nowIso = new Date().toISOString();
    const sortOrder = await this.resolveNextSortOrderBrowser();
    const category: TaskCategory = {
      id: createUuid('cat'),
      name: input.name,
      color: input.color,
      icon: input.icon,
      description: input.description,
      sortOrder,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
      origin: input.origin,
      seedKey: input.seedKey,
    };
    await this.putBrowserCategory(category);
    return category;
  }

  private async normalizeCreateInput(
    input: string | CreateCategoryInput
  ): Promise<{
    name: string;
    color: string;
    icon: string | null;
    description: string | null;
    origin: CategoryOrigin;
    seedKey: string | null;
  }> {
    const requested =
      typeof input === 'string'
        ? {
            name: input,
            color: DEFAULT_USER_CATEGORY_COLOR,
            icon: null,
            description: null,
            origin: 'user' as CategoryOrigin,
            seedKey: null,
          }
        : input;

    const existingNames = (await this.listCategories()).map((category) => category.name);
    const validation = validateCategoryName(requested.name, existingNames);
    if (validation.error) {
      throw new CategoryNameValidationException(validation.error);
    }

    return {
      name: validation.normalizedName,
      color: this.normalizeColor(requested.color),
      icon: this.normalizeOptionalText(requested.icon),
      description: this.normalizeOptionalText(requested.description),
      origin: requested.origin === 'seeded' ? 'seeded' : 'user',
      seedKey: this.normalizeOptionalText(requested.seedKey),
    };
  }

  private async normalizeUpdatedName(
    requestedName: string | undefined,
    existingName: string,
    categoryId: string
  ): Promise<string> {
    if (requestedName === undefined) {
      return existingName;
    }

    const names = (await this.listCategories())
      .filter((category) => category.id !== categoryId)
      .map((category) => category.name);
    const validation = validateCategoryName(requestedName, names, {
      excludeName: existingName,
    });
    if (validation.error) {
      throw new CategoryNameValidationException(validation.error);
    }

    return validation.normalizedName;
  }

  private resolveSeedDefinitions(defaultNames: readonly string[]): SeedCategoryDefinition[] {
    const unique = new Set<string>();
    const normalized: SeedCategoryDefinition[] = [];

    for (const [index, rawName] of defaultNames.entries()) {
      const trimmed = rawName.trim();
      if (!trimmed) {
        continue;
      }

      const key = normalizeCategoryNameKey(trimmed);
      if (unique.has(key)) {
        continue;
      }
      unique.add(key);

      normalized.push({
        name: trimmed,
        color:
          DEFAULT_SEEDED_CATEGORY_COLORS[
            index % DEFAULT_SEEDED_CATEGORY_COLORS.length
          ],
        sortOrder: index,
        seedKey: DEFAULT_SEEDED_CATEGORY_KEYS[index] ?? null,
      });
    }

    return normalized;
  }

  private normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeColor(rawColor: string): string {
    const normalized = rawColor.trim().toUpperCase();
    if (!normalized) {
      throw new Error('Category color is required.');
    }

    const allowed = new Set(CATEGORY_COLOR_PALETTE.map((color) => color.toUpperCase()));
    if (!allowed.has(normalized)) {
      throw new Error(`Unsupported category color: ${rawColor}`);
    }

    return normalized;
  }

  private async resolveNextSortOrderNative(): Promise<number> {
    await this.ensureSqliteReady();
    const rows = await this.sqliteManager.query<{ max_sort_order: number | null }>(
      `
        SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order
        FROM categories
        WHERE deleted_at IS NULL AND is_archived = 0
      `
    );
    const maxSortOrder = Number(rows[0]?.max_sort_order ?? -1);
    return Number.isFinite(maxSortOrder) ? maxSortOrder + 1 : 0;
  }
  private async resolveNextSortOrderBrowser(): Promise<number> {
    const categories = await this.getAllBrowserCategories();
    const maxSortOrder = categories
      .filter((category) => category.deletedAt === null && !category.isArchived)
      .reduce((max, category) => Math.max(max, category.sortOrder), -1);
    return maxSortOrder + 1;
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

  private async getAllBrowserCategories(): Promise<TaskCategory[]> {
    if (!this.shouldUseIndexedDb()) {
      return this.listCategoriesMemory({ includeArchived: true, includeDeleted: true });
    }

    try {
      return await this.withBrowserStore<TaskCategory[]>('categories', 'readonly', (store) =>
        toPromise<TaskCategory[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => {
            const rows = Array.isArray(request.result)
              ? (request.result as TaskCategory[])
              : [];
            resolve(rows.map((row) => ({ ...row })));
          };
          request.onerror = () =>
            reject(request.error ?? new Error('IndexedDB categories getAll failed.'));
        })
      );
    } catch {
      this.browserFallbackToMemory = true;
      return this.listCategoriesMemory({ includeArchived: true, includeDeleted: true });
    }
  }

  private async getBrowserCategoryById(id: string): Promise<TaskCategory | null> {
    if (!this.shouldUseIndexedDb()) {
      return this.inMemoryCategories.get(id) ?? null;
    }

    try {
      return await this.withBrowserStore<TaskCategory | null>('categories', 'readonly', (store) =>
        toPromise<TaskCategory | null>((resolve, reject) => {
          const request = store.get(id);
          request.onsuccess = () => {
            const row = request.result as TaskCategory | undefined;
            resolve(row ? { ...row } : null);
          };
          request.onerror = () =>
            reject(request.error ?? new Error('IndexedDB categories get failed.'));
        })
      );
    } catch {
      this.browserFallbackToMemory = true;
      return this.inMemoryCategories.get(id) ?? null;
    }
  }

  private async putBrowserCategory(category: TaskCategory): Promise<void> {
    if (!this.shouldUseIndexedDb()) {
      this.inMemoryCategories.set(category.id, { ...category });
      return;
    }

    try {
      await this.withBrowserStore<void>('categories', 'readwrite', (store) =>
        toPromise<void>((resolve, reject) => {
          const request = store.put(category);
          request.onsuccess = () => resolve();
          request.onerror = () =>
            reject(request.error ?? new Error('IndexedDB categories put failed.'));
        })
      );
    } catch {
      this.browserFallbackToMemory = true;
      this.inMemoryCategories.set(category.id, { ...category });
    }
  }

  private async getBrowserMetaValue(key: string): Promise<string | null> {
    if (!this.shouldUseIndexedDb()) {
      return this.inMemoryDefaultCategoriesSeeded ? '1' : null;
    }

    try {
      return await this.withBrowserStore<string | null>('meta', 'readonly', (store) =>
        toPromise<string | null>((resolve, reject) => {
          const request = store.get(key);
          request.onsuccess = () => {
            const row = request.result as { key: string; value: string } | undefined;
            resolve(typeof row?.value === 'string' ? row.value : null);
          };
          request.onerror = () =>
            reject(request.error ?? new Error('IndexedDB meta get failed.'));
        })
      );
    } catch {
      this.browserFallbackToMemory = true;
      return this.inMemoryDefaultCategoriesSeeded ? '1' : null;
    }
  }

  private async setBrowserMetaValue(key: string, value: string): Promise<void> {
    if (!this.shouldUseIndexedDb()) {
      if (key === DEFAULT_CATEGORIES_SEEDED_META_KEY && value === '1') {
        this.inMemoryDefaultCategoriesSeeded = true;
      }
      return;
    }

    try {
      await this.withBrowserStore<void>('meta', 'readwrite', (store) =>
        toPromise<void>((resolve, reject) => {
          const request = store.put({ key, value });
          request.onsuccess = () => resolve();
          request.onerror = () =>
            reject(request.error ?? new Error('IndexedDB meta put failed.'));
        })
      );
    } catch {
      this.browserFallbackToMemory = true;
      if (key === DEFAULT_CATEGORIES_SEEDED_META_KEY && value === '1') {
        this.inMemoryDefaultCategoriesSeeded = true;
      }
    }
  }

  private async withBrowserStore<T>(
    storeName: 'categories' | 'meta',
    mode: IDBTransactionMode,
    worker: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    const db = await this.openBrowserDatabase();
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return worker(store);
  }

  private async openBrowserDatabase(): Promise<IDBDatabase> {
    if (this.browserDbPromise) {
      return this.browserDbPromise;
    }

    this.browserDbPromise = toPromise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(BROWSER_CATEGORY_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    });

    return this.browserDbPromise;
  }

  private async listCategoriesMemory(options: CategoryListOptions): Promise<TaskCategory[]> {
    return sortAndFilterCategories([...this.inMemoryCategories.values()], options);
  }

  private isNativeMode(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  private shouldUseIndexedDb(): boolean {
    return !this.browserFallbackToMemory && typeof indexedDB !== 'undefined';
  }

  private resolveOperationLabel(methodName: string): string {
    return this.isNativeMode() ? `sql:${methodName}` : `indexeddb:${methodName}`;
  }

  private async runOperation<T>(
    eventBase: string,
    payload: Record<string, unknown>,
    worker: () => Promise<T>
  ): Promise<T> {
    const startedAt = Date.now();
    this.emitDebug(`${eventBase}.start`, payload);
    try {
      const result = await worker();
      this.emitDebug(`${eventBase}.success`, {
        ...payload,
        durationMs: Date.now() - startedAt,
        result: this.toDebugSummary(result),
      });
      return result;
    } catch (error: unknown) {
      this.emitDebug(
        `${eventBase}.error`,
        {
          ...payload,
          durationMs: Date.now() - startedAt,
        },
        error
      );
      throw error;
    }
  }

  private toDebugSummary(value: unknown): unknown {
    if (Array.isArray(value)) {
      return { itemCount: value.length };
    }
    return value ?? null;
  }

  private emitDebug(
    event: string,
    payload?: Record<string, unknown>,
    error?: unknown
  ): void {
    if (!this.debugEnabled) {
      return;
    }

    const debugEvent: CategoryRepositoryDebugEvent = {
      event,
      mode: this.getStorageMode(),
      at: new Date().toISOString(),
      payload,
      error: error instanceof Error ? error.message : undefined,
    };
    this.lastDebugEvent = debugEvent;

    if (error) {
      console.error(DEBUG_PREFIX, event, {
        mode: debugEvent.mode,
        payload,
        error,
      });
      return;
    }

    console.info(DEBUG_PREFIX, event, {
      mode: debugEvent.mode,
      payload,
    });
  }
}

function mapCategoryRow(row: CategoryRow): TaskCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: normalizeNullableText(row.icon),
    description: normalizeNullableText(row.description),
    sortOrder: toSafeInteger(row.sort_order, 0),
    isArchived: toBooleanFlag(row.is_archived),
    createdAt: resolveIsoDate(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: resolveIsoDate(row.updated_at) ?? new Date(0).toISOString(),
    deletedAt: resolveIsoDate(row.deleted_at),
    origin: row.origin === 'seeded' ? 'seeded' : 'user',
    seedKey: normalizeNullableText(row.seed_key),
  };
}

function sortAndFilterCategories(
  categories: readonly TaskCategory[],
  options: CategoryListOptions = {}
): TaskCategory[] {
  const includeDeleted = options.includeDeleted === true;
  const includeArchived = options.includeArchived === true;

  const filtered = categories.filter((category) => {
    if (!includeDeleted && category.deletedAt !== null) {
      return false;
    }
    if (!includeArchived && category.isArchived) {
      return false;
    }
    return true;
  });

  return [...filtered]
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      const byCreatedAt = a.createdAt.localeCompare(b.createdAt);
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    })
    .map((category) => ({ ...category }));
}

function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function toBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true';
  }

  return false;
}

function toSafeInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  return fallback;
}

function createUuid(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Falls back when randomUUID is unavailable.
    }
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function toPromise<T>(
  worker: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    worker(resolve, reject);
  });
}
