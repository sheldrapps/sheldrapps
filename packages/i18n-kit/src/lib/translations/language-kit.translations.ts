import type { SupportedLocale } from '../locale-detection.service';

export type LanguageKitLocaleDictionary = {
  LANGUAGE_OPTIONS: {
    AR_SA: string;
    DE_DE: string;
    EN_US: string;
    ES_MX: string;
    FR_FR: string;
    HI_IN: string;
    IT_IT: string;
    JA_JP: string;
    KO_KR: string;
    PT_BR: string;
    RU_RU: string;
    ZH_CN: string;
    ZH_TW: string;
  };
};

export type LangOption = {
  code: SupportedLocale;
  labelKey: string;
  flagClass: string;
};

export const LANG_OPTIONS: readonly LangOption[] = [
  {
    code: 'ar-SA',
    labelKey: 'LANGUAGE_OPTIONS.AR_SA',
    flagClass: 'app-language-option__flag--sa',
  },
  {
    code: 'de-DE',
    labelKey: 'LANGUAGE_OPTIONS.DE_DE',
    flagClass: 'app-language-option__flag--de',
  },
  {
    code: 'en-US',
    labelKey: 'LANGUAGE_OPTIONS.EN_US',
    flagClass: 'app-language-option__flag--us',
  },
  {
    code: 'es-MX',
    labelKey: 'LANGUAGE_OPTIONS.ES_MX',
    flagClass: 'app-language-option__flag--mx',
  },
  {
    code: 'fr-FR',
    labelKey: 'LANGUAGE_OPTIONS.FR_FR',
    flagClass: 'app-language-option__flag--fr',
  },
  {
    code: 'hi-IN',
    labelKey: 'LANGUAGE_OPTIONS.HI_IN',
    flagClass: 'app-language-option__flag--in',
  },
  {
    code: 'it-IT',
    labelKey: 'LANGUAGE_OPTIONS.IT_IT',
    flagClass: 'app-language-option__flag--it',
  },
  {
    code: 'ja-JP',
    labelKey: 'LANGUAGE_OPTIONS.JA_JP',
    flagClass: 'app-language-option__flag--jp',
  },
  {
    code: 'ko-KR',
    labelKey: 'LANGUAGE_OPTIONS.KO_KR',
    flagClass: 'app-language-option__flag--kr',
  },
  {
    code: 'pt-BR',
    labelKey: 'LANGUAGE_OPTIONS.PT_BR',
    flagClass: 'app-language-option__flag--br',
  },
  {
    code: 'ru-RU',
    labelKey: 'LANGUAGE_OPTIONS.RU_RU',
    flagClass: 'app-language-option__flag--ru',
  },
  {
    code: 'zh-CN',
    labelKey: 'LANGUAGE_OPTIONS.ZH_CN',
    flagClass: 'app-language-option__flag--cn',
  },
  {
    code: 'zh-TW',
    labelKey: 'LANGUAGE_OPTIONS.ZH_TW',
    flagClass: 'app-language-option__flag--tw',
  },
] as const;

const LANGUAGE_KIT_BASE_TRANSLATIONS: LanguageKitLocaleDictionary = {
  LANGUAGE_OPTIONS: {
    AR_SA: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
    DE_DE: 'Deutsch',
    EN_US: 'English (US)',
    ES_MX: 'Espa\u00f1ol (MX)',
    FR_FR: 'Fran\u00e7ais',
    HI_IN: '\u0939\u093f\u0928\u094d\u0926\u0940',
    IT_IT: 'Italiano',
    JA_JP: '\u65e5\u672c\u8a9e',
    KO_KR: '\ud55c\uad6d\uc5b4',
    PT_BR: 'Portugu\u00eas (Brasil)',
    RU_RU: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
    ZH_CN: '\u7b80\u4f53\u4e2d\u6587',
    ZH_TW: '\u7e41\u9ad4\u4e2d\u6587',
  },
};

const LANGUAGE_KIT_SUPPORTED_LOCALES = [
  'en-US',
  'es-MX',
  'de-DE',
  'fr-FR',
  'it-IT',
  'pt-BR',
  'zh-TW',
  'hi-IN',
  'ar-SA',
  'ja-JP',
  'ko-KR',
  'zh-CN',
  'ru-RU',
] as const satisfies readonly SupportedLocale[];

export const LANGUAGE_KIT_TRANSLATIONS: Record<
  SupportedLocale,
  LanguageKitLocaleDictionary
> = LANGUAGE_KIT_SUPPORTED_LOCALES.reduce(
  (translations, locale) => {
    translations[locale] = LANGUAGE_KIT_BASE_TRANSLATIONS;
    return translations;
  },
  {} as Record<SupportedLocale, LanguageKitLocaleDictionary>,
);
