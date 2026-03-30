/**
 * Re-export and type definitions for language service.
 * Actual implementation comes from @sheldrapps/i18n-kit.
 */

import type { SupportedLocale } from '@sheldrapps/i18n-kit';

export { LanguageService } from '@sheldrapps/i18n-kit';

export type Lang = SupportedLocale;

export type LangOption = { code: Lang; label: string };

export const LANG_OPTIONS: readonly LangOption[] = [
  { code: 'es-MX', label: 'Español (MX)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Francais' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'pt-BR', label: 'Portugues (Brasil)' },
] as const;
