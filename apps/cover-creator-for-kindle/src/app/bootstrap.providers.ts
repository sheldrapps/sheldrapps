import { EnvironmentProviders, Provider } from '@angular/core';

import {
  MemoryStorageAdapter,
  provideI18nKit,
} from '@sheldrapps/i18n-kit';
import {
  provideCoverImageStateI18n,
  provideCoverSourceI18n,
  provideEReaderPreviewFrameI18n,
} from '@sheldrapps/image-workflow';
import { provideEditorI18n } from '@sheldrapps/image-workflow/editor';
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
    provideEReaderPreviewFrameI18n(),
    provideEditorI18n(),
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
