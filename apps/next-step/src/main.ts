import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter } from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';
import { provideAdsKit } from '@sheldrapps/ads-kit';
import { MemoryStorageAdapter, provideI18nKit } from '@sheldrapps/i18n-kit';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  WebLocalStorageAdapter,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { NEXT_STEP_SETTINGS_SCHEMA } from './app/settings/next-step-settings.schema';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from './app/services/ads.config';
import { ConfigService } from './config/config.service';
import { environment } from './environments/environment';

const NEXT_STEP_SETTINGS_STORAGE_KEY = 'nextstep.settings';

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
      new MemoryStorageAdapter()
    ),
    provideSettingsKit({
      appId: 'next-step',
      storageKey: NEXT_STEP_SETTINGS_STORAGE_KEY,
      schema: NEXT_STEP_SETTINGS_SCHEMA,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: NEXT_STEP_SETTINGS_STORAGE_KEY,
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
    provideAppInitializer(() => {
      const config = inject(ConfigService);
      return config.initialize();
    }),
  ],
}).catch((error) => console.error(error));
