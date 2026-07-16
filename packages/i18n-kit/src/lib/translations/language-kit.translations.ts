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
  LANGUAGE_SETTINGS: {
    TITLE: string;
    PREPARING_COUNTDOWN: string;
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

const LANGUAGE_KIT_BASE_TRANSLATIONS: Pick<
  LanguageKitLocaleDictionary,
  'LANGUAGE_OPTIONS'
> = {
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

const LANGUAGE_KIT_SETTINGS_TRANSLATIONS: Record<
  SupportedLocale,
  Pick<LanguageKitLocaleDictionary, 'LANGUAGE_SETTINGS'>
> = {
  'en-US': {
    LANGUAGE_SETTINGS: {
      TITLE: 'Language',
      PREPARING_COUNTDOWN: 'Preparing everything in your language ({{count}})',
    },
  },
  'es-MX': {
    LANGUAGE_SETTINGS: {
      TITLE: 'Idioma',
      PREPARING_COUNTDOWN: 'Preparando todo en tu idioma ({{count}})',
    },
  },
  'de-DE': {
    LANGUAGE_SETTINGS: {
      TITLE: 'Sprache',
      PREPARING_COUNTDOWN: 'Alles wird in deiner Sprache vorbereitet ({{count}})',
    },
  },
  'fr-FR': {
    LANGUAGE_SETTINGS: {
      TITLE: 'Langue',
      PREPARING_COUNTDOWN: 'Pr\u00e9paration de tout dans votre langue ({{count}})',
    },
  },
  'it-IT': {
    LANGUAGE_SETTINGS: {
      TITLE: 'Lingua',
      PREPARING_COUNTDOWN: 'Sto preparando tutto nella tua lingua ({{count}})',
    },
  },
  'pt-BR': {
    LANGUAGE_SETTINGS: {
      TITLE: 'Idioma',
      PREPARING_COUNTDOWN: 'Preparando tudo no seu idioma ({{count}})',
    },
  },
  'zh-TW': {
    LANGUAGE_SETTINGS: {
      TITLE: '\u8a9e\u8a00',
      PREPARING_COUNTDOWN: '\u6b63\u5728\u70ba\u4f60\u7684\u8a9e\u8a00\u505a\u6e96\u5099\u3002\u61c9\u7528\u7a0b\u5f0f\u5c07\u95dc\u9589\u4ee5\u8b8a\u66f4\u540d\u7a31\uff08{{count}}\uff09',
    },
  },
  'hi-IN': {
    LANGUAGE_SETTINGS: {
      TITLE: '\u092d\u093e\u0937\u093e',
      PREPARING_COUNTDOWN: '\u0906\u092a\u0915\u0940 \u092d\u093e\u0937\u093e \u092e\u0947\u0902 \u0938\u092c \u0915\u0941\u091b \u0924\u0948\u092f\u093e\u0930 \u0915\u093f\u092f\u093e \u091c\u093e \u0930\u0939\u093e \u0939\u0948\u0964 \u0928\u093e\u092e \u092c\u0926\u0932\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u090f\u092a \u092c\u0902\u0926 \u0939\u094b\u0917\u093e ({{count}})',
    },
  },
  'ar-SA': {
    LANGUAGE_SETTINGS: {
      TITLE: '\u0627\u0644\u0644\u063a\u0629',
      PREPARING_COUNTDOWN: '\u062c\u0627\u0631\u064d \u062a\u062c\u0647\u064a\u0632 \u0643\u0644 \u0634\u064a\u0621 \u0628\u0644\u063a\u062a\u0643. \u0633\u064a\u064f\u063a\u0644\u0642 \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0644\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0627\u0633\u0645 ({{count}})',
    },
  },
  'ja-JP': {
    LANGUAGE_SETTINGS: {
      TITLE: '\u8a00\u8a9e',
      PREPARING_COUNTDOWN: '\u3042\u306a\u305f\u306e\u8a00\u8a9e\u3067\u6e96\u5099\u3057\u3066\u3044\u307e\u3059\u3002\u540d\u524d\u3092\u5909\u66f4\u3059\u308b\u305f\u3081\u306b\u30a2\u30d7\u30ea\u3092\u7d42\u4e86\u3057\u307e\u3059\uff08{{count}}\uff09',
    },
  },
  'ko-KR': {
    LANGUAGE_SETTINGS: {
      TITLE: '\uc5b8\uc5b4',
      PREPARING_COUNTDOWN: '\uc0ac\uc6a9\uc790 \uc5b8\uc5b4\ub85c \uc900\ube44 \uc911\uc785\ub2c8\ub2e4. \uc774\ub984 \ubcc0\uacbd\uc744 \uc704\ud574 \uc571\uc774 \uc885\ub8cc\ub429\ub2c8\ub2e4 ({{count}})',
    },
  },
  'zh-CN': {
    LANGUAGE_SETTINGS: {
      TITLE: '\u8bed\u8a00',
      PREPARING_COUNTDOWN: '\u6b63\u5728\u4e3a\u4f60\u7684\u8bed\u8a00\u505a\u51c6\u5907\u3002\u5e94\u7528\u5c06\u5173\u95ed\u4ee5\u66f4\u6539\u540d\u79f0\uff08{{count}}\uff09',
    },
  },
  'ru-RU': {
    LANGUAGE_SETTINGS: {
      TITLE: '\u042f\u0437\u044b\u043a',
      PREPARING_COUNTDOWN: '\u0412\u0441\u0435 \u043f\u043e\u0434\u0433\u043e\u0442\u0430\u0432\u043b\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u043d\u0430 \u0432\u0430\u0448\u0435\u043c \u044f\u0437\u044b\u043a\u0435. \u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0437\u0430\u043a\u0440\u043e\u0435\u0442\u0441\u044f, \u0447\u0442\u043e\u0431\u044b \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 ({{count}})',
    },
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
    translations[locale] = {
      ...LANGUAGE_KIT_BASE_TRANSLATIONS,
      ...LANGUAGE_KIT_SETTINGS_TRANSLATIONS[locale],
    };
    return translations;
  },
  {} as Record<SupportedLocale, LanguageKitLocaleDictionary>,
);

