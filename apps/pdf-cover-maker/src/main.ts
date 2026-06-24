import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';

import { MemoryStorageAdapter, provideI18nKit } from '@sheldrapps/i18n-kit';
import {
  provideCoverImageStateI18n,
  provideCoverSourceI18n,
} from '@sheldrapps/image-workflow';
import {
  provideEditorI18n,
  EDITOR_I18N_OVERRIDES,
} from '@sheldrapps/image-workflow/editor';
import { provideExportQualityKitI18n } from '@sheldrapps/export-quality-kit';
import { provideAdFallbackKitI18n } from '@sheldrapps/ad-fallback-kit';
import { provideBestCandidateKitI18n } from '@sheldrapps/best-candidate-kit';
import { provideAdsKit } from '@sheldrapps/ads-kit';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  WebLocalStorageAdapter,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';
import { providePdfFileKit } from '@sheldrapps/file-kit/pdf';
import { provideRatingKit } from '@sheldrapps/rating-kit';
import { RECOMMENDED_APPS_CURRENT_PACKAGE } from '@sheldrapps/recommended-apps';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from './app/services/ads.config';
import { environment } from './environments/environment';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { PCM_SETTINGS_SCHEMA } from './app/settings/pcm-settings.schema';

const PCM_SETTINGS_STORAGE_KEY = 'pcm.settings';
// Must match the key SettingsKitRatingStorageAdapter generates: `${storageKeyPrefix}.${appKey}`
const PCM_RATING_STORAGE_KEY = 'rating.pdf-cover-maker';

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

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
    provideAdFallbackKitI18n(),
    provideExportQualityKitI18n(),
    provideBestCandidateKitI18n(),
    provideCoverImageStateI18n(),
    provideCoverSourceI18n(),
    provideEditorI18n(),
    {
      provide: EDITOR_I18N_OVERRIDES,
      useValue: {
        'es-MX': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Recortar (Proporción)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Recortar (Proporción)',
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
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': 'Recadrer (Ratio)',
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
            'Recortar (Proporção)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Recortar (Proporção)',
        },
        'zh-TW': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': '裁切（比例）',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP': '裁切（比例）',
        },
        'hi-IN': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': 'क्रॉप (अनुपात)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP': 'क्रॉप (अनुपात)',
        },
        'ar-SA': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': 'قص (نسبة)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP': 'قص (نسبة)',
        },
        'ja-JP': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': 'トリミング（比率）',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'トリミング（比率）',
        },
        'ko-KR': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': '크롭 (비율)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP': '크롭 (비율)',
        },
        'zh-CN': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP': '裁剪（比例）',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP': '裁剪（比例）',
        },
        'ru-RU': {
          'EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP':
            'Обрезка (соотношение)',
          'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL.LABEL.CROP':
            'Обрезка (соотношение)',
        },
      },
    },

    provideSettingsKit({
      appId: 'pcm',
      storageKey: PCM_SETTINGS_STORAGE_KEY,
      schema: PCM_SETTINGS_SCHEMA,
      writeAccess: {
        protectedKeys: ['theme', 'language', 'exportQualityMode'],
        scopes: {
          theme: ['theme'],
          language: ['language'],
          exportQuality: ['exportQualityMode'],
        },
      },
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: PCM_SETTINGS_STORAGE_KEY,
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),

    providePdfFileKit({
      enableWebDevAdapters: environment.enableWebDevAdapters,
    }),
    provideRatingKit({
      appKey: 'pdf-cover-maker',
      appName: 'PDF Cover Maker',
      packageName: 'com.sheldrapps.pdfcovermaker',
      minSuccessEvents: 2,
      minLaunches: 2,
      cooldownDays: 14,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: PCM_RATING_STORAGE_KEY,
        path: 'rating-state.json',
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
    }),
    {
      provide: RECOMMENDED_APPS_CURRENT_PACKAGE,
      useValue: 'com.sheldrapps.pdfcovermaker',
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
        removeAdsProductId: 'pcm_remove_ads_forever',
      },
    }),
  ],
});



