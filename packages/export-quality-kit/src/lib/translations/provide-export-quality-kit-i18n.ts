import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EXPORT_QUALITY_KIT_TRANSLATIONS } from './export-quality-kit.translations';

/**
 * Provides export quality kit i18n translations.
 *
 * Registers default export quality translations for all supported languages.
 */
export function provideExportQualityKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const sampleKey = "EXPORT_OPTIONS";
        const merged = new Set<string>();

        const resolveDictForLang = (lang: string) => {
          if (!lang) return null;
          if (lang in EXPORT_QUALITY_KIT_TRANSLATIONS) {
            return EXPORT_QUALITY_KIT_TRANSLATIONS[
              lang as keyof typeof EXPORT_QUALITY_KIT_TRANSLATIONS
            ];
          }
          if (lang === 'es-MX' && (EXPORT_QUALITY_KIT_TRANSLATIONS as any)['es-419']) {
            return (EXPORT_QUALITY_KIT_TRANSLATIONS as any)['es-419'];
          }
          return null;
        };

        const mergeExportQualityTranslations = (lang: string) => {
          const dict = resolveDictForLang(lang);
          const baseDict = EXPORT_QUALITY_KIT_TRANSLATIONS['en-US'];
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
              mergeExportQualityTranslations(event.lang);
            }
          });

          translate.onLangChange.subscribe((event) => {
            mergeExportQualityTranslations(event.lang);
            translate.instant(sampleKey);
          });
        } catch (err) {
          console.warn(
            '[export-quality-kit] Failed to register export quality translations:',
            err,
          );
        }
      },
    },
  ]);
}
