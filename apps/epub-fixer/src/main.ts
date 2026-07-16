import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';
import { provideI18nKit } from '@sheldrapps/i18n-kit';
import { provideEReaderPreviewFrameI18n } from '@sheldrapps/image-workflow';
import { providePrivacyPolicyKitI18n } from '@sheldrapps/privacy-policy-kit';
import { provideRatingKit } from '@sheldrapps/rating-kit';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  WebLocalStorageAdapter,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';
import { provideEpubFixerPort, provideFileKit } from '@sheldrapps/file-kit';
import { provideAdFallbackKitI18n } from '@sheldrapps/ad-fallback-kit';
import { provideAdsKit, provideAdsKitI18n } from '@sheldrapps/ads-kit';
import { RECOMMENDED_APPS_CURRENT_PACKAGE } from '@sheldrapps/recommended-apps';
import { provideUiThemeI18n } from '@sheldrapps/ui-theme';
import { environment } from './environments/environment';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from './app/services/ads.config';
import {
  EPUB_FIXER_RATING_FEEDBACK_OPTIONS,
  EPUB_FIXER_RATING_TRANSLATION_OVERRIDES,
} from './app/services/rating.config';
import { EPUB_FIXER_SETTINGS_SCHEMA } from './app/settings/epub-fixer-settings.schema';
import type { EnvironmentProviders, Provider } from '@angular/core';

const EPUB_FIXER_SETTINGS_STORAGE_KEY = 'epub-fixer.settings';
const EPUB_FIXER_PACKAGE_ID = 'com.sheldrapps.epubfixer';
const EPUB_FIXER_RATING_STORAGE_KEY = 'rating.epub-fixer';

async function bootstrap(): Promise<void> {
  const providers: Array<EnvironmentProviders | Provider> = [
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
    ),
    provideEReaderPreviewFrameI18n(),
    provideUiThemeI18n(),
    providePrivacyPolicyKitI18n(),
    provideAdFallbackKitI18n(),
    provideAdsKitI18n(),

    provideSettingsKit({
      appId: 'epub-fixer',
      storageKey: EPUB_FIXER_SETTINGS_STORAGE_KEY,
      schema: EPUB_FIXER_SETTINGS_SCHEMA,
      writeAccess: {
        protectedKeys: ['theme', 'language'],
        scopes: {
          theme: ['theme'],
          language: ['language'],
        },
      },
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: EPUB_FIXER_SETTINGS_STORAGE_KEY,
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),
    provideRatingKit({
      appKey: 'epub-fixer',
      appName: 'EPUB Fixer',
      packageName: EPUB_FIXER_PACKAGE_ID,
      supportEmail: 'sheldrapps@gmail.com',
      feedbackOptions: EPUB_FIXER_RATING_FEEDBACK_OPTIONS,
      translationOverrides: EPUB_FIXER_RATING_TRANSLATION_OVERRIDES,
      minSuccessEvents: 2,
      minLaunches: 2,
      cooldownDays: 14,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: EPUB_FIXER_RATING_STORAGE_KEY,
        path: 'rating-state.json',
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
    }),

    provideFileKit({
      enableWebDevAdapters: environment.enableWebDevAdapters,
    }),
    provideAdsKit({
      isTesting: !environment.production,
      units: {
        android: {
          test: ADS_UNITS_ANDROID_TEST,
          prod: ADS_UNITS_ANDROID_PROD,
        },
      },
      billing: {
        removeAdsProductId: 'epub_fixer_pro',
      },
    }),
    {
      provide: RECOMMENDED_APPS_CURRENT_PACKAGE,
      useValue: EPUB_FIXER_PACKAGE_ID,
    },
  ];

  if (environment.enableWebDevAdapters) {
    const { provideWebDevEpubFixerPort } = await import(
      './app/providers/epub-fixer-web.providers'
    );
    providers.push(...provideWebDevEpubFixerPort());
  } else {
    providers.push(...provideEpubFixerPort());
  }

  await bootstrapApplication(AppComponent, { providers });
}

void bootstrap();
