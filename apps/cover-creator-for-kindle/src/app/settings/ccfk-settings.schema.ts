/**
 * Settings schema for Cover Creator for Kindle.
 */

import {
  mapToSupportedLocale,
  type SupportedLocale,
} from '@sheldrapps/i18n-kit';
import { SettingsSchema, type MigrationContext } from '@sheldrapps/settings-kit';

type PreferenceValue = boolean | number | string | null;

type LegacyCcfkSettings = {
  lang?: string;
  locale?: string;
  kindleModelId?: string;
  preferences?: Record<string, PreferenceValue>;
};

export interface CcfkSettings {
  locale?: SupportedLocale;
  kindleModelId?: string;
  preferences: Record<string, PreferenceValue>;
}

const LEGACY_SETTINGS_KEY = 'ccfk.settings';
const LEGACY_HINT_KEYS = [
  'cc_hint_save_share_explain_shown',
  'cc_hint_share_kindle_shown',
] as const;
const CCFK_SETTINGS_VERSION = 3;

const CCFK_DEFAULTS: CcfkSettings = {
  locale: undefined,
  kindleModelId: undefined,
  preferences: {},
};

export const CCFK_SETTINGS_SCHEMA: SettingsSchema<CcfkSettings> = {
  version: CCFK_SETTINGS_VERSION,
  defaults: CCFK_DEFAULTS,
  migrations: [
    {
      fromVersion: 'legacy',
      toVersion: CCFK_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<CcfkSettings>) => {
        const legacySettings = await readLegacySettings<LegacyCcfkSettings>(
          ctx,
          LEGACY_SETTINGS_KEY
        );
        const directLegacyLang = await ctx.legacy?.get('lang');
        const locale = await resolveStoredLocale(
          pickNonEmptyString(legacySettings?.locale) ||
            pickNonEmptyString(legacySettings?.lang) ||
            pickNonEmptyString(directLegacyLang)
        );
        const preferences = {
          ...normalizePreferences(legacySettings?.preferences),
          ...(await readLegacyPreferences(ctx, LEGACY_HINT_KEYS)),
        };

        return {
          locale,
          kindleModelId: pickNonEmptyString(legacySettings?.kindleModelId),
          preferences,
        };
      },
    },
    {
      fromVersion: 1,
      toVersion: CCFK_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<CcfkSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
    {
      fromVersion: 2,
      toVersion: CCFK_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<CcfkSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
  ],
};

async function resolveStoredLocale(
  storedLocale: string | undefined
): Promise<SupportedLocale | undefined> {
  const candidate = pickNonEmptyString(storedLocale);
  if (candidate) {
    return mapToSupportedLocale(candidate);
  }

  return undefined;
}

async function readLegacyPreferences(
  ctx: MigrationContext<CcfkSettings>,
  keys: readonly string[]
): Promise<Record<string, PreferenceValue>> {
  const preferences: Record<string, PreferenceValue> = {};

  for (const key of keys) {
    const raw = await ctx.legacy?.get(key);
    if (raw === 'true') {
      preferences[key] = true;
    }
  }

  return preferences;
}

async function migrateVersionedSettings(
  rawSettings: unknown
): Promise<CcfkSettings> {
  const stored = asRecord(rawSettings);
  const locale = await resolveStoredLocale(
    pickNonEmptyString(stored?.['locale']) || pickNonEmptyString(stored?.['lang'])
  );

  return {
    locale,
    kindleModelId: pickNonEmptyString(stored?.['kindleModelId']),
    preferences: normalizePreferences(stored?.['preferences']),
  };
}

async function readLegacySettings<T extends object>(
  ctx: MigrationContext<CcfkSettings>,
  key: string
): Promise<Partial<T> | null> {
  const raw = await ctx.legacy?.get(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      const data = parsed['data'];
      if (data && typeof data === 'object') {
        return data as Partial<T>;
      }

      return parsed as Partial<T>;
    }
  } catch {
    // Ignore malformed legacy payloads and fall back to other sources.
  }

  return null;
}

function pickNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePreferences(value: unknown): Record<string, PreferenceValue> {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  const preferences: Record<string, PreferenceValue> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (
      typeof entry === 'boolean' ||
      typeof entry === 'number' ||
      typeof entry === 'string' ||
      entry === null
    ) {
      preferences[key] = entry;
    }
  }

  return preferences;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}
