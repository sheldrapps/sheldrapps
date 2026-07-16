import type { SupportedLocale } from '@sheldrapps/i18n-kit';
import { SettingsSchema } from '@sheldrapps/settings-kit';
import type { AppThemeMode } from '@sheldrapps/ui-theme';

type PreferenceValue = boolean | number | string | null;

export interface EpubMergerAndSplitterSettings {
  language?: SupportedLocale;
  theme: AppThemeMode;
  preferences: Record<string, PreferenceValue>;
}

const EPUB_MERGER_AND_SPLITTER_DEFAULTS: EpubMergerAndSplitterSettings = {
  language: undefined,
  theme: 'light',
  preferences: {},
};

export const EPUB_MERGER_AND_SPLITTER_SETTINGS_SCHEMA: SettingsSchema<EpubMergerAndSplitterSettings> = {
  version: 1,
  defaults: EPUB_MERGER_AND_SPLITTER_DEFAULTS,
};
