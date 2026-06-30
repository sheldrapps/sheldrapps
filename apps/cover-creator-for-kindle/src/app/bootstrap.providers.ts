import { EnvironmentProviders, Provider } from '@angular/core';

import {
  MemoryStorageAdapter,
  provideI18nKit,
} from '@sheldrapps/i18n-kit';
import {
  provideCoverImageStateI18n,
  provideCoverSourceI18n,
} from '@sheldrapps/image-workflow';
import {
  EDITOR_I18N_OVERRIDES,
  provideEditorI18n,
} from '@sheldrapps/image-workflow/editor';
import { provideExportQualityKitI18n } from '@sheldrapps/export-quality-kit';
import { provideAdFallbackKitI18n } from '@sheldrapps/ad-fallback-kit';
import { provideAdsKitI18n } from '@sheldrapps/ads-kit';
import { provideAdsKit } from '@sheldrapps/ads-kit';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  WebLocalStorageAdapter,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';
import { provideFileKit } from '@sheldrapps/file-kit';
import { provideRatingKit } from '@sheldrapps/rating-kit';
import { RECOMMENDED_APPS_CURRENT_PACKAGE } from '@sheldrapps/recommended-apps';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from '../app/services/ads.config';
import { environment } from '../environments/environment';
import { CCFK_SETTINGS_SCHEMA } from './settings/ccfk-settings.schema';

const CCFK_SETTINGS_STORAGE_KEY = 'ccfk.settings';
const CCFK_RATING_STORAGE_KEY = 'rating.cover-creator-for-kindle';

export function createBootstrapProviders(): Array<Provider | EnvironmentProviders> {
  return [
    provideI18nKit(
      {
        defaultLang: 'en-US',
        fallbackLang: 'en-US',
        supportedLangs: [
          'es-MX',
          'en-US',
          'de-DE',
          'fr-FR',
          'it-IT',
          'pt-BR',
          'ar-SA',
          'hi-IN',
          'ja-JP',
          'ko-KR',
          'ru-RU',
          'zh-CN',
          'zh-TW',
        ],
        loader: {
          prefix: './assets/i18n/',
          suffix: '.json',
        },
        normalizationMap: {
          es: 'es-MX',
          en: 'en-US',
          de: 'de-DE',
          fr: 'fr-FR',
          it: 'it-IT',
          pt: 'pt-BR',
          pr: 'pt-BR',
          ar: 'ar-SA',
          hi: 'hi-IN',
          ja: 'ja-JP',
          ko: 'ko-KR',
          ru: 'ru-RU',
          zh: 'zh-CN',
          'zh-TW': 'zh-TW',
        },
      },
      new MemoryStorageAdapter(),
    ),
    provideExportQualityKitI18n(),
    provideAdFallbackKitI18n(),
    provideAdsKitI18n(),
    provideCoverImageStateI18n(),
    provideCoverSourceI18n(),
    provideEditorI18n(),
    {
      provide: EDITOR_I18N_OVERRIDES,
      useValue: {
        'es-MX': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Modelo (ResoluciÃ³n)',
        },
        'en-US': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Model (Resolution)',
        },
        'de-DE': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Modell (AuflÃ¶sung)',
        },
        'fr-FR': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'ModÃ¨le (RÃ©solution)',
        },
        'it-IT': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Modello (Risoluzione)',
        },
        'pt-BR': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Modelo (ResoluÃ§Ã£o)',
        },
        'ar-SA': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Ø§Ù„Ø·Ø±Ø§Ø² (Ø§Ù„Ø¯Ù‚Ø©)',
        },
        'hi-IN': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'à¤®à¥‰à¤¡à¤² (à¤°à¤¿à¤œà¤¼à¥‰à¤²à¥à¤¯à¥‚à¤¶à¤¨)',
        },
        'ja-JP': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'ãƒ¢ãƒ‡ãƒ«ï¼ˆè§£åƒåº¦ï¼‰',
        },
        'ko-KR': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'ëª¨ë¸ (í•´ìƒë„)',
        },
        'ru-RU': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'ÐœÐ¾Ð´ÐµÐ»ÑŒ (Ð Ð°Ð·Ñ€ÐµÑˆÐµÐ½Ð¸Ðµ)',
        },
        'zh-CN': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'åž‹å·ï¼ˆåˆ†è¾¨çŽ‡ï¼‰',
        },
        'zh-TW': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'åž‹è™Ÿï¼ˆè§£æžåº¦ï¼‰',
        },
      },
    },
    provideSettingsKit({
      appId: 'ccfk',
      storageKey: CCFK_SETTINGS_STORAGE_KEY,
      schema: CCFK_SETTINGS_SCHEMA,
      writeAccess: {
        protectedKeys: ['theme', 'language', 'exportQualityMode'],
        scopes: {
          theme: ['theme'],
          language: ['language'],
          exportQuality: ['exportQualityMode'],
        },
      },
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: CCFK_SETTINGS_STORAGE_KEY,
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),
    provideFileKit({
      enableWebDevAdapters: environment.enableWebDevAdapters,
    }),
    provideRatingKit({
      appKey: 'cover-creator-for-kindle',
      appName: 'Cover Creator for Kindle',
      packageName: 'com.sheldrapps.covercreatorforkindle',
      minSuccessEvents: 2,
      minLaunches: 2,
      cooldownDays: 14,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: CCFK_RATING_STORAGE_KEY,
        path: 'rating-state.json',
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
    }),
    {
      provide: RECOMMENDED_APPS_CURRENT_PACKAGE,
      useValue: 'com.sheldrapps.covercreatorforkindle',
    },
    provideAdsKit({
      isTesting: !environment.production,
      units: {
        android: {
          test: ADS_UNITS_ANDROID_TEST,
          prod: ADS_UNITS_ANDROID_PROD,
        },
      },
      billing: {
        removeAdsProductId: 'ccfk_remove_ads_forever',
      },
    }),
  ];
}
