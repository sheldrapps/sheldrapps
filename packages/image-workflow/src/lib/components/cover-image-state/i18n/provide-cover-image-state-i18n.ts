import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";

import { COVER_IMAGE_STATE_TRANSLATIONS } from "./cover-image-state.translations";

export function provideCoverImageStateI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const merged = new Set<string>();

        const resolveDictForLang = (lang: string) => {
          if (!lang) return null;
          if (lang in COVER_IMAGE_STATE_TRANSLATIONS) {
            return COVER_IMAGE_STATE_TRANSLATIONS[
              lang as keyof typeof COVER_IMAGE_STATE_TRANSLATIONS
            ];
          }
          if (lang === "es-419") {
            return COVER_IMAGE_STATE_TRANSLATIONS["es-MX"];
          }
          return null;
        };

        const mergeCoverImageStateTranslations = (lang: string) => {
          const dict = resolveDictForLang(lang);
          const baseDict = COVER_IMAGE_STATE_TRANSLATIONS["en-US"];
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
          if (event.lang) {
            mergeCoverImageStateTranslations(event.lang);
          }
        });

        translate.onLangChange.subscribe((event) => {
          mergeCoverImageStateTranslations(event.lang);
        });
      },
    },
  ]);
}
