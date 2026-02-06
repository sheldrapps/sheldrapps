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
    this.translateService.setDefaultLang(this.config.defaultLang);

    const saved = this.getSaved();

    const system = await this.getSystemLang();

    const preferSaved = this.config.preferSaved !== false; // Default true

    const final =
      (preferSaved && saved) || system || this.config.defaultLang;

    await this.set(final);
    return this.currentLang;
  }

  /**
   * Set language
   * Normalizes, validates, and persists the language
   */
  async set(lang: string): Promise<void> {
    const normalized = this.normalize(lang);

    // If normalization fails, fallback to default
    const valid =
      normalized && isLanguageSupported(normalized, this.config.supportedLangs)
        ? normalized
        : this.config.defaultLang;

    this.currentLang = valid;
    const key = this.config.storageKey || 'lang';
    this.storage.setItem(key, valid);
    await lastValueFrom(this.translateService.use(valid));
  }

  /**
   * Get saved language from storage
   */
  getSaved(): string | null {
    const key = this.config.storageKey || 'lang';
    const saved = this.storage.getItem(key);

    if (!saved) {
      return null;
    }

    const normalized = this.normalize(saved);

    if (
      normalized &&
      isLanguageSupported(normalized, this.config.supportedLangs)
    ) {
      return normalized;
    }

    return null;
  }

  /**
   * Detect system language
   */
  async getSystemLang(): Promise<string | null> {
    const deviceLang = await getDeviceLanguage();
    const normalized = this.normalize(deviceLang);
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
