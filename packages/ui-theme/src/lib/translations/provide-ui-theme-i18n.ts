import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UI_THEME_TRANSLATIONS } from './ui-theme.translations';

export function provideUiThemeI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const registered = new Set<string>();

        const registerLang = (lang: string) => {
          const dict = UI_THEME_TRANSLATIONS[lang] ?? UI_THEME_TRANSLATIONS['en-US'];

          if (!dict || registered.has(lang)) {
            return;
          }

          registered.add(lang);
          translate.setTranslation(lang, dict, true);
        };

        try {
          registerLang(translate.currentLang || translate.defaultLang || 'en-US');

          translate.onLangChange.subscribe((event) => {
            registerLang(event.lang);
          });
        } catch (error) {
          console.warn('[ui-theme] Failed to register ui-theme translations:', error);
        }
      },
    },
  ]);
}
