import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { COVER_SOURCE_TRANSLATIONS } from "./cover-source.translations";

export function provideCoverSourceI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const sampleKey = "COVER_SOURCE.ACTIONS.IMAGE";
        const merged = new Set<string>();

        const resolveDictForLang = (lang: string) => {
          if (!lang) return null;
          if (lang in COVER_SOURCE_TRANSLATIONS) {
            return COVER_SOURCE_TRANSLATIONS[
              lang as keyof typeof COVER_SOURCE_TRANSLATIONS
            ];
          }
          return null;
        };

        const mergeCoverSourceTranslations = (lang: string) => {
          const dict = resolveDictForLang(lang);
          const baseDict = COVER_SOURCE_TRANSLATIONS["en-US"];
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

        translate.onTranslationChange.subscribe((event) => {
          if (
            event.lang &&
            !Object.prototype.hasOwnProperty.call(
              event.translations,
              sampleKey,
            )
          ) {
            mergeCoverSourceTranslations(event.lang);
          }
        });

        translate.onLangChange.subscribe((event) => {
          mergeCoverSourceTranslations(event.lang);
          translate.instant(sampleKey);
        });
      },
    },
  ]);
}
