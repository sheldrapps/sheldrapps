import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BEST_CANDIDATE_KIT_TRANSLATIONS } from './best-candidate-kit.translations';

/**
 * Provides best candidate kit i18n translations.
 *
 * Registers default best candidate translations for all supported languages.
 */
export function provideBestCandidateKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const sampleKey = 'BEST_CANDIDATE';
        const merged = new Set<string>();

        const resolveDictForLang = (lang: string) => {
          if (!lang) return null;
          if (lang in BEST_CANDIDATE_KIT_TRANSLATIONS) {
            return BEST_CANDIDATE_KIT_TRANSLATIONS[
              lang as keyof typeof BEST_CANDIDATE_KIT_TRANSLATIONS
            ];
          }
          return null;
        };

        const mergeBestCandidateTranslations = (lang: string) => {
          const dict = resolveDictForLang(lang);
          const baseDict = BEST_CANDIDATE_KIT_TRANSLATIONS['en-US'];
          if (!baseDict && !dict) return;
          if (merged.has(lang)) return;
          merged.add(lang);

          if (baseDict) {
            translate.setTranslation(lang, baseDict, true);
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
              mergeBestCandidateTranslations(event.lang);
            }
          });

          translate.onLangChange.subscribe((event) => {
            mergeBestCandidateTranslations(event.lang);
            translate.instant(sampleKey);
          });
        } catch (err) {
          console.warn(
            '[best-candidate-kit] Failed to register best candidate translations:',
            err,
          );
        }
      },
    },
  ]);
}
