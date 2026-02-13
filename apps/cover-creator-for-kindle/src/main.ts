import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';

import { provideI18nKit } from '@sheldrapps/i18n-kit';
import { provideEditorI18n } from '@sheldrapps/image-workflow/editor';
import { provideAdsKit } from '@sheldrapps/ads-kit';
import { provideSettingsKit } from '@sheldrapps/settings-kit';
import { provideFileKit } from '@sheldrapps/file-kit';
import {
  ADS_UNITS_ANDROID_PROD,
  ADS_UNITS_ANDROID_TEST,
} from './app/services/ads.config';
import { environment } from './environments/environment';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { CCFK_SETTINGS_SCHEMA } from './app/settings/ccfk-settings.schema';

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    provideI18nKit({
      defaultLang: 'es-MX',
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
      },
    }),
    provideEditorI18n(),

    provideSettingsKit({
      appId: 'ccfk',
      schema: CCFK_SETTINGS_SCHEMA,
    }),

    provideFileKit(),

    provideAdsKit({
      isTesting: !environment.production,
      units: {
        android: {
          test: ADS_UNITS_ANDROID_TEST,
          prod: ADS_UNITS_ANDROID_PROD,
        },
      },
    }),
  ],
});
