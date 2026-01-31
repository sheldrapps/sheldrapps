/**
 * Settings schema for Control presupuestal
 * Defines app-specific settings structure and migrations
 */

import { SettingsSchema } from '@sheldrapps/settings-kit';

/**
 * Presupuesto settings interface
 */
export interface PresupuestoSettings {
  /**
   * User's selected language
   */
  lang: string;
  
  /**
   * User's name/nickname (optional)
   */
  userName?: string;
}

/**
 * Default settings for Control presupuestal
 */
const PRESUPUESTO_DEFAULTS: PresupuestoSettings = {
  lang: 'es-MX',
};

/**
 * Settings schema
 */
export const PRESUPUESTO_SETTINGS_SCHEMA: SettingsSchema<PresupuestoSettings> = {
  version: 1,
  defaults: PRESUPUESTO_DEFAULTS,
  migrations: [],
};
