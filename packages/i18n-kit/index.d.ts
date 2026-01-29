import * as i0 from '@angular/core';
import { InjectionToken, Provider, EnvironmentProviders } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * localStorage wrapper for language persistence
 */
interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/**
 * Default localStorage adapter
 */
declare class LocalStorageAdapter implements StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/**
 * In-memory adapter (useful for SSR or testing)
 */
declare class MemoryStorageAdapter implements StorageAdapter {
    private data;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

/**
 * Core types for i18n-kit package
 */

interface LanguageLoaderConfig {
    /**
     * Prefix for translation files (e.g., './assets/i18n/')
     */
    prefix: string;
    /**
     * Suffix for translation files (e.g., '.json')
     */
    suffix: string;
}
interface LanguageConfig {
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
declare const LANGUAGE_CONFIG_TOKEN: InjectionToken<LanguageConfig>;
/**
 * InjectionToken for StorageAdapter
 */
declare const STORAGE_ADAPTER_TOKEN: InjectionToken<StorageAdapter>;

declare class LanguageService {
    private translateService;
    private currentLang;
    private config;
    private storage;
    private normMap;
    constructor(translateService: TranslateService, config?: LanguageConfig, storage?: StorageAdapter);
    /**
     * Get current language
     */
    get lang(): string;
    /**
     * Get supported languages from config
     */
    get supported(): string[];
    /**
     * Initialize language service
     * Priority: saved > system > default
     */
    init(): Promise<string>;
    /**
     * Set language
     * Normalizes, validates, and persists the language
     */
    set(lang: string): Promise<void>;
    /**
     * Get saved language from storage
     */
    getSaved(): string | null;
    /**
     * Detect system language
     */
    getSystemLang(): Promise<string | null>;
    /**
     * Normalize language code
     * Maps short codes to full codes and validates
     */
    private normalize;
    /**
     * Get default config (fallback if not provided)
     */
    private getDefaultConfig;
    static ɵfac: i0.ɵɵFactoryDeclaration<LanguageService, [null, { optional: true; }, { optional: true; }]>;
    static ɵprov: i0.ɵɵInjectableDeclaration<LanguageService>;
}

/**
 * Language code normalization
 * Maps short codes (es, en) to full codes (es-MX, en-US)
 */
/**
 * Normalize language code to a supported variant
 * Handles:
 * - Short codes: es → map[es]
 * - Full codes: es-MX → es-MX (pass through if valid)
 * - Case insensitive: ES-mx → es-MX
 */
declare function normalizeLanguage(code: string, supportedLangs: string[], normalizationMap?: Record<string, string>): string | null;
/**
 * Check if a language code is in the supported list
 */
declare function isLanguageSupported(code: string, supportedLangs: string[]): boolean;
/**
 * Build default normalization map from supported languages
 * Auto-extracts base codes: ['es-MX', 'en-US'] → { es: 'es-MX', en: 'en-US' }
 */
declare function buildDefaultNormalizationMap(supportedLangs: string[]): Record<string, string>;

/**
 * Angular providers factory for i18n-kit
 * Configures TranslateService and LanguageService
 */

/**
 * Main provider factory for i18n-kit
 * Set up all necessary providers for translation and language management
 *
 * @param config Language configuration
 * @param storageAdapter Optional custom storage adapter
 * @returns Array of Angular providers
 *
 * @example
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideI18nKit({
 *       defaultLang: 'es-MX',
 *       fallbackLang: 'en-US',
 *       supportedLangs: ['es-MX', 'en-US', 'de-DE'],
 *       loader: { prefix: './assets/i18n/', suffix: '.json' },
 *       normalizationMap: { es: 'es-MX', en: 'en-US' }
 *     })
 *   ]
 * });
 */
declare function provideI18nKit(config: LanguageConfig, storageAdapter?: StorageAdapter): (Provider | EnvironmentProviders)[];

/**
 * Device language detection adapter
 * Tries Capacitor Device API first, falls back to navigator.language
 */
/**
 * Get language code from device
 * Attempts Capacitor Device.getLanguageCode() first, then navigator.language
 */
declare function getDeviceLanguage(): Promise<string>;
/**
 * Extract language base code (es from es-MX, en from en-US, etc.)
 */
declare function extractLanguageBase(code: string): string;

export { LANGUAGE_CONFIG_TOKEN, LanguageService, LocalStorageAdapter, MemoryStorageAdapter, STORAGE_ADAPTER_TOKEN, buildDefaultNormalizationMap, extractLanguageBase, getDeviceLanguage, isLanguageSupported, normalizeLanguage, provideI18nKit };
export type { LanguageConfig, LanguageLoaderConfig, StorageAdapter };
