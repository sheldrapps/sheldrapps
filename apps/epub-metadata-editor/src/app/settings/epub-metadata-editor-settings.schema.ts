import type { SupportedLocale } from '@sheldrapps/i18n-kit';
import { SettingsSchema } from '@sheldrapps/settings-kit';
import type { AppThemeMode } from '@sheldrapps/ui-theme';

type PreferenceValue = boolean | number | string | null;

export interface EpubMetadataEditorSettings {
  language?: SupportedLocale;
  theme: AppThemeMode;
  preferences: Record<string, PreferenceValue>;
}

export const EPUB_METADATA_EDITOR_PACKAGE_ID =
  'com.sheldrapps.epubmetadataeditor';
export const EPUB_METADATA_EDITOR_RATING_STORAGE_KEY =
  'rating.epub-metadata-editor';

export const EPUB_METADATA_EDITOR_SETTINGS_SCHEMA: SettingsSchema<EpubMetadataEditorSettings> = {
  version: 1,
  defaults: {
    language: undefined,
    theme: 'light',
    preferences: {},
  },
};
