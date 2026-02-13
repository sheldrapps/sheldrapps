import { ENVIRONMENT_INITIALIZER, inject, makeEnvironmentProviders } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EDITOR_TRANSLATIONS } from './editor.translations';
import { EDITOR_I18N_OVERRIDES } from './editor-i18n.tokens';

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
				try {
					const translate = inject(TranslateService);
					const overrides = inject(EDITOR_I18N_OVERRIDES, { optional: true });

					for (const [lang, dict] of Object.entries(EDITOR_TRANSLATIONS)) {
						translate.setTranslation(lang, dict, true);
					}

					if (overrides) {
						const firstKey = Object.keys(overrides)[0];
						const isPerLanguage = firstKey && typeof overrides[firstKey] === 'object';

						if (isPerLanguage) {
							for (const lang of Object.keys(overrides)) {
								const langOverrides = overrides[lang];
								if (typeof langOverrides === 'object') {
									translate.setTranslation(lang, langOverrides, true);
								}
							}
						} else {
							for (const lang of Object.keys(EDITOR_TRANSLATIONS)) {
								translate.setTranslation(lang, overrides as Record<string, string>, true);
							}
						}
					}
				} catch {
					// swallow to avoid breaking app bootstrap
				}
			},
		},
	]);
}
