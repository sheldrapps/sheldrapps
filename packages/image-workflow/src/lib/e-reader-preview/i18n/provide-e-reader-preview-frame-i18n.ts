import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  E_READER_PREVIEW_FRAME_TRANSLATIONS,
  type EReaderPreviewFrameFlatDict,
} from './e-reader-preview-frame.translations';

export function provideEReaderPreviewFrameI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const sampleKey = 'E_READER_FRAME.COLOR_SELECTOR.TITLE';
        const merged = new Set<string>();

        const resolveDictForLang = (lang: string): EReaderPreviewFrameFlatDict | null => {
          if (!lang) {
            return null;
          }

          if (lang in E_READER_PREVIEW_FRAME_TRANSLATIONS) {
            return E_READER_PREVIEW_FRAME_TRANSLATIONS[
              lang as keyof typeof E_READER_PREVIEW_FRAME_TRANSLATIONS
            ];
          }

          return null;
        };

        const mergeFrameTranslations = (lang: string) => {
          const dict = resolveDictForLang(lang);
          const baseDict = E_READER_PREVIEW_FRAME_TRANSLATIONS['en-US'];
          if (!baseDict && !dict) {
            return;
          }
          if (merged.has(lang)) {
            return;
          }

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

        const currentLang = translate.currentLang || translate.defaultLang;
        if (currentLang) {
          mergeFrameTranslations(currentLang);
        }

        translate.onTranslationChange.subscribe((event) => {
          if (
            event.lang &&
            !Object.prototype.hasOwnProperty.call(event.translations, sampleKey)
          ) {
            mergeFrameTranslations(event.lang);
          }
        });

        translate.onLangChange.subscribe((event) => {
          mergeFrameTranslations(event.lang);
          translate.instant(sampleKey);
        });
      },
    },
  ]);
}
