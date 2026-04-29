import type { SupportedLocale } from '@sheldrapps/i18n-kit';

export { LanguageService } from '@sheldrapps/i18n-kit';

export type Lang = SupportedLocale;

export type LangOption = {
  code: Lang;
  label: string;
  flagClass: string;
};

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
] as const;
