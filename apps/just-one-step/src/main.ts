import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';
import { provideAdsKit } from '@sheldrapps/ads-kit';
import { provideI18nKit } from '@sheldrapps/i18n-kit';
import { provideNativeSqlite } from '@sheldrapps/native-sqlite-kit';
import { providePrivacyPolicyKitI18n } from '@sheldrapps/privacy-policy-kit';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  WebLocalStorageAdapter,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { JUST_ONE_STEP_SETTINGS_SCHEMA } from './app/settings/just-one-step-settings.schema';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from './app/services/ads.config';
import { justOneStepMigrations } from './app/database/migrations/just-one-step-sqlite.migrations';
import { ConfigService } from './config/config.service';
import { environment } from './environments/environment';

const JUST_ONE_STEP_SETTINGS_STORAGE_KEY = 'justonestep.settings';

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideI18nKit(
      {
        defaultLang: 'en-US',
        fallbackLang: 'en-US',
        supportedLangs: ['es-MX', 'en-US', 'de-DE', 'fr-FR', 'it-IT', 'pt-BR'],
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
        },
      },
    ),
    providePrivacyPolicyKitI18n(),
    provideSettingsKit({
      appId: 'just-one-step',
      storageKey: JUST_ONE_STEP_SETTINGS_STORAGE_KEY,
      schema: JUST_ONE_STEP_SETTINGS_SCHEMA,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: JUST_ONE_STEP_SETTINGS_STORAGE_KEY,
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),
    provideAdsKit({
      isTesting: !environment.production,
      units: {
        android: {
          test: ADS_UNITS_ANDROID_TEST,
          prod: ADS_UNITS_ANDROID_PROD,
        },
      },
    }),
    ...provideNativeSqlite({
      databaseName: 'just-one-step.db',
      migrations: justOneStepMigrations,
      seeders: [],
      debug: environment.debugDatabase,
      initializeOnAppBootstrap: false,
    }),
    provideAppInitializer(() => {
      const config = inject(ConfigService);
      return config.initialize();
    }),
  ],
}).catch((error) => console.error(error));
