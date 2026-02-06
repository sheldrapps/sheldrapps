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
export class SettingsStore<T> {
  private readonly storageKey: string;
  private readonly schema: SettingsSchema<T>;
  private readonly storage: StorageAdapter;
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
          this.subject.next(payload.data);
          return payload.data;
        }

        // Version mismatch - run migrations
        const migrated = await this.runMigrations(payload);
        await this.persist(migrated);
        this.subject.next(migrated);
        return migrated;
      }

      // No stored settings - check for legacy migrations
      const legacyMigration = this.schema.migrations?.find(
        (m) => m.fromVersion === 'legacy'
      );

      if (legacyMigration) {
        const migrated = await this.runLegacyMigration(legacyMigration);
        await this.persist(migrated);
        this.subject.next(migrated);
        return migrated;
      }

      // No migrations, use defaults
      await this.persist(this.schema.defaults);
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

    await this.persist(next);
    this.subject.next(next);
    return next;
  }

  /**
   * Reset settings to defaults
   */
  async reset(): Promise<T> {
    await this.persist(this.schema.defaults);
    this.subject.next(this.schema.defaults);
    return this.schema.defaults;
  }

  /**
   * Persist settings to storage
   */
  private async persist(data: T): Promise<void> {
    const payload: SettingsPayload<T> = {
      version: this.schema.version,
      data,
    };
    await this.storage.set(this.storageKey, JSON.stringify(payload));
  }

  /**
   * Run migrations from old version to current
   */
  private async runMigrations(payload: SettingsPayload<T>): Promise<T> {
    if (!this.schema.migrations || this.schema.migrations.length === 0) {
      return payload.data;
    }

    let currentVersion = payload.version;
    let currentData = payload.data;

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
        currentData = { ...currentData, ...migrated };
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
    return { ...this.schema.defaults, ...migrated };
  }

  /**
   * Create legacy reader for migration context
   */
  private createLegacyReader(): LegacyReader {
    return {
      get: async (key: string) => {
        return this.storage.get(key);
      },
      remove: async (key: string) => {
        return this.storage.remove(key);
      },
    };
  }
}
