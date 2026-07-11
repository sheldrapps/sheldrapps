import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PRIVACY_POLICY_KIT_TRANSLATIONS } from './privacy-policy.translations';

export function providePrivacyPolicyKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const merged = new Set<string>();

        const resolveDictForLang = (lang: string) => {
          if (!lang) return null;
          if (lang in PRIVACY_POLICY_KIT_TRANSLATIONS) {
            return PRIVACY_POLICY_KIT_TRANSLATIONS[lang];
          }
          if (
            lang === 'es-419' &&
            PRIVACY_POLICY_KIT_TRANSLATIONS['es-MX']
          ) {
            return PRIVACY_POLICY_KIT_TRANSLATIONS['es-MX'];
          }
          return PRIVACY_POLICY_KIT_TRANSLATIONS['en-US'];
        };

        const mergeForLang = (lang: string) => {
          if (!lang || merged.has(lang)) {
            return;
          }

          const base = PRIVACY_POLICY_KIT_TRANSLATIONS['en-US'];
          const dict = resolveDictForLang(lang);

          if (!base && !dict) {
            return;
          }

          merged.add(lang);

          if (base) {
            translate.setTranslation(lang, base, true);
          }
          if (dict && dict !== base) {
            translate.setTranslation(lang, dict, true);
          }

          queueMicrotask(() => {
            merged.delete(lang);
          });
        };

        try {
          for (const lang of Object.keys(PRIVACY_POLICY_KIT_TRANSLATIONS)) {
            mergeForLang(lang);
          }

          translate.onTranslationChange.subscribe((event) => {
            if (event.lang) {
              mergeForLang(event.lang);
            }
          });

          translate.onLangChange.subscribe((event) => {
            mergeForLang(event.lang);
          });
        } catch (error) {
          console.warn(
            '[privacy-policy-kit] Failed to register privacy translations:',
            error,
          );
        }
      },
    },
  ]);
}
