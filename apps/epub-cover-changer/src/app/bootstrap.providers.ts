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
import { provideBestCandidateKitI18n } from '@sheldrapps/best-candidate-kit';
import { provideAdFallbackKitI18n } from '@sheldrapps/ad-fallback-kit';
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
      new MemoryStorageAdapter(),
    ),
    provideExportQualityKitI18n(),
    provideAdFallbackKitI18n(),
    provideBestCandidateKitI18n(),
    provideCoverImageStateI18n(),
    provideCoverSourceI18n(),
    provideEditorI18n(),
    {
      provide: EDITOR_I18N_OVERRIDES,
      useValue: {
        'es-MX': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Recortar (ProporciÃ³n)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Recortar (ProporciÃ³n)',
        },
        'en-US': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': 'Crop (Ratio)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP': 'Crop (Ratio)',
        },
        'de-DE': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Zuschneiden (Ratio)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Zuschneiden (Ratio)',
        },
        'fr-FR': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Recadrer (Ratio)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Recadrer (Ratio)',
        },
        'it-IT': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Ritaglia (Rapporto)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Ritaglia (Rapporto)',
        },
        'pt-BR': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Recortar (ProporciÃ³o)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Recortar (ProporciÃ³o)',
        },
        'zh-TW': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': 'è£åˆ‡ï¼ˆæ¯”ä¾‹ï¼‰',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'è£åˆ‡ï¼ˆæ¯”ä¾‹ï¼‰',
        },
        'hi-IN': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'à¤•à¥à¤°à¥‰à¤ª (à¤…à¤¨à¥à¤ªà¤¾à¤¤)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'à¤•à¥à¤°à¥‰à¤ª (à¤…à¤¨à¥à¤ªà¤¾à¤¤)',
        },
        'ar-SA': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': 'Ù‚Øµ (Ù†Ø³Ø¨Ø©)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Ù‚Øµ (Ù†Ø³Ø¨Ø©)',
        },
        'ja-JP': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'ãƒˆãƒªãƒŸãƒ³ã‚°ï¼ˆæ¯”çŽ‡ï¼‰',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'ãƒˆãƒªãƒŸãƒ³ã‚°ï¼ˆæ¯”çŽ‡ï¼‰',
        },
        'ko-KR': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'í¬ë¡­ (ë¹„ìœ¨)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'í¬ë¡­ (ë¹„ìœ¨)',
        },
        'zh-CN': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': 'è£å‰ªï¼ˆæ¯”ä¾‹ï¼‰',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'è£å‰ªï¼ˆæ¯”ä¾‹ï¼‰',
        },
        'ru-RU': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'ÐžÐ±Ñ€ÐµÐ·ÐºÐ° (ÑÐ¾Ð¾Ñ‚Ð½Ð¾ÑˆÐµÐ½Ð¸Ðµ)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'ÐžÐ±Ñ€ÐµÐ·ÐºÐ° (ÑÐ¾Ð¾Ñ‚Ð½Ð¾ÑˆÐµÐ½Ð¸Ðµ)',
        },
      },
    },
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
