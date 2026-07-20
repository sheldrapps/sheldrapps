import { EnvironmentProviders, Provider } from '@angular/core';

import {
  provideI18nKit,
} from '@sheldrapps/i18n-kit';
import { providePrivacyPolicyKitI18n } from '@sheldrapps/privacy-policy-kit';
import {
  provideCoverImageStateI18n,
  provideCoverSourceI18n,
} from '@sheldrapps/image-workflow';
import { provideEditorI18n } from '@sheldrapps/image-workflow/editor';
import { provideBestCandidateKitI18n } from '@sheldrapps/best-candidate-kit';
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
import { provideUiThemeI18n } from '@sheldrapps/ui-theme';
import { RECOMMENDED_APPS_CURRENT_PACKAGE } from '@sheldrapps/recommended-apps';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from '../app/services/ads.config';
import { environment } from '../environments/environment';
import { ECC_SETTINGS_SCHEMA } from './settings/ecc-settings.schema';

const ECC_SETTINGS_STORAGE_KEY = 'ecc.settings';
const ECC_RATING_STORAGE_KEY = 'rating.epub-cover-changer';

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
          'zh-TW',
          'hi-IN',
          'ar-SA',
          'ja-JP',
          'ko-KR',
          'zh-CN',
          'ru-RU',
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
          zh: 'zh-TW',
          hi: 'hi-IN',
          ar: 'ar-SA',
          ja: 'ja-JP',
          ko: 'ko-KR',
          'zh-cn': 'zh-CN',
          ru: 'ru-RU',
        },
      },
    ),
    providePrivacyPolicyKitI18n(),
    provideAdFallbackKitI18n(),
    provideAdsKitI18n(),
    provideBestCandidateKitI18n(),
    provideUiThemeI18n(),
    provideCoverImageStateI18n(),
    provideCoverSourceI18n(),
    provideEditorI18n(),
    provideSettingsKit({
      appId: 'ecc',
      storageKey: ECC_SETTINGS_STORAGE_KEY,
      schema: ECC_SETTINGS_SCHEMA,
      writeAccess: {
        protectedKeys: ['theme', 'language', 'exportQualityMode'],
        scopes: {
          theme: ['theme'],
          language: ['language'],
          exportQuality: ['exportQualityMode'],
        },
      },
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: ECC_SETTINGS_STORAGE_KEY,
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
      appKey: 'epub-cover-changer',
      appName: 'EPUB Cover Changer',
      packageName: 'com.sheldrapps.epubcoverchanger',
      minSuccessEvents: 2,
      minLaunches: 2,
      cooldownDays: 14,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: ECC_RATING_STORAGE_KEY,
        path: 'rating-state.json',
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
    }),
    {
      provide: RECOMMENDED_APPS_CURRENT_PACKAGE,
      useValue: 'com.sheldrapps.epubcoverchanger',
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
        removeAdsProductId: 'ecc_remove_ads_forever',
      },
    }),
  ];
}
