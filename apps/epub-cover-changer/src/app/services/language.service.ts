/**
 * Re-export and type definitions for language service
 * Actual implementation comes from @sheldrapps/i18n-kit
 */

import type { SupportedLocale } from '@sheldrapps/i18n-kit';

export { LanguageService } from '@sheldrapps/i18n-kit';

export type Lang = SupportedLocale;

export type LangOption = { code: Lang; label: string; flagClass: string };

/**
 * Helper to create LangOption array for UI binding
 */
export const LANG_OPTIONS: readonly LangOption[] = [
  {
    code: 'es-MX',
    label: 'Español (MX)',
    flagClass: 'app-language-option__flag--mx',
  },
  {
    code: 'en-US',
    label: 'English (US)',
    flagClass: 'app-language-option__flag--us',
  },
  {
    code: 'de-DE',
    label: 'Deutsch',
    flagClass: 'app-language-option__flag--de',
  },
  {
    code: 'fr-FR',
    label: 'Français',
    flagClass: 'app-language-option__flag--fr',
  },
  {
    code: 'it-IT',
    label: 'Italiano',
    flagClass: 'app-language-option__flag--it',
  },
  {
    code: 'pt-BR',
    label: 'Português (Brasil)',
    flagClass: 'app-language-option__flag--br',
  },
  {
    code: 'zh-TW',
    label: '繁體中文',
    flagClass: 'app-language-option__flag--tw',
  },
  {
    code: 'hi-IN',
    label: 'हिन्दी',
    flagClass: 'app-language-option__flag--in',
  },
  {
    code: 'ar-SA',
    label: 'العربية',
    flagClass: 'app-language-option__flag--sa',
  },
  {
    code: 'ja-JP',
    label: '日本語',
    flagClass: 'app-language-option__flag--jp',
  },
  {
    code: 'ko-KR',
    label: '한국어',
    flagClass: 'app-language-option__flag--kr',
  },
  {
    code: 'zh-CN',
    label: '简体中文',
    flagClass: 'app-language-option__flag--cn',
  },
  {
    code: 'ru-RU',
    label: 'Русский',
    flagClass: 'app-language-option__flag--ru',
  },
] as const;
