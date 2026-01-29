import * as i0 from '@angular/core';
import { InjectionToken, Optional, Inject, Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import * as i1 from '@ngx-translate/core';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { provideHttpClient, HttpClient } from '@angular/common/http';

/**
 * Core types for i18n-kit package
 */
/**
 * Injection token key for LanguageConfig
 */
const LANGUAGE_CONFIG_TOKEN = new InjectionToken('i18n-kit-config');
/**
 * InjectionToken for StorageAdapter
 */
const STORAGE_ADAPTER_TOKEN = new InjectionToken('i18n-kit-storage-adapter');

/**
 * Language code normalization
 * Maps short codes (es, en) to full codes (es-MX, en-US)
 */
/**
 * Canonicalize language code to standard format
 * Preserves correct case for locale codes to match JSON filenames
 * Examples: 'EN-us' -> 'en-US', 'fr-fr' -> 'fr-FR', 'es' -> 'es'
 */
function canonicalizeLanguage(code) {
    if (!code)
        return '';
    // Trim and replace underscores with hyphens
    const cleaned = code.trim().replace(/_/g, '-');
    // Split into parts
    const parts = cleaned.split('-');
    if (parts.length === 0)
        return '';
    // Base language (first part) in lowercase
    const base = parts[0].toLowerCase();
    // Region (second part) in UPPERCASE if present
    if (parts.length >= 2 && parts[1]) {
        const region = parts[1].toUpperCase();
        return `${base}-${region}`;
    }
    // No region, just return base
    return base;
}
/**
 * Normalize language code to a supported variant
 * Handles:
 * - Short codes: es → map[es] → es-MX
 * - Full codes: es-MX → es-MX (pass through if valid)
 * - Case insensitive: ES-mx → es-MX (canonicalized)
 */
function normalizeLanguage(code, supportedLangs, normalizationMap) {
    if (!code)
        return null;
    // First canonicalize to get proper case
    const canonical = canonicalizeLanguage(code);
    if (!canonical)
        return null;
    // Try case-insensitive match in supported langs (returns canonical from list)
    const supported = supportedLangs.find((lang) => lang.toLowerCase() === canonical.toLowerCase());
    if (supported)
        return supported;
    // Extract base and try mapping
    const base = canonical.split('-')[0].toLowerCase();
    const mapped = normalizationMap?.[base];
    if (mapped && isLanguageSupported(mapped, supportedLangs)) {
        return mapped;
    }
    return null;
}
/**
 * Check if a language code is in the supported list
 */
function isLanguageSupported(code, supportedLangs) {
    if (!code)
        return false;
    const normalized = code.trim().toLowerCase();
    return supportedLangs.some((lang) => lang.toLowerCase() === normalized);
}
/**
 * Build default normalization map from supported languages
 * Auto-extracts base codes: ['es-MX', 'en-US'] → { es: 'es-MX', en: 'en-US' }
 * Preserves canonical case from supportedLangs
 */
function buildDefaultNormalizationMap(supportedLangs) {
    const map = {};
    for (const lang of supportedLangs) {
        const base = lang.split(/[-_]/)[0].toLowerCase();
        // Only add if base is not already mapped (first occurrence wins)
        if (!map[base]) {
            map[base] = lang; // Keep canonical case from supportedLangs
        }
    }
    return map;
}

/**
 * localStorage wrapper for language persistence
 */
/**
 * Default localStorage adapter
 */
class LocalStorageAdapter {
    getItem(key) {
        try {
            return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        }
        catch {
            return null;
        }
    }
    setItem(key, value) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, value);
            }
        }
        catch {
            // Silent fail for SSR or blocked storage
        }
    }
    removeItem(key) {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
            }
        }
        catch {
            // Silent fail
        }
    }
}
/**
 * In-memory adapter (useful for SSR or testing)
 */
class MemoryStorageAdapter {
    data = {};
    getItem(key) {
        return this.data[key] ?? null;
    }
    setItem(key, value) {
        this.data[key] = value;
    }
    removeItem(key) {
        delete this.data[key];
    }
}

/**
 * Device language detection adapter
 * Tries Capacitor Device API first, falls back to navigator.language
 */
