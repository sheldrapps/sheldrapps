import {
  ENVIRONMENT_INITIALIZER,
  inject,
  isDevMode,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EDITOR_I18N_OVERRIDES } from "./editor-i18n.tokens";
import { EDITOR_TRANSLATIONS, type FlatDict } from "./editor.translations";

/**
 * Provides editor i18n translations with optional app overrides.
 *
 * Registers default editor translations for all supported languages
 * and applies any provided overrides.
 */
export function provideEditorI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const overrides = inject(EDITOR_I18N_OVERRIDES, { optional: true });
        const sampleKey = "EDITOR.SHELL.TITLE";
        const merged = new Set<string>();

        const applyOverridesForLang = (lang: string) => {
          if (!overrides) return;

          const firstKey = Object.keys(overrides)[0];
          const isPerLanguage =
            firstKey && typeof overrides[firstKey] === "object";

          if (isPerLanguage) {
            const langOverrides = (overrides as Record<string, unknown>)[lang];
            if (langOverrides && typeof langOverrides === "object") {
              translate.setTranslation(
                lang,
                langOverrides as Record<string, string>,
                true,
              );
            }
          } else {
            translate.setTranslation(
              lang,
              overrides as Record<string, string>,
              true,
            );
          }
        };

        const resolveDictForLang = (lang: string): FlatDict | null => {
          if (!lang) return null;
          if (lang in EDITOR_TRANSLATIONS) {
            return EDITOR_TRANSLATIONS[lang as keyof typeof EDITOR_TRANSLATIONS];
          }
          if (lang === "es-MX" && EDITOR_TRANSLATIONS["es-419"]) {
            return EDITOR_TRANSLATIONS["es-419"];
          }
          return null;
        };

        const mergeEditorTranslations = (lang: string, reason: string) => {
          const dict = resolveDictForLang(lang);
          if (!dict) return;
          if (merged.has(lang)) return;
          merged.add(lang);

          translate.setTranslation(lang, dict, true);
          applyOverridesForLang(lang);

          if (isDevMode()) {
            // DEBUG: editor i18n merge snapshot (remove after diagnosis)
            console.log("[editor-i18n] merged editor translations", {
              lang,
              reason,
              keys: Object.keys(dict).length,
              sampleKey,
              hasSampleKey: Object.prototype.hasOwnProperty.call(dict, sampleKey),
              sampleValue: dict[sampleKey],
            });
          }

          queueMicrotask(() => {
            merged.delete(lang);
          });
        };

        try {
          if (isDevMode()) {
            const resolvedLang =
              translate.currentLang || translate.defaultLang || "unknown";
            const resolvedValue = translate.instant(sampleKey);
            // DEBUG: editor i18n initial resolve (remove after diagnosis)
            console.log("[editor-i18n] resolve snapshot", {
              lang: resolvedLang,
              key: sampleKey,
              value: resolvedValue,
              isMissing: resolvedValue === sampleKey,
            });
          }

          translate.onTranslationChange.subscribe((event) => {
            if (
              event.lang &&
              !Object.prototype.hasOwnProperty.call(event.translations, sampleKey)
            ) {
              mergeEditorTranslations(event.lang, "onTranslationChange");
            }
          });

          translate.onLangChange.subscribe((event) => {
            // Re-merge editor keys after app loaders set the base dictionary.
            mergeEditorTranslations(event.lang, "onLangChange");
            if (!isDevMode()) return;
            const resolvedValue = translate.instant(sampleKey);
            // DEBUG: editor i18n onLangChange (remove after diagnosis)
            console.log("[editor-i18n] onLangChange", {
              lang: event.lang,
              currentLang: translate.currentLang,
              defaultLang: translate.defaultLang,
              key: sampleKey,
              value: resolvedValue,
              isMissing: resolvedValue === sampleKey,
            });
          });
        } catch (err) {
          // Log a single warning if registration fails
          console.warn(
            "[editor-i18n] Failed to register editor translations:",
            err,
          );
        }
      },
    },
  ]);
}
