/**
 * Settings schema for Cover Creator for Kindle
 * Defines app-specific settings structure and migrations
 */

import { SettingsSchema, MigrationContext } from '@sheldrapps/settings-kit';

/**
 * Cover Creator settings interface
 */
export interface CcfkSettings {
  /**
   * User's selected language
   */
  lang: string;
}

/**
 * Default settings for Cover Creator
 */
const CCFK_DEFAULTS: CcfkSettings = {
  lang: 'es-MX',
};

/**
 * Settings schema with legacy migration
 */
export const CCFK_SETTINGS_SCHEMA: SettingsSchema<CcfkSettings> = {
  version: 1,
  defaults: CCFK_DEFAULTS,
  migrations: [
    {
      fromVersion: 'legacy',
      toVersion: 1,
      run: async (ctx: MigrationContext<CcfkSettings>) => {
        const legacyLang = await ctx.legacy?.get('lang');

        if (legacyLang) {
          if (typeof legacyLang === 'string' && legacyLang.trim().length > 0) {
            await ctx.legacy?.remove('lang');

            return { lang: legacyLang.trim() };
          }
        }

        return {};
      },
    },
  ],
};
