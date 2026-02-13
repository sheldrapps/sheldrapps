import { ENVIRONMENT_INITIALIZER, inject, makeEnvironmentProviders } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { EDITOR_I18N_OVERRIDES } from "./editor-i18n.tokens";

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
        const http = inject(HttpClient);
        const overrides = inject(EDITOR_I18N_OVERRIDES, { optional: true });

        const languages = [
          "es-MX",
          "en-US",
          "de-DE",
          "fr-FR",
          "it-IT",
          "pt-BR",
        ];

        const editorPrefix = "./assets/i18n/editor/";
        const editorSuffix = ".json";
        const loaded = new Set<string>();

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

        const loadEditorTranslations = async (lang: string) => {
          if (!lang || loaded.has(lang)) return;
          if (!languages.includes(lang)) return;
          loaded.add(lang);

          const url = `${editorPrefix}${lang}${editorSuffix}`;
          // DEBUG: editor i18n loader path (remove after diagnosis)
          console.log("[editor-i18n] loading editor assets", {
            lang,
            url,
          });

          try {
            const dict =
              (await firstValueFrom(
                http.get<Record<string, string>>(url),
              )) ?? {};
            translate.setTranslation(lang, dict, true);
            // DEBUG: editor i18n load result (remove after diagnosis)
            console.log("[editor-i18n] loaded editor assets", {
              lang,
              keys: Object.keys(dict).length,
            });
          } catch (err) {
            console.warn("[editor-i18n] Failed to load editor assets:", {
              lang,
              url,
              err,
            });
          }

          applyOverridesForLang(lang);
        };

        try {
          translate.onLangChange.subscribe((event) => {
            // DEBUG: editor i18n onLangChange (remove after diagnosis)
            console.log("[editor-i18n] onLangChange", {
              lang: event.lang,
              currentLang: translate.currentLang,
              defaultLang: translate.defaultLang,
            });
            void loadEditorTranslations(event.lang);
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
