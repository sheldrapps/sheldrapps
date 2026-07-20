import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService, type TranslationObject } from '@ngx-translate/core';
import { UI_THEME_TRANSLATIONS } from './ui-theme.translations';
import { TRIPLE_BUTTON_TRANSLATIONS } from './triple-button.translations';

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
          const tripleButtonDict =
            (TRIPLE_BUTTON_TRANSLATIONS as Record<string, TranslationObject>)[
              lang
            ] ?? TRIPLE_BUTTON_TRANSLATIONS['en-US'];

          if (!dict || registered.has(lang)) {
            return;
          }

          registered.add(lang);
          translate.setTranslation(lang, dict, true);
          translate.setTranslation(lang, tripleButtonDict, true);
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
