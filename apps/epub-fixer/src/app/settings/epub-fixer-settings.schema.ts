import type { SupportedLocale } from '@sheldrapps/i18n-kit';
import { SettingsSchema } from '@sheldrapps/settings-kit';
import type { AppThemeMode } from '@sheldrapps/ui-theme';

type PreferenceValue = boolean | number | string | null;

export interface EpubFixerSettings {
  language?: SupportedLocale;
  theme: AppThemeMode;
  preferences: Record<string, PreferenceValue>;
}

const EPUB_FIXER_DEFAULTS: EpubFixerSettings = {
  language: undefined,
  theme: 'system',
  preferences: {},
};

export const EPUB_FIXER_SETTINGS_SCHEMA: SettingsSchema<EpubFixerSettings> = {
  version: 1,
  defaults: EPUB_FIXER_DEFAULTS,
};
