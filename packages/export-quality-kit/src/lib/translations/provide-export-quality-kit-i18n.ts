import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EXPORT_QUALITY_KIT_TRANSLATIONS } from './export-quality-kit.translations';

const TRANSLATION_SENTINEL_KEY = 'CREATE.EXPORT_OPTIONS.TITLE';
type ExportQualityTranslationDict =
  (typeof EXPORT_QUALITY_KIT_TRANSLATIONS)[keyof typeof EXPORT_QUALITY_KIT_TRANSLATIONS];

function resolveExportQualityTranslations(
  lang: string,
): ExportQualityTranslationDict | null {
  if (!lang) return null;
  if (lang in EXPORT_QUALITY_KIT_TRANSLATIONS) {
    return EXPORT_QUALITY_KIT_TRANSLATIONS[
      lang as keyof typeof EXPORT_QUALITY_KIT_TRANSLATIONS
    ];
  }
  if (lang === 'es-419') {
    return EXPORT_QUALITY_KIT_TRANSLATIONS['es-MX'];
  }
  return null;
}

/**
 * Registers export quality translations and keeps them merged
 * after language loads/changes from host apps.
 */
export function provideExportQualityKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const merged = new Set<string>();

        const mergeForLang = (lang: string) => {
          const dict = resolveExportQualityTranslations(lang);
          const baseDict = EXPORT_QUALITY_KIT_TRANSLATIONS['en-US'];
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

          for (const lang of Object.keys(EXPORT_QUALITY_KIT_TRANSLATIONS)) {
            mergeForLang(lang);
          }
        } catch (err) {
          console.warn(
            '[export-quality-kit] Failed to register translations:',
            err,
          );
        }
      },
    },
  ]);
}
