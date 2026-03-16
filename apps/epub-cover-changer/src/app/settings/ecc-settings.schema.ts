/**
 * Settings schema for EPUB Cover Changer.
 */

import {
  mapToSupportedLocale,
  type SupportedLocale,
} from '@sheldrapps/i18n-kit';
import { SettingsSchema, type MigrationContext } from '@sheldrapps/settings-kit';

type PreferenceValue = boolean | number | string | null;

type LegacyEccSettings = {
  lang?: string;
  language?: string;
  locale?: string;
  cropTargetId?: string;
  homeTourSeen?: boolean;
  homeTourVersion?: number;
  homeTourSeenAt?: string;
  preferences?: Record<string, PreferenceValue>;
};

export interface EccSettings {
  language?: SupportedLocale;
  cropTargetId?: string;
  homeTourSeen: boolean;
  homeTourVersion: number;
  homeTourSeenAt?: string;
  preferences: Record<string, PreferenceValue>;
}

const LEGACY_SETTINGS_KEY = 'ecc.settings';
const LEGACY_HINT_KEYS = [
  'cc_hint_save_share_explain_shown',
  'cc_hint_share_kindle_shown',
] as const;
const ECC_SETTINGS_VERSION = 6;

const ECC_DEFAULTS: EccSettings = {
  language: undefined,
  cropTargetId: undefined,
  homeTourSeen: false,
  homeTourVersion: 0,
  homeTourSeenAt: undefined,
  preferences: {},
};

export const ECC_SETTINGS_SCHEMA: SettingsSchema<EccSettings> = {
  version: ECC_SETTINGS_VERSION,
  defaults: ECC_DEFAULTS,
  migrations: [
    {
      fromVersion: 'legacy',
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) => {
        const legacySettings = await readLegacySettings<LegacyEccSettings>(
          ctx,
          LEGACY_SETTINGS_KEY
        );
        const directLegacyLang = await ctx.legacy?.get('lang');
        const language = await resolveStoredLocale(
          pickNonEmptyString(legacySettings?.language) ||
            pickNonEmptyString(legacySettings?.locale) ||
            pickNonEmptyString(legacySettings?.lang) ||
            pickNonEmptyString(directLegacyLang)
        );
        const preferences = {
          ...normalizePreferences(legacySettings?.preferences),
          ...(await readLegacyPreferences(ctx, LEGACY_HINT_KEYS)),
        };

        return {
          language,
          cropTargetId: pickNonEmptyString(legacySettings?.cropTargetId),
          homeTourSeen: pickBoolean(legacySettings?.homeTourSeen) ?? false,
          homeTourVersion: pickNumber(legacySettings?.homeTourVersion) ?? 0,
          homeTourSeenAt: pickNonEmptyString(legacySettings?.homeTourSeenAt),
          preferences,
        };
      },
    },
    {
      fromVersion: 1,
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
    {
      fromVersion: 2,
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
    {
      fromVersion: 3,
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
    {
      fromVersion: 4,
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
    {
      fromVersion: 5,
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) =>
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
  ctx: MigrationContext<EccSettings>,
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
): Promise<EccSettings> {
  const stored = asRecord(rawSettings);
  const language = await resolveStoredLocale(
    pickNonEmptyString(stored?.['language']) ||
      pickNonEmptyString(stored?.['locale']) ||
      pickNonEmptyString(stored?.['lang'])
  );

  return {
    language,
    cropTargetId: pickNonEmptyString(stored?.['cropTargetId']),
    homeTourSeen: pickBoolean(stored?.['homeTourSeen']) ?? false,
    homeTourVersion: pickNumber(stored?.['homeTourVersion']) ?? 0,
    homeTourSeenAt: pickNonEmptyString(stored?.['homeTourSeenAt']),
    preferences: normalizePreferences(stored?.['preferences']),
  };
}

async function readLegacySettings<T extends object>(
  ctx: MigrationContext<EccSettings>,
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

function pickBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
