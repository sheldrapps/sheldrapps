/**
 * Angular providers factory for i18n-kit
 * Configures TranslateService and LanguageService
 */

import { Provider, EnvironmentProviders } from '@angular/core';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import {
  LanguageConfig,
  LANGUAGE_CONFIG_TOKEN,
  STORAGE_ADAPTER_TOKEN,
} from './types';
import { LanguageService } from './language.service';
import { StorageAdapter, LocalStorageAdapter } from './storage';
import { createCasePreservingTranslateLoader } from './case-preserving-loader';

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
export function provideI18nKit(
  config: LanguageConfig,
  storageAdapter?: StorageAdapter
): (Provider | EnvironmentProviders)[] {
  // DEBUG: i18n kit config snapshot (remove after diagnosis)
  console.log('[i18n-kit] config snapshot', {
    defaultLang: config.defaultLang,
    fallbackLang: config.fallbackLang,
    supportedLangs: config.supportedLangs,
    loader: config.loader,
    normalizationMap: config.normalizationMap,
  });
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

    provideTranslateService({
      defaultLanguage: config.defaultLang,
      lang: config.defaultLang,
      loader: {
        provide: TranslateLoader,
        useFactory: (http: HttpClient) =>
          createCasePreservingTranslateLoader(
            http,
            config.loader.prefix,
            config.loader.suffix,
          ),
        deps: [HttpClient],
      },
    }),

    LanguageService,
  ];
}
