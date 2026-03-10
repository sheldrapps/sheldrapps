import type { SupportedLocale } from '@sheldrapps/i18n-kit';
import { SettingsSchema } from '@sheldrapps/settings-kit';

export type PreferenceValue = boolean | number | string | null;

export type NextStepTheme = 'system' | 'light' | 'dark';

export interface NextStepSettings {
  language?: SupportedLocale;
  theme: NextStepTheme;
  userPreferences: Record<string, PreferenceValue>;
}

const NEXT_STEP_DEFAULT_SETTINGS: NextStepSettings = {
  language: undefined,
  theme: 'system',
  userPreferences: {},
};

export const NEXT_STEP_SETTINGS_SCHEMA: SettingsSchema<NextStepSettings> = {
  version: 1,
  defaults: NEXT_STEP_DEFAULT_SETTINGS,
};

export function isNextStepTheme(value: string): value is NextStepTheme {
  return value === 'system' || value === 'light' || value === 'dark';
}
