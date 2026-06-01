import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AD_FALLBACK_KIT_TRANSLATIONS } from './ad-fallback.translations';

export function provideAdFallbackKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const merged = new Set<string>();
        const sampleKey = 'AD_FALLBACK';

        const resolveDictForLang = (lang: string) => {
          if (!lang) return null;
          if (lang in AD_FALLBACK_KIT_TRANSLATIONS) {
            return AD_FALLBACK_KIT_TRANSLATIONS[lang];
          }
          if (lang === 'es-419' && AD_FALLBACK_KIT_TRANSLATIONS['es-MX']) {
            return AD_FALLBACK_KIT_TRANSLATIONS['es-MX'];
          }
          return null;
        };

        const mergeForLang = (lang: string) => {
          const dict = resolveDictForLang(lang);
          const base = AD_FALLBACK_KIT_TRANSLATIONS['en-US'];
          if (!base && !dict) return;
          if (merged.has(lang)) return;
          merged.add(lang);

          if (base) {
            translate.setTranslation(lang, base, true);
          }
          if (dict) {
            translate.setTranslation(lang, dict, true);
          }

          queueMicrotask(() => {
            merged.delete(lang);
          });
        };

        try {
          translate.onTranslationChange.subscribe((event) => {
            if (
              event.lang &&
              !Object.prototype.hasOwnProperty.call(
                event.translations,
                sampleKey,
              )
            ) {
              mergeForLang(event.lang);
            }
          });

          translate.onLangChange.subscribe((event) => {
            mergeForLang(event.lang);
            translate.instant(sampleKey);
          });
        } catch (err) {
          console.warn(
            '[ad-fallback-kit] Failed to register fallback translations:',
            err,
          );
        }
      },
    },
  ]);
}
