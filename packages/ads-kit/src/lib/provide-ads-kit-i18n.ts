import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { REMOVE_ADS_UPGRADE_KIT_TRANSLATIONS } from './remove-ads-upgrade/remove-ads-upgrade.translations';

export function provideAdsKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const merged = new Set<string>();
        const sampleKey = 'REMOVE_ADS_UPGRADE';

        const resolveDictForLang = (lang: string) => {
          if (!lang) return null;
          if (lang in REMOVE_ADS_UPGRADE_KIT_TRANSLATIONS) {
            return REMOVE_ADS_UPGRADE_KIT_TRANSLATIONS[lang];
          }
          if (
            lang === 'es-419' &&
            REMOVE_ADS_UPGRADE_KIT_TRANSLATIONS['es-MX']
          ) {
            return REMOVE_ADS_UPGRADE_KIT_TRANSLATIONS['es-MX'];
          }
          return null;
        };

        const mergeForLang = (lang: string) => {
          const dict = resolveDictForLang(lang);
          const base = REMOVE_ADS_UPGRADE_KIT_TRANSLATIONS['en-US'];
          if (!base && !dict) return;
          if (merged.has(lang)) return;
          merged.add(lang);

          if (base) {
            translate.setTranslation(lang, base, true);
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
              mergeForLang(event.lang);
            }
          });

          translate.onLangChange.subscribe((event) => {
            mergeForLang(event.lang);
            translate.instant(sampleKey);
          });
        } catch (error) {
          console.warn('[ads-kit] Failed to register purchase translations:', error);
        }
      },
    },
  ]);
}

