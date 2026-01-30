import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';

import { provideI18nKit } from '@sheldrapps/i18n-kit';
import { provideSettingsKit } from '@sheldrapps/settings-kit';
import { provideFileKit } from '@sheldrapps/file-kit';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { PRESUPUESTO_SETTINGS_SCHEMA } from './app/settings/presupuesto-settings.schema';

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideRouter(routes),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    provideI18nKit({
      defaultLang: 'es-MX',
      fallbackLang: 'es-MX',
      supportedLangs: ['es-MX'],
      loader: {
        prefix: './assets/i18n/',
        suffix: '.json',
      },
      normalizationMap: {
        es: 'es-MX',
      },
    }),

    provideSettingsKit({
      appId: 'presupuesto-ninos',
      schema: PRESUPUESTO_SETTINGS_SCHEMA,
    }),

    provideFileKit(),
  ],
});
