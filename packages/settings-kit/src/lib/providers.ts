/**
 * Angular providers for settings-kit
 */

import { InjectionToken, Provider } from '@angular/core';
import { SettingsSchema } from './types';
import { StorageAdapter, CapacitorPreferencesAdapter } from './storage';
import { SettingsStore } from './settings-store';

/**
 * Configuration for settings-kit
 */
export interface SettingsKitConfig {
  /**
   * Application ID - used as prefix for storage key
   */
  appId: string;

  /**
   * Optional custom storage key
   * Default: `${appId}.settings`
   */
  storageKey?: string;
}

/**
 * Injection token for settings-kit configuration
 */
export const SETTINGS_KIT_CONFIG_TOKEN = new InjectionToken<SettingsKitConfig>(
  'SETTINGS_KIT_CONFIG'
);

/**
 * Injection token for settings schema
 */
export const SETTINGS_SCHEMA_TOKEN = new InjectionToken<SettingsSchema<any>>(
  'SETTINGS_SCHEMA'
);

/**
 * Injection token for storage adapter
 */
export const SETTINGS_STORAGE_ADAPTER_TOKEN = new InjectionToken<StorageAdapter>(
  'SETTINGS_STORAGE_ADAPTER'
);

/**
 * Configuration for provideSettingsKit
 */
export interface ProvideSettingsKitConfig<T> {
  /**
   * Application ID
   */
  appId: string;

  /**
   * Settings schema
   */
  schema: SettingsSchema<T>;

  /**
   * Optional custom storage key
   * Default: `${appId}.settings`
   */
  storageKey?: string;

  /**
   * Optional custom storage adapter
   * Default: CapacitorPreferencesAdapter
   */
  storageAdapter?: StorageAdapter;
}

/**
 * Provide settings-kit for an Angular application
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideSettingsKit({
 *       appId: 'myapp',
 *       schema: MY_SETTINGS_SCHEMA
 *     })
 *   ]
 * });
 * ```
 */
export function provideSettingsKit<T>(
  config: ProvideSettingsKitConfig<T>
): Provider[] {
  console.log('[settings-kit] Providing settings-kit:', config.appId);

  return [
    // Config
    {
      provide: SETTINGS_KIT_CONFIG_TOKEN,
      useValue: {
        appId: config.appId,
        storageKey: config.storageKey,
      } as SettingsKitConfig,
    },

    // Schema
    {
      provide: SETTINGS_SCHEMA_TOKEN,
      useValue: config.schema,
    },

    // Storage adapter
    {
      provide: SETTINGS_STORAGE_ADAPTER_TOKEN,
      useValue: config.storageAdapter || new CapacitorPreferencesAdapter(),
    },

    // Store
    SettingsStore,
  ];
}
