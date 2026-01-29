/**
 * Core LanguageService for i18n-kit
 * Manages language selection, persistence, and detection
 */

import { Injectable, Inject, Optional } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { lastValueFrom } from 'rxjs';

import {
  LanguageConfig,
  LANGUAGE_CONFIG_TOKEN,
  STORAGE_ADAPTER_TOKEN,
} from './types';
import {
  normalizeLanguage,
  isLanguageSupported,
  buildDefaultNormalizationMap,
} from './language-normalizer';
import { StorageAdapter, LocalStorageAdapter } from './storage';
import { getDeviceLanguage } from './adapters/device-lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private currentLang: string;
  private config!: LanguageConfig;
  private storage: StorageAdapter;
  private normMap: Record<string, string>;

  constructor(
    private translateService: TranslateService,
    @Optional()
    @Inject(LANGUAGE_CONFIG_TOKEN)
    config?: LanguageConfig,
    @Optional()
    @Inject(STORAGE_ADAPTER_TOKEN)
    storage?: StorageAdapter
  ) {
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
  get lang(): string {
    return this.currentLang;
  }

  /**
   * Get supported languages from config
   */
  get supported(): string[] {
    return [...this.config.supportedLangs];
  }

  /**
   * Initialize language service
   * Priority: saved > system > default
   */
  async init(): Promise<string> {
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

    const final =
      (preferSaved && saved) || system || this.config.defaultLang;

    console.log('[i18n-kit] final language chosen:', final);
    await this.set(final);
    console.log('[i18n-kit] LanguageService.init() COMPLETE, currentLang:', this.currentLang);
    return this.currentLang;
  }

  /**
   * Set language
   * Normalizes, validates, and persists the language
   */
  async set(lang: string): Promise<void> {
    console.log('[i18n-kit] LanguageService.set() called with:', lang);

    const normalized = this.normalize(lang);
    console.log('[i18n-kit] normalized language:', normalized);

    // If normalization fails, fallback to default
    const valid =
      normalized && isLanguageSupported(normalized, this.config.supportedLangs)
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
  getSaved(): string | null {
    const key = this.config.storageKey || 'lang';
    const saved = this.storage.getItem(key);
    console.log('[i18n-kit] LanguageService.getSaved() from localStorage("' + key + '"):', saved);

    if (!saved) {
      console.log('[i18n-kit] No saved language in localStorage, returning null');
      return null;
    }

    const normalized = this.normalize(saved);
    console.log('[i18n-kit] Normalized saved language:', normalized);

    if (
      normalized &&
      isLanguageSupported(normalized, this.config.supportedLangs)
    ) {
      console.log('[i18n-kit] Returning normalized saved language:', normalized);
      return normalized;
    }

    console.log('[i18n-kit] Saved language not supported, returning null');
    return null;
  }

  /**
   * Detect system language
   */
  async getSystemLang(): Promise<string | null> {
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
  private normalize(code: string): string | null {
    return normalizeLanguage(code, this.config.supportedLangs, this.normMap);
  }

  /**
   * Get default config (fallback if not provided)
   */
  private getDefaultConfig(): LanguageConfig {
    return {
      defaultLang: 'en-US',
      fallbackLang: 'en-US',
      supportedLangs: ['en-US'],
      loader: { prefix: './assets/i18n/', suffix: '.json' },
    };
  }
}
