/**
 * Core types for i18n-kit package
 */

import { InjectionToken } from '@angular/core';
import { StorageAdapter } from './storage';

export interface LanguageLoaderConfig {
  /**
   * Prefix for translation files (e.g., './assets/i18n/')
   */
  prefix: string;

  /**
   * Suffix for translation files (e.g., '.json')
   */
  suffix: string;
}

export interface LanguageConfig {
  /**
   * Default language code (e.g., 'es-MX')
   * Used as fallback if no saved language or system language detected
   */
  defaultLang: string;

  /**
   * Fallback language for TranslateService
   * Used when a translation key is missing
   */
  fallbackLang: string;

  /**
   * Array of supported language codes (e.g., ['es-MX', 'en-US', 'de-DE'])
   */
  supportedLangs: string[];

  /**
   * localStorage key for persisting language choice
   * @default 'lang'
   */
  storageKey?: string;

  /**
   * Loader configuration for TranslateHttpLoader
   */
  loader: LanguageLoaderConfig;

  /**
   * Map short language codes to full codes
   * Example: { es: 'es-MX', en: 'en-US' }
   */
  normalizationMap?: Record<string, string>;

  /**
   * Whether to prefer saved language over system language
   * @default true
   */
  preferSaved?: boolean;
}

/**
 * Injection token key for LanguageConfig
 */
export const LANGUAGE_CONFIG_TOKEN = new InjectionToken<LanguageConfig>(
  'i18n-kit-config'
);

/**
 * InjectionToken for StorageAdapter
 */
export const STORAGE_ADAPTER_TOKEN = new InjectionToken<StorageAdapter>(
  'i18n-kit-storage-adapter'
);
