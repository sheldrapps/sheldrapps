import {
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  detectSupportedLocale,
  LanguageService,
  provideI18nKit,
  syncLauncherAlias,
} from '@sheldrapps/i18n-kit';
import { provideAdsKit, provideAdsKitI18n } from '@sheldrapps/ads-kit';
import { provideRatingKit } from '@sheldrapps/rating-kit';
import { provideAdFallbackKitI18n } from '@sheldrapps/ad-fallback-kit';
import { provideFileKit } from '@sheldrapps/file-kit';
import { provideLifecycleDiagnostics, provideRecoveryStore } from '@sheldrapps/lifecycle-kit';
import { providePrivacyPolicyKitI18n } from '@sheldrapps/privacy-policy-kit';
import { RECOMMENDED_APPS_CURRENT_PACKAGE } from '@sheldrapps/recommended-apps';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  SettingsStore,
  WebLocalStorageAdapter,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';
import {
  EdgeToEdgeService,
  ThemeService,
  provideUiThemeI18n,
} from '@sheldrapps/ui-theme';
import { environment } from '../environments/environment';
import { ADS_UNITS_ANDROID_PROD } from './services/ads.config';
import {
  EPUB_METADATA_EDITOR_PACKAGE_ID,
  EPUB_METADATA_EDITOR_REMOVE_ADS_PRODUCT_ID,
  EPUB_METADATA_EDITOR_RATING_STORAGE_KEY,
  EPUB_METADATA_EDITOR_SETTINGS_SCHEMA,
  type EpubMetadataEditorSettings,
} from './settings/epub-metadata-editor-settings.schema';

const supportedLangs = [
  'en-US',
  'es-MX',
  'de-DE',
  'fr-FR',
  'hi-IN',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'pt-BR',
  'ru-RU',
  'ar-SA',
  'zh-CN',
  'zh-TW',
] as const;

export function createBootstrapProviders(): Array<EnvironmentProviders | Provider> {
  return [
    provideLifecycleDiagnostics({ appId: 'eme' }),
    provideRecoveryStore({ appId: 'eme', schemaVersion: 1, folder: 'EPUBMetadataEditorRecovery' }),
    provideI18nKit({
      defaultLang: 'en-US',
      fallbackLang: 'en-US',
      supportedLangs: [...supportedLangs],
      loader: { prefix: './assets/i18n/', suffix: '.json' },
      normalizationMap: {
        en: 'en-US',
        es: 'es-MX',
        de: 'de-DE',
        fr: 'fr-FR',
        hi: 'hi-IN',
        it: 'it-IT',
        ja: 'ja-JP',
        ko: 'ko-KR',
        pt: 'pt-BR',
        pr: 'pt-BR',
        ru: 'ru-RU',
        ar: 'ar-SA',
        zh: 'zh-TW',
        'zh-cn': 'zh-CN',
      },
    }),
    provideUiThemeI18n(),
    providePrivacyPolicyKitI18n(),
    provideAdFallbackKitI18n(),
    provideAdsKitI18n(),
    provideSettingsKit({
      appId: 'epub-metadata-editor',
      storageKey: 'epub-metadata-editor.settings',
      schema: EPUB_METADATA_EDITOR_SETTINGS_SCHEMA,
      writeAccess: {
        protectedKeys: ['theme', 'language'],
        scopes: {
          theme: ['theme'],
          language: ['language'],
        },
      },
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: 'epub-metadata-editor.settings',
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),
    provideRatingKit({
      appKey: 'epub-metadata-editor',
      appName: 'EPUB Metadata Editor',
      packageName: EPUB_METADATA_EDITOR_PACKAGE_ID,
      supportEmail: 'sheldrapps@gmail.com',
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: EPUB_METADATA_EDITOR_RATING_STORAGE_KEY,
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
          prod: ADS_UNITS_ANDROID_PROD,
        },
      },
      billing: {
        removeAdsProductId: EPUB_METADATA_EDITOR_REMOVE_ADS_PRODUCT_ID,
        developmentPremiumMode: environment.production,
      },
    }),
    {
      provide: RECOMMENDED_APPS_CURRENT_PACKAGE,
      useValue: EPUB_METADATA_EDITOR_PACKAGE_ID,
    },
    provideAppInitializer(async () => {
      const edgeToEdge = inject(EdgeToEdgeService);
      const theme = inject(ThemeService);
      const settings = inject(SettingsStore<EpubMetadataEditorSettings>);
      const language = inject(LanguageService);
      const translate = inject(TranslateService);

      await edgeToEdge.initEdgeToEdge();
      await theme.initialize();
      await settings.load();

      translate.setDefaultLang('en-US');
      const storedLanguage = settings.get().language;
      const activeLanguage = storedLanguage ?? (await detectSupportedLocale());

      if (!storedLanguage) {
        await settings.setForScope('language', { language: activeLanguage });
      }

      await language.set(activeLanguage);
      void syncLauncherAlias(activeLanguage);
    }),
  ];
}
