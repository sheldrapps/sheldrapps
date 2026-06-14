import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import {
  provideIonicAngular,
  IonicRouteStrategy,
} from '@ionic/angular/standalone';
import { MemoryStorageAdapter, provideI18nKit } from '@sheldrapps/i18n-kit';
import {
  CapacitorPreferencesAdapter,
  CompositeStorageAdapter,
  ConfigJsonFileAdapter,
  WebLocalStorageAdapter,
  provideSettingsKit,
} from '@sheldrapps/settings-kit';
import { provideEpubFixerPort, provideFileKit } from '@sheldrapps/file-kit';
import { RECOMMENDED_APPS_CURRENT_PACKAGE } from '@sheldrapps/recommended-apps';
import { environment } from './environments/environment';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { EPUB_FIXER_SETTINGS_SCHEMA } from './app/settings/epub-fixer-settings.schema';

const EPUB_FIXER_SETTINGS_STORAGE_KEY = 'epub-fixer.settings';
const EPUB_FIXER_PACKAGE_ID = 'com.sheldrapps.epubfixer';

async function bootstrap(): Promise<void> {
  const providers = [
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
      new MemoryStorageAdapter(),
    ),

    provideSettingsKit({
      appId: 'epub-fixer',
      storageKey: EPUB_FIXER_SETTINGS_STORAGE_KEY,
      schema: EPUB_FIXER_SETTINGS_SCHEMA,
      storageAdapter: new ConfigJsonFileAdapter({
        primaryKey: EPUB_FIXER_SETTINGS_STORAGE_KEY,
        fallbackAdapter: new WebLocalStorageAdapter(),
      }),
      legacyStorageAdapter: new CompositeStorageAdapter([
        new CapacitorPreferencesAdapter(),
        new WebLocalStorageAdapter(),
      ]),
    }),

    provideFileKit({
      enableWebDevAdapters: environment.enableWebDevAdapters,
    }),
    ...provideEpubFixerPort(),
    {
      provide: RECOMMENDED_APPS_CURRENT_PACKAGE,
      useValue: EPUB_FIXER_PACKAGE_ID,
    },
  ];

  await bootstrapApplication(AppComponent, { providers });
}

void bootstrap();
