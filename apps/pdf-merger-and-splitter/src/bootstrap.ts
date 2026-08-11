import type { EnvironmentProviders, Provider } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';
import { provideAdFallbackKitI18n } from '@sheldrapps/ad-fallback-kit';
import { provideAdsKit, provideAdsKitI18n } from '@sheldrapps/ads-kit';
import { provideBestCandidateKitI18n } from '@sheldrapps/best-candidate-kit';
import {
  provideCoverImageStateI18n,
  provideCoverSourceI18n,
} from '@sheldrapps/image-workflow';
import { provideEditorI18n } from '@sheldrapps/image-workflow/editor';
import { provideI18nKit } from '@sheldrapps/i18n-kit';
import { providePrivacyPolicyKitI18n } from '@sheldrapps/privacy-policy-kit';
import { provideRatingKit } from '@sheldrapps/rating-kit';
import { RECOMMENDED_APPS_CURRENT_PACKAGE } from '@sheldrapps/recommended-apps';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  WebLocalStorageAdapter,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';
import { provideUiThemeI18n } from '@sheldrapps/ui-theme';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { environment } from './environments/environment';
import { providePdfMergerAndSplitterBootstrapInitializer } from './app/providers/pdf-merger-and-splitter-bootstrap.initializer';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from './app/services/ads.config';
import {
  PDF_MERGER_AND_SPLITTER_RATING_FEEDBACK_OPTIONS,
  PDF_MERGER_AND_SPLITTER_RATING_TRANSLATION_OVERRIDES,
} from './app/services/rating.config';
import { PDF_MERGER_AND_SPLITTER_SETTINGS_SCHEMA } from './app/settings/pdf-merger-and-splitter-settings.schema';

const PDF_MERGER_AND_SPLITTER_SETTINGS_STORAGE_KEY = 'pmas.settings';
const PDF_MERGER_AND_SPLITTER_PACKAGE_ID = 'com.sheldrapps.pdfmergerandsplitter';
const PDF_MERGER_AND_SPLITTER_RATING_STORAGE_KEY = 'rating.pmas';

export async function bootstrapPdfMergerAndSplitterApp(): Promise<void> {
  const providers: Array<EnvironmentProviders | Provider> = [
    provideIonicAngular(),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideI18nKit({
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
    }),
    provideUiThemeI18n(),
    {
      provide: RECOMMENDED_APPS_CURRENT_PACKAGE,
      useValue: PDF_MERGER_AND_SPLITTER_PACKAGE_ID,
    },
    provideBestCandidateKitI18n(),
    provideCoverImageStateI18n(),
    provideCoverSourceI18n(),
    provideEditorI18n(),
    providePrivacyPolicyKitI18n(),
    provideAdFallbackKitI18n(),
    provideAdsKitI18n(),
    provideSettingsKit({
      appId: 'pdf-merger-and-splitter',
      storageKey: PDF_MERGER_AND_SPLITTER_SETTINGS_STORAGE_KEY,
      schema: PDF_MERGER_AND_SPLITTER_SETTINGS_SCHEMA,
      writeAccess: {
        protectedKeys: ['theme', 'language'],
        scopes: {
          theme: ['theme'],
          language: ['language'],
          exportQuality: ['exportQualityMode'],
        },
      },
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: PDF_MERGER_AND_SPLITTER_SETTINGS_STORAGE_KEY,
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),
    providePdfMergerAndSplitterBootstrapInitializer(),
    provideRatingKit({
      appKey: 'pdf-merger-and-splitter',
      appName: 'PDF Merger & Splitter',
      appNameKey: 'APP.TITLE',
      packageName: PDF_MERGER_AND_SPLITTER_PACKAGE_ID,
      supportEmail: 'sheldrapps@gmail.com',
      feedbackOptions: PDF_MERGER_AND_SPLITTER_RATING_FEEDBACK_OPTIONS,
      translationOverrides: PDF_MERGER_AND_SPLITTER_RATING_TRANSLATION_OVERRIDES,
      minSuccessEvents: 2,
      minLaunches: 2,
      cooldownDays: 14,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: PDF_MERGER_AND_SPLITTER_RATING_STORAGE_KEY,
        path: 'rating-state.json',
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
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
        removeAdsProductId: 'pdf_merger_and_splitter_pro',
      },
    }),
  ];

  await bootstrapApplication(AppComponent, { providers });
}
