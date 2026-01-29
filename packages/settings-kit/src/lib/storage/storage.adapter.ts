/**
 * Async storage adapter interface for settings-kit
 * Supports both Capacitor Preferences and web localStorage
 */

export interface StorageAdapter {
  /**
   * Get a value from storage
   * @param key Storage key
   * @returns Promise resolving to the value or null
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in storage
   * @param key Storage key
   * @param value Value to store
   */
  set(key: string, value: string): Promise<void>;

  /**
   * Remove a value from storage
   * @param key Storage key
   */
  remove(key: string): Promise<void>;

  /**
   * Check if a key exists in storage
   * @param key Storage key
   * @returns Promise resolving to true if key exists
   */
  has(key: string): Promise<boolean>;
}
