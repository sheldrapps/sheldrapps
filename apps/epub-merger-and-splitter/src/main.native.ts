import { APP_INITIALIZER } from '@angular/core';
import { bootstrapApplication, Title } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';
import {
  detectSupportedLocale,
  LanguageService,
  provideI18nKit,
} from '@sheldrapps/i18n-kit';
import { provideEReaderPreviewFrameI18n } from '@sheldrapps/image-workflow';
import { providePrivacyPolicyKitI18n } from '@sheldrapps/privacy-policy-kit';
import { provideEditorI18n } from '@sheldrapps/image-workflow/editor';
import { TranslateService } from '@ngx-translate/core';
import { provideRatingKit } from '@sheldrapps/rating-kit';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  WebLocalStorageAdapter,
  SettingsStore,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';
import {
  provideEpubFixerPort as provideEpubMergerAndSplitterPort,
  provideFileKit,
} from '@sheldrapps/file-kit';
import { provideAdFallbackKitI18n } from '@sheldrapps/ad-fallback-kit';
import { provideAdsKit, provideAdsKitI18n } from '@sheldrapps/ads-kit';
import { RECOMMENDED_APPS_CURRENT_PACKAGE } from '@sheldrapps/recommended-apps';
import { EdgeToEdgeService, ThemeService } from '@sheldrapps/ui-theme';
import { environment } from './environments/environment';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from './app/services/ads.config';
import {
  EPUB_MERGER_AND_SPLITTER_RATING_FEEDBACK_OPTIONS,
  EPUB_MERGER_AND_SPLITTER_RATING_TRANSLATION_OVERRIDES,
} from './app/services/rating.config';
import {
  EPUB_MERGER_AND_SPLITTER_SETTINGS_SCHEMA,
  type EpubMergerAndSplitterSettings,
} from './app/settings/epub-merger-and-splitter-settings.schema';

const EPUB_MERGER_AND_SPLITTER_SETTINGS_STORAGE_KEY = 'epub-merger-and-splitter.settings';
const EPUB_MERGER_AND_SPLITTER_PACKAGE_ID = 'com.sheldrapps.epubmergersplitter';
const EPUB_MERGER_AND_SPLITTER_RATING_STORAGE_KEY = 'rating.epub-merger-and-splitter';

function installRuntimeLogging(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    console.error(
      '[epub-merger-and-splitter] window.error',
      event.error instanceof Error
        ? `${event.error.name}: ${event.error.message}\n${event.error.stack ?? ''}`
        : event.error ?? event.message,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[epub-merger-and-splitter] unhandledrejection', event.reason);
  });
}

function createNativeBootstrapInitializer(
  edgeToEdge: EdgeToEdgeService,
  theme: ThemeService,
  settings: SettingsStore<EpubMergerAndSplitterSettings>,
  language: LanguageService,
  translate: TranslateService,
  title: Title,
): () => Promise<void> {
  return async () => {
    await edgeToEdge.initEdgeToEdge();
    await theme.initialize();

    const currentSettings = settings.get();
    const storedLanguage = currentSettings.language;
    const resolvedLanguage = storedLanguage ?? (await detectSupportedLocale());

    translate.setDefaultLang('en-US');

    if (!storedLanguage) {
      await settings.setForScope('language', { language: resolvedLanguage });
    }

    await language.set(resolvedLanguage);
    title.setTitle(translate.instant('APP.TITLE'));
  };
}

async function bootstrap(): Promise<void> {
  installRuntimeLogging();

  const providers = [
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
    provideEditorI18n(),
    providePrivacyPolicyKitI18n(),
    provideAdFallbackKitI18n(),
    provideAdsKitI18n(),

    provideSettingsKit({
      appId: 'epub-merger-and-splitter',
      storageKey: EPUB_MERGER_AND_SPLITTER_SETTINGS_STORAGE_KEY,
      schema: EPUB_MERGER_AND_SPLITTER_SETTINGS_SCHEMA,
      writeAccess: {
        protectedKeys: ['theme', 'language'],
        scopes: {
          theme: ['theme'],
          language: ['language'],
        },
      },
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: EPUB_MERGER_AND_SPLITTER_SETTINGS_STORAGE_KEY,
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),
    provideRatingKit({
      appKey: 'epub-merger-and-splitter',
      appName: 'EPUB Merger & Splitter',
      packageName: EPUB_MERGER_AND_SPLITTER_PACKAGE_ID,
      supportEmail: 'sheldrapps@gmail.com',
      feedbackOptions: EPUB_MERGER_AND_SPLITTER_RATING_FEEDBACK_OPTIONS,
      translationOverrides: EPUB_MERGER_AND_SPLITTER_RATING_TRANSLATION_OVERRIDES,
      minSuccessEvents: 2,
      minLaunches: 2,
      cooldownDays: 14,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: EPUB_MERGER_AND_SPLITTER_RATING_STORAGE_KEY,
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
        removeAdsProductId: 'epub_merger_and_splitter_pro',
      },
    }),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [
        EdgeToEdgeService,
        ThemeService,
        SettingsStore,
        LanguageService,
        TranslateService,
        Title,
      ],
      useFactory: createNativeBootstrapInitializer,
    },
    ...provideEpubMergerAndSplitterPort(),
    {
      provide: RECOMMENDED_APPS_CURRENT_PACKAGE,
      useValue: EPUB_MERGER_AND_SPLITTER_PACKAGE_ID,
    },
  ];

  await bootstrapApplication(AppComponent, { providers });
}

void bootstrap().catch((error) => {
  console.error('[epub-merger-and-splitter] bootstrap failed', error);
});
