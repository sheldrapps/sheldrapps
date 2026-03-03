/**
 * Settings store implementation
 * Manages settings loading, persistence, and migrations
 */

import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import {
  SettingsSchema,
  SettingsPayload,
  Migration,
  MigrationContext,
  LegacyReader,
} from '../types';
import { StorageAdapter } from '../storage';
import {
  SETTINGS_STORAGE_ADAPTER_TOKEN,
  SETTINGS_KIT_CONFIG_TOKEN,
  SETTINGS_SCHEMA_TOKEN,
  SettingsKitConfig,
} from '../providers';

@Injectable()
export class SettingsStore<T extends object> {
  private readonly storageKey: string;
  private readonly schema: SettingsSchema<T>;
  private readonly storage: StorageAdapter;
  private readonly legacyStorage: StorageAdapter;
  private readonly subject: BehaviorSubject<T>;
  private loaded = false;
  private loading: Promise<T> | null = null;

  constructor(
    @Inject(SETTINGS_KIT_CONFIG_TOKEN) config: SettingsKitConfig,
    @Inject(SETTINGS_SCHEMA_TOKEN) schema: SettingsSchema<T>,
    @Inject(SETTINGS_STORAGE_ADAPTER_TOKEN) storage: StorageAdapter
  ) {
    this.storageKey = config.storageKey || `${config.appId}.settings`;
    this.schema = schema;
    this.storage = storage;
    this.legacyStorage = config.legacyStorageAdapter || storage;
    this.subject = new BehaviorSubject<T>(schema.defaults);

  }

  /**
   * Observable of settings changes
   */
  get changes$(): Observable<T> {
    return this.subject.asObservable();
  }

  /**
   * Get current settings snapshot
   */
  get(): T {
    return this.subject.value;
  }

  /**
   * Load settings from storage
   * Runs migrations if needed
   * Idempotent - safe to call multiple times
   */
  async load(): Promise<T> {
    // If already loaded, return current value
    if (this.loaded) {
      return this.subject.value;
    }

    // If currently loading, return existing promise
    if (this.loading) {
      return this.loading;
    }

    // Start loading
    this.loading = this._load();
    const result = await this.loading;
    this.loaded = true;
    this.loading = null;
    return result;
  }

  private async _load(): Promise<T> {
    try {
      // Try to read existing settings
      const rawJson = await this.storage.get(this.storageKey);
      
      if (rawJson) {
        const payload = JSON.parse(rawJson) as SettingsPayload<T>;

        // If versions match, return data
        if (payload.version === this.schema.version) {
          const hydrated = this.hydrate(payload.data);
          this.subject.next(hydrated);
          return hydrated;
        }

        // Version mismatch - run migrations
        const migrated = await this.runMigrations(payload);
        await this.persist(migrated);
        const hydrated = this.hydrate(migrated);
        this.subject.next(hydrated);
        return hydrated;
      }

      // No stored settings - check for legacy migrations
      const legacyMigration = this.schema.migrations?.find(
        (m) => m.fromVersion === 'legacy'
      );

      if (legacyMigration) {
        const migrated = await this.runLegacyMigration(legacyMigration);
        await this.persist(migrated);
        const hydrated = this.hydrate(migrated);
        this.subject.next(hydrated);
        return hydrated;
      }

      // No migrations, use defaults
      this.subject.next(this.schema.defaults);
      return this.schema.defaults;
    } catch (error) {
      console.error('[settings-kit] Error loading settings:', error);
      // On error, use defaults
      this.subject.next(this.schema.defaults);
      return this.schema.defaults;
    }
  }

  /**
   * Update settings
   * Accepts partial update or update function
   */
  async set(
    update: Partial<T> | ((prev: T) => T)
  ): Promise<T> {
    const current = this.subject.value;
    const next =
      typeof update === 'function'
        ? update(current)
        : { ...current, ...update };

    const hydrated = this.hydrate(next);
    await this.persist(hydrated);
    this.subject.next(hydrated);
    return hydrated;
  }