/**
 * Get language code from device
 * Attempts Capacitor Device.getLanguageCode() first, then navigator.language
 * Returns raw code without case transformation (will be canonicalized by normalizer)
 */
async function getDeviceLanguage() {
    try {
        // Try Capacitor Device API
        const { Device } = await import('@capacitor/device');
        const info = await Device.getLanguageCode();
        const code = info?.value || '';
        if (code)
            return code; // No toLowerCase - preserve raw format
    }
    catch {
        // Capacitor not available or failed
    }
    // Fallback to browser navigator
    try {
        return navigator.language || ''; // No toLowerCase - preserve raw format
    }
    catch {
        return '';
    }
}
/**
 * Extract language base code (es from es-MX, en from en-US, etc.)
 * Returns base in lowercase for comparison purposes
 */
function extractLanguageBase(code) {
    if (!code)
        return '';
    const base = code.trim().split(/[-_]/)[0].toLowerCase();
    return base;
}

/**
 * Core LanguageService for i18n-kit
 * Manages language selection, persistence, and detection
 */
class LanguageService {
    translateService;
    currentLang;
    config;
    storage;
    normMap;
    constructor(translateService, config, storage) {
        this.translateService = translateService;
        this.currentLang = config?.defaultLang ?? 'en-US';
        this.config = config || this.getDefaultConfig();
        this.storage = storage || new LocalStorageAdapter();
        this.normMap = config?.normalizationMap
            ? { ...config.normalizationMap }
            : buildDefaultNormalizationMap(config?.supportedLangs ?? []);
    }
    /**
     * Get current language
     */
    get lang() {
        return this.currentLang;
    }
    /**
     * Get supported languages from config
     */
    get supported() {
        return [...this.config.supportedLangs];
    }
    /**
     * Initialize language service
     * Priority: saved > system > default
     */
    async init() {
        console.log('[i18n-kit] LanguageService.init() START');
        console.log('[i18n-kit] Config:', {
            defaultLang: this.config.defaultLang,
            supportedLangs: this.config.supportedLangs,
            storageKey: this.config.storageKey || 'lang',
        });
        this.translateService.setDefaultLang(this.config.defaultLang);
        console.log('[i18n-kit] translate.setDefaultLang() called');
        const saved = this.getSaved();
        console.log('[i18n-kit] saved from storage:', saved);
        const system = await this.getSystemLang();
        console.log('[i18n-kit] system language detected:', system);
        const preferSaved = this.config.preferSaved !== false; // Default true
        const final = (preferSaved && saved) || system || this.config.defaultLang;
        console.log('[i18n-kit] final language chosen:', final);
        await this.set(final);
        console.log('[i18n-kit] LanguageService.init() COMPLETE, currentLang:', this.currentLang);
        return this.currentLang;
    }
    /**
     * Set language
     * Normalizes, validates, and persists the language
     */
    async set(lang) {
        console.log('[i18n-kit] LanguageService.set() called with:', lang);
        const normalized = this.normalize(lang);
        console.log('[i18n-kit] normalized language:', normalized);
        // If normalization fails, fallback to default
        const valid = normalized && isLanguageSupported(normalized, this.config.supportedLangs)
            ? normalized
            : this.config.defaultLang;
        console.log('[i18n-kit] valid language (after fallback):', valid);
        this.currentLang = valid;
        const key = this.config.storageKey || 'lang';
        this.storage.setItem(key, valid);
        console.log('[i18n-kit] localStorage.setItem("' + key + '", "' + valid + '")');
        console.log('[i18n-kit] calling translate.use("' + valid + '")');
        await lastValueFrom(this.translateService.use(valid));
        console.log('[i18n-kit] translate.currentLang after use():', this.translateService.currentLang);
    }
    /**
     * Get saved language from storage
     */
    getSaved() {
        const key = this.config.storageKey || 'lang';
        const saved = this.storage.getItem(key);
        console.log('[i18n-kit] LanguageService.getSaved() from localStorage("' + key + '"):', saved);
        if (!saved) {
            console.log('[i18n-kit] No saved language in localStorage, returning null');
            return null;
        }
        const normalized = this.normalize(saved);
        console.log('[i18n-kit] Normalized saved language:', normalized);
        if (normalized &&
            isLanguageSupported(normalized, this.config.supportedLangs)) {
            console.log('[i18n-kit] Returning normalized saved language:', normalized);
            return normalized;
        }
        console.log('[i18n-kit] Saved language not supported, returning null');
        return null;
    }
    /**
     * Detect system language
     */
    async getSystemLang() {
        console.log('[i18n-kit] LanguageService.getSystemLang() called');
        const deviceLang = await getDeviceLanguage();
        console.log('[i18n-kit] Device language detected:', deviceLang);
        const normalized = this.normalize(deviceLang);
        console.log('[i18n-kit] Device language normalized:', normalized);
        return normalized;
    }
    /**
     * Normalize language code
     * Maps short codes to full codes and validates
     */
    normalize(code) {
        return normalizeLanguage(code, this.config.supportedLangs, this.normMap);
    }
    /**
     * Get default config (fallback if not provided)
     */
    getDefaultConfig() {
        return {
            defaultLang: 'en-US',
            fallbackLang: 'en-US',
            supportedLangs: ['en-US'],
            loader: { prefix: './assets/i18n/', suffix: '.json' },
        };
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: LanguageService, deps: [{ token: i1.TranslateService }, { token: LANGUAGE_CONFIG_TOKEN, optional: true }, { token: STORAGE_ADAPTER_TOKEN, optional: true }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: LanguageService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "20.3.16", ngImport: i0, type: LanguageService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }], ctorParameters: () => [{ type: i1.TranslateService }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [LANGUAGE_CONFIG_TOKEN]
                }] }, { type: undefined, decorators: [{
                    type: Optional
                }, {
                    type: Inject,
                    args: [STORAGE_ADAPTER_TOKEN]
                }] }] });

