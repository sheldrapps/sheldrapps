import { ENVIRONMENT_INITIALIZER, inject, makeEnvironmentProviders } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
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
        const overrides = inject(EDITOR_I18N_OVERRIDES, { optional: true });

        const languages = [
          "es-MX",
          "en-US",
          "de-DE",
          "fr-FR",
          "it-IT",
          "pt-BR",
        ];

        // In-memory default translations for the editor
        const EDITOR_TRANSLATIONS: Record<string, Record<string, string>> = {
          "es-MX": {},
          "en-US": {},
          "de-DE": {},
          "fr-FR": {},
          "it-IT": {},
          "pt-BR": {},
        };

        try {
          // Register defaults
          for (const lang of languages) {
            translate.setTranslation(
              lang,
              EDITOR_TRANSLATIONS[lang] || {},
              true,
            );
          }

          // Apply overrides after defaults
          if (overrides) {
            const firstKey = Object.keys(overrides)[0];
            const isPerLanguage =
              firstKey && typeof overrides[firstKey] === "object";

            if (isPerLanguage) {
              for (const lang of Object.keys(overrides)) {
                const langOverrides = overrides[lang];
                if (typeof langOverrides === "object") {
                  translate.setTranslation(lang, langOverrides, true);
                }
              }
            } else {
              for (const lang of languages) {
                translate.setTranslation(
                  lang,
                  overrides as Record<string, string>,
                  true,
                );
              }
            }
          }
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
