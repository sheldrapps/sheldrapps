/**
 * Settings schema for EPUB Cover Changer
 * Defines app-specific settings structure and migrations
 */

import { SettingsSchema, MigrationContext } from '@sheldrapps/settings-kit';

/**
 * EPUB Cover Changer settings interface
 */
export interface EccSettings {
  /**
   * User's selected language
   */
  lang: string;
}

/**
 * Default settings for EPUB Cover Changer
 */
const ECC_DEFAULTS: EccSettings = {
  lang: 'es-MX',
};

/**
 * Settings schema with legacy migration
 */
export const ECC_SETTINGS_SCHEMA: SettingsSchema<EccSettings> = {
  version: 1,
  defaults: ECC_DEFAULTS,
  migrations: [
    {
      fromVersion: 'legacy',
      toVersion: 1,
      run: async (ctx: MigrationContext<EccSettings>) => {
        console.log('[ecc] Running legacy migration for language settings');

        // Try to read the old 'lang' key from localStorage
        const legacyLang = await ctx.legacy?.get('lang');

        if (legacyLang) {
          console.log('[ecc] Found legacy language:', legacyLang);

          // Validate it's a non-empty string
          if (typeof legacyLang === 'string' && legacyLang.trim().length > 0) {
            console.log('[ecc] Migrating language to settings-kit');

            // Remove the legacy key only after we've successfully read it
            // The actual removal will happen after the new settings are persisted
            await ctx.legacy?.remove('lang');
            console.log('[ecc] Legacy language key removed');

            return { lang: legacyLang.trim() };
          }
        }

        console.log('[ecc] No valid legacy language found, using defaults');
        return {};
      },
    },
  ],
};

