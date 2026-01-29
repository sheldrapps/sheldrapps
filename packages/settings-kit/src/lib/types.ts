/**
 * Type definitions for settings-kit
 */

/**
 * Legacy reader for migrating old localStorage keys
 */
export interface LegacyReader {
  /**
   * Get a value from legacy storage
   * @param key Legacy key to read
   */
  get(key: string): Promise<string | null>;

  /**
   * Remove a legacy key after successful migration
   * @param key Legacy key to remove
   */
  remove(key: string): Promise<void>;
}

/**
 * Migration context passed to migration functions
 */
export interface MigrationContext<T> {
  /**
   * Raw JSON data from storage (if exists)
   */
  rawJson?: any;

  /**
   * Legacy reader for accessing old keys
   */
  legacy?: LegacyReader;
}

/**
 * Migration definition
 */
export interface Migration<T> {
  /**
   * Source version - use 'legacy' for migrating from old non-versioned data
   */
  fromVersion: number | 'legacy';

  /**
   * Target version
   */
  toVersion: number;

  /**
   * Migration function
   * Returns partial or full settings object
   */
  run(ctx: MigrationContext<T>): Promise<Partial<T> | T>;
}

/**
 * Settings schema definition
 */
export interface SettingsSchema<T> {
  /**
   * Current schema version
   */
  version: number;

  /**
   * Default settings values
   */
  defaults: T;

  /**
   * Optional migrations array
   */
  migrations?: Migration<T>[];
}

/**
 * Persisted settings payload
 */
export interface SettingsPayload<T> {
  /**
   * Schema version
   */
  version: number;

  /**
   * Settings data
   */
  data: T;
}
