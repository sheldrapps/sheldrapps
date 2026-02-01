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
        console.log('[ccfk] Running legacy migration for language settings');

        // Try to read the old 'lang' key from localStorage
        const legacyLang = await ctx.legacy?.get('lang');

        if (legacyLang) {
          console.log('[ccfk] Found legacy language:', legacyLang);

          // Validate it's a non-empty string
          if (typeof legacyLang === 'string' && legacyLang.trim().length > 0) {
            console.log('[ccfk] Migrating language to settings-kit');

            // Remove the legacy key only after we've successfully read it
            // The actual removal will happen after the new settings are persisted
            await ctx.legacy?.remove('lang');
            console.log('[ccfk] Legacy language key removed');

            return { lang: legacyLang.trim() };
          }
        }

        console.log('[ccfk] No valid legacy language found, using defaults');
        return {};
      },
    },
  ],
};
