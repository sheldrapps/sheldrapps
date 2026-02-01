/**
 * Re-export and type definitions for language service
 * Actual implementation comes from @sheldrapps/i18n-kit
 */

import { LanguageService as BaseLanguageService } from '@sheldrapps/i18n-kit';

export { LanguageService } from '@sheldrapps/i18n-kit';

export type Lang = 'es-MX' | 'en-US' | 'de-DE' | 'fr-FR' | 'it-IT' | 'pt-BR';

export type LangOption = { code: Lang; label: string };

/**
 * Helper to create LangOption array for UI binding
 */
export const LANG_OPTIONS: readonly LangOption[] = [
  { code: 'es-MX', label: 'Español (MX)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
] as const;