/**
 * Case-preserving TranslateLoader
 * Ensures the lang code is used exactly as provided (no lowercasing)
 */
class CasePreservingTranslateLoader {
    http;
    prefix;
    suffix;
    constructor(http, prefix, suffix) {
        this.http = http;
        this.prefix = prefix;
        this.suffix = suffix;
    }
    getTranslation(lang) {
        const url = `${this.prefix}${lang}${this.suffix}`;
        console.log('[i18n-kit] loader.getTranslation lang:', lang);
        console.log('[i18n-kit] loader.getTranslation url:', url);
        return this.http.get(url);
    }
}
function createCasePreservingTranslateLoader(http, prefix, suffix) {
    return new CasePreservingTranslateLoader(http, prefix, suffix);
}

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
function provideI18nKit(config, storageAdapter) {
    console.log('[i18n-kit] USING i18n-kit v1.0.0');
    return [
        // Provide config via injection token
        { provide: LANGUAGE_CONFIG_TOKEN, useValue: config },
        // Provide custom storage or default
        {
            provide: STORAGE_ADAPTER_TOKEN,
            useValue: storageAdapter || new LocalStorageAdapter(),
        },
        // Provide HTTP client (required for HttpLoader)
        provideHttpClient(),
        // Configure TranslateService with loader
        provideTranslateService({
            defaultLanguage: config.defaultLang,
        }),
        // Configure case-preserving TranslateLoader
        {
            provide: TranslateLoader,
            useFactory: (http) => createCasePreservingTranslateLoader(http, config.loader.prefix, config.loader.suffix),
            deps: [HttpClient],
        },
        // Provide LanguageService
        LanguageService,
    ];
}

/**
 * Public API for @sheldrapps/i18n-kit
 */
// Core exports

/**
 * Generated bundle index. Do not edit.
 */

export { CasePreservingTranslateLoader, LANGUAGE_CONFIG_TOKEN, LanguageService, LocalStorageAdapter, MemoryStorageAdapter, STORAGE_ADAPTER_TOKEN, buildDefaultNormalizationMap, canonicalizeLanguage, createCasePreservingTranslateLoader, extractLanguageBase, getDeviceLanguage, isLanguageSupported, normalizeLanguage, provideI18nKit };
//# sourceMappingURL=sheldrapps-i18n-kit.mjs.map
