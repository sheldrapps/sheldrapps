import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';

import { MemoryStorageAdapter, provideI18nKit } from '@sheldrapps/i18n-kit';
import {
  provideEditorI18n,
  EDITOR_I18N_OVERRIDES,
} from '@sheldrapps/image-workflow/editor';
import { provideExportQualityKitI18n } from '@sheldrapps/export-quality-kit';
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
} from './app/services/ads.config';
import { environment } from './environments/environment';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { ECC_SETTINGS_SCHEMA } from './app/settings/ecc-settings.schema';

const ECC_SETTINGS_STORAGE_KEY = 'ecc.settings';
// Must match the key SettingsKitRatingStorageAdapter generates: `${storageKeyPrefix}.${appKey}`
const ECC_RATING_STORAGE_KEY = 'rating.epub-cover-changer';

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
    provideExportQualityKitI18n(),
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
      appId: 'ecc',
      storageKey: ECC_SETTINGS_STORAGE_KEY,
      schema: ECC_SETTINGS_SCHEMA,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: ECC_SETTINGS_STORAGE_KEY,
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),

    provideFileKit(),
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
  ],
});
