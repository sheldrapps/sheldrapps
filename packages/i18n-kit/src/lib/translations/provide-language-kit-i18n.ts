import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LANGUAGE_KIT_TRANSLATIONS } from './language-kit.translations';

export function provideLanguageKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const merged = new Set<string>();

        const mergeForLang = (lang: string) => {
          if (!lang || merged.has(lang)) {
            return;
          }

          const dict =
            LANGUAGE_KIT_TRANSLATIONS[
              lang as keyof typeof LANGUAGE_KIT_TRANSLATIONS
            ] ?? null;

          if (!dict) {
            return;
          }

          merged.add(lang);
          translate.setTranslation(lang, dict, true);

          queueMicrotask(() => {
            merged.delete(lang);
          });
        };

        try {
          for (const lang of Object.keys(LANGUAGE_KIT_TRANSLATIONS)) {
            mergeForLang(lang);
          }

          translate.onTranslationChange.subscribe((event) => {
            if (event.lang) {
              mergeForLang(event.lang);
            }
          });

          translate.onLangChange.subscribe((event) => {
            mergeForLang(event.lang);
          });
        } catch (error) {
          console.warn(
            '[i18n-kit] Failed to register language kit translations:',
            error,
          );
        }
      },
    },
  ]);
}
