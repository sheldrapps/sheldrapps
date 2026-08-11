import type { SupportedLocale } from '@sheldrapps/i18n-kit';
import { SettingsSchema } from '@sheldrapps/settings-kit';
import type { AppThemeMode } from '@sheldrapps/ui-theme';
import {
  DEFAULT_EXPORT_QUALITY_MODE,
  type ExportQualityMode,
} from '@sheldrapps/export-quality-kit';

type PreferenceValue = boolean | number | string | null;

export interface PdfMergerAndSplitterSettings {
  language?: SupportedLocale;
  theme: AppThemeMode;
  exportQualityMode: ExportQualityMode;
  preferences: Record<string, PreferenceValue>;
}

const PDF_MERGER_AND_SPLITTER_DEFAULTS: PdfMergerAndSplitterSettings = {
  language: undefined,
  theme: 'light',
  exportQualityMode: DEFAULT_EXPORT_QUALITY_MODE,
  preferences: {},
};

export const PDF_MERGER_AND_SPLITTER_SETTINGS_SCHEMA: SettingsSchema<PdfMergerAndSplitterSettings> = {
  version: 1,
  defaults: PDF_MERGER_AND_SPLITTER_DEFAULTS,
};
