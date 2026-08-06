import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService, type TranslationObject } from '@ngx-translate/core';
import { UI_THEME_TRANSLATIONS } from './ui-theme.translations';
import { UI_THEME_ACTION_TRANSLATIONS } from './ui-theme-actions.translations';
import { TRIPLE_BUTTON_TRANSLATIONS } from './triple-button.translations';

export function provideUiThemeI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const registered = new Set<string>();
        let registering = false;

        const registerLang = (lang: string) => {
          const dict = UI_THEME_TRANSLATIONS[lang] ?? UI_THEME_TRANSLATIONS['en-US'];
          const tripleButtonDict =
            (TRIPLE_BUTTON_TRANSLATIONS as Record<string, TranslationObject>)[
              lang
            ] ?? TRIPLE_BUTTON_TRANSLATIONS['en-US'];
          const actionDict =
            UI_THEME_ACTION_TRANSLATIONS[lang] ??
            UI_THEME_ACTION_TRANSLATIONS['en-US'];

          if (!dict || registered.has(lang)) {
            return;
          }

          registered.add(lang);
          registering = true;
          try {
            translate.setTranslation(lang, dict, true);
            translate.setTranslation(lang, actionDict, true);
            translate.setTranslation(lang, tripleButtonDict, true);
          } finally {
            registering = false;
          }
        };

        try {
          registerLang(translate.currentLang || translate.defaultLang || 'en-US');

          translate.onLangChange.subscribe((event) => {
            registerLang(event.lang);
          });

          translate.onTranslationChange.subscribe((event) => {
            if (
              !registering &&
              event.lang &&
              !Object.prototype.hasOwnProperty.call(
                event.translations ?? {},
                'UI_THEME',
              )
            ) {
              registered.delete(event.lang);
              registerLang(event.lang);
            }
          });
        } catch (error) {
          console.warn('[ui-theme] Failed to register ui-theme translations:', error);
        }
      },
    },
  ]);
}
