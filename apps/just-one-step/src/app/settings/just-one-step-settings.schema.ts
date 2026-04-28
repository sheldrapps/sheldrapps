import type { SupportedLocale } from '@sheldrapps/i18n-kit';
import { SettingsSchema } from '@sheldrapps/settings-kit';
import { isAppThemeMode, type AppThemeMode } from '@sheldrapps/ui-theme';

export type PreferenceValue = boolean | number | string | null;

export type JustOneStepTheme = AppThemeMode;

export interface JustOneStepSettings {
  language?: SupportedLocale;
  theme: JustOneStepTheme;
  userPreferences: Record<string, PreferenceValue>;
}

const JUST_ONE_STEP_DEFAULT_SETTINGS: JustOneStepSettings = {
  language: undefined,
  theme: 'system',
  userPreferences: {},
};

export const JUST_ONE_STEP_SETTINGS_SCHEMA: SettingsSchema<JustOneStepSettings> = {
  version: 1,
  defaults: JUST_ONE_STEP_DEFAULT_SETTINGS,
};

export function isJustOneStepTheme(value: string): value is JustOneStepTheme {
  return isAppThemeMode(value);
}
