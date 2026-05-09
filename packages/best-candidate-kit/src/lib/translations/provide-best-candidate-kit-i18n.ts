import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BEST_CANDIDATE_KIT_TRANSLATIONS } from './best-candidate-kit.translations';

const TRANSLATION_SENTINEL_KEY = 'BEST_CANDIDATE.PICKER.TITLE';
type BestCandidateTranslationDict =
  (typeof BEST_CANDIDATE_KIT_TRANSLATIONS)[keyof typeof BEST_CANDIDATE_KIT_TRANSLATIONS];

function resolveBestCandidateTranslations(
  lang: string,
): BestCandidateTranslationDict | null {
  if (!lang) return null;
  if (lang in BEST_CANDIDATE_KIT_TRANSLATIONS) {
    return BEST_CANDIDATE_KIT_TRANSLATIONS[
      lang as keyof typeof BEST_CANDIDATE_KIT_TRANSLATIONS
    ];
  }
  return null;
}

export function provideBestCandidateKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const merged = new Set<string>();

        const mergeForLang = (lang: string) => {
          const dict = resolveBestCandidateTranslations(lang);
          const baseDict = BEST_CANDIDATE_KIT_TRANSLATIONS['en-US'];
          if (!dict && !baseDict) return;
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
                TRANSLATION_SENTINEL_KEY,
              )
            ) {
              mergeForLang(event.lang);
            }
          });

          translate.onLangChange.subscribe((event) => {
            mergeForLang(event.lang);
          });

          for (const lang of Object.keys(BEST_CANDIDATE_KIT_TRANSLATIONS)) {
            mergeForLang(lang);
          }
        } catch (err) {
          console.warn(
            '[best-candidate-kit] Failed to register translations:',
            err,
          );
        }
      },
    },
  ]);
}