  /**
   * Reset settings to defaults
   */
  async reset(): Promise<T> {
    await this.storage.remove(this.storageKey);
    this.subject.next(this.schema.defaults);
    return this.schema.defaults;
  }

  /**
   * Persist settings to storage
   */
  private async persist(data: T): Promise<void> {
    const persistedData = this.dehydrate(data);
    if (this.isEmptyObject(persistedData)) {
      await this.storage.remove(this.storageKey);
      return;
    }

    const payload: SettingsPayload<T> = {
      version: this.schema.version,
      data: persistedData,
    };
    await this.storage.set(this.storageKey, JSON.stringify(payload));
  }

  /**
   * Run migrations from old version to current
   */
  private async runMigrations(payload: SettingsPayload<T>): Promise<T> {
    if (!this.schema.migrations || this.schema.migrations.length === 0) {
      return this.hydrate(payload.data);
    }

    let currentVersion = payload.version;
    let currentData = this.hydrate(payload.data);

    // Sort migrations by toVersion
    const sortedMigrations = [...this.schema.migrations]
      .filter((m) => m.fromVersion !== 'legacy')
      .sort((a, b) => {
        const aFrom = typeof a.fromVersion === 'number' ? a.fromVersion : 0;
        const bFrom = typeof b.fromVersion === 'number' ? b.fromVersion : 0;
        return aFrom - bFrom;
      });

    // Apply migrations sequentially
    for (const migration of sortedMigrations) {
      const fromVer = typeof migration.fromVersion === 'number' ? migration.fromVersion : 0;
      if (fromVer === currentVersion && migration.toVersion <= this.schema.version) {
        const ctx: MigrationContext<T> = {
          rawJson: currentData,
          legacy: this.createLegacyReader(),
        };
        const migrated = await migration.run(ctx);
        currentData = this.hydrate({ ...currentData, ...migrated });
        currentVersion = migration.toVersion;
      }
    }

    return currentData;
  }

  /**
   * Run legacy migration (from old non-versioned data)
   */
  private async runLegacyMigration(migration: Migration<T>): Promise<T> {
    const ctx: MigrationContext<T> = {
      legacy: this.createLegacyReader(),
    };
    const migrated = await migration.run(ctx);
    return this.hydrate(migrated);
  }

  /**
   * Create legacy reader for migration context
   */
  private createLegacyReader(): LegacyReader {
    return {
      get: async (key: string) => {
        return this.legacyStorage.get(key);
      },
      remove: async (key: string) => {
        return this.legacyStorage.remove(key);
      },
    };
  }

  private hydrate(data?: Partial<T> | T): T {
    return { ...this.schema.defaults, ...(data ?? {}) } as T;
  }

  private dehydrate(data: T): Partial<T> {
    const stripped = this.stripDefaults(data, this.schema.defaults);
    if (!stripped || !this.isPlainObject(stripped)) {
      return {};
    }

    return stripped as Partial<T>;
  }

  private stripDefaults(value: unknown, defaults: unknown): unknown {
    if (this.isPlainObject(value)) {
      const defaultRecord = this.isPlainObject(defaults) ? defaults : {};
      const result: Record<string, unknown> = {};

      for (const [key, entry] of Object.entries(value)) {
        const stripped = this.stripDefaults(
          entry,
          (defaultRecord as Record<string, unknown>)[key]
        );
        if (stripped !== undefined) {
          result[key] = stripped;
        }
      }

      return Object.keys(result).length > 0 ? result : undefined;
    }

    if (Array.isArray(value)) {
      return this.valuesEqual(value, defaults) ? undefined : value;
    }

    return this.valuesEqual(value, defaults) ? undefined : value;
  }

  private valuesEqual(left: unknown, right: unknown): boolean {
    if (Array.isArray(left) || Array.isArray(right)) {
      return JSON.stringify(left) === JSON.stringify(right);
    }

    return left === right;
  }

  private isEmptyObject(value: unknown): boolean {
    return this.isPlainObject(value) && Object.keys(value).length === 0;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}
