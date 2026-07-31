/**
 * Settings schema for EPUB Cover Changer.
 */

import {
  mapToSupportedLocale,
  type SupportedLocale,
} from '@sheldrapps/i18n-kit';
import { SettingsSchema, type MigrationContext } from '@sheldrapps/settings-kit';
import { normalizeAppThemeMode, type AppThemeMode } from '@sheldrapps/ui-theme';
import {
  DEFAULT_EXPORT_QUALITY_MODE,
  migrateLegacyExportQualityMode,
  type ExportQualityMode,
} from '@sheldrapps/export-quality-kit';
import type {
  CropOrientation,
  CropTargetCategory,
} from '@sheldrapps/image-workflow/editor';

type PreferenceValue = boolean | number | string | null;

type LegacyEccSettings = {
  lang?: string;
  language?: string;
  locale?: string;
  theme?: string;
  cropTargetId?: string;
  cropTargetCategory?: CropTargetCategory;
  cropTargetOrientation?: CropOrientation;
  eReaderBrandId?: string;
  eReaderModelId?: string;
  exportQualityMode?: string;
  coverExportMode?: string;
  bestQuality?: boolean;
  adsRemoved?: boolean;
  preferences?: Record<string, PreferenceValue>;
};

export interface EccSettings {
  language?: SupportedLocale;
  theme: AppThemeMode;
  cropTargetId?: string;
  cropTargetCategory?: CropTargetCategory;
  cropTargetOrientation?: CropOrientation;
  eReaderBrandId?: string;
  eReaderModelId?: string;
  exportQualityMode: ExportQualityMode;
  adsRemoved: boolean;
  preferences: Record<string, PreferenceValue>;
}

const LEGACY_SETTINGS_KEY = 'ecc.settings';
const LEGACY_HINT_KEYS = [
  'cc_hint_save_share_explain_shown',
  'cc_hint_share_kindle_shown',
] as const;
const ECC_SETTINGS_VERSION = 10;

const ECC_DEFAULTS: EccSettings = {
  language: undefined,
  theme: 'system',
  cropTargetId: undefined,
  cropTargetCategory: undefined,
  cropTargetOrientation: undefined,
  eReaderBrandId: undefined,
  eReaderModelId: undefined,
  exportQualityMode: DEFAULT_EXPORT_QUALITY_MODE,
  adsRemoved: false,
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
          LEGACY_SETTINGS_KEY,
        );
        const directLegacyLang = await ctx.legacy?.get('lang');
        const language = await resolveStoredLocale(
          pickNonEmptyString(legacySettings?.language) ||
            pickNonEmptyString(legacySettings?.locale) ||
            pickNonEmptyString(legacySettings?.lang) ||
            pickNonEmptyString(directLegacyLang),
        );
        const preferences = {
          ...normalizePreferences(legacySettings?.preferences),
          ...(await readLegacyPreferences(ctx, LEGACY_HINT_KEYS)),
        };

        return {
          language,
          theme: normalizeAppThemeMode(legacySettings?.['theme']) ?? 'system',
          cropTargetId: pickNonEmptyString(legacySettings?.cropTargetId),
          cropTargetCategory: normalizeCropTargetCategory(legacySettings?.cropTargetCategory),
          cropTargetOrientation: normalizeCropOrientation(legacySettings?.cropTargetOrientation),
          eReaderBrandId: pickNonEmptyString(legacySettings?.eReaderBrandId),
          eReaderModelId: pickNonEmptyString(legacySettings?.eReaderModelId),
          exportQualityMode: migrateLegacyExportQualityMode({
            exportQualityMode: legacySettings?.exportQualityMode,
            coverExportMode: legacySettings?.coverExportMode,
            bestQuality: legacySettings?.bestQuality,
          }),
          adsRemoved: pickBoolean(legacySettings?.adsRemoved) ?? false,
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
    {
      fromVersion: 6,
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
    {
      fromVersion: 7,
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
    {
      fromVersion: 8,
      toVersion: ECC_SETTINGS_VERSION,
      run: async (ctx: MigrationContext<EccSettings>) =>
        migrateVersionedSettings(ctx.rawJson),
    },
    {
      fromVersion: 9,
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
    theme: normalizeAppThemeMode(stored?.['theme']) ?? 'system',
    cropTargetId: pickNonEmptyString(stored?.['cropTargetId']),
    cropTargetCategory: normalizeCropTargetCategory(stored?.['cropTargetCategory']),
    cropTargetOrientation: normalizeCropOrientation(stored?.['cropTargetOrientation']),
    eReaderBrandId: pickNonEmptyString(stored?.['eReaderBrandId']),
    eReaderModelId: pickNonEmptyString(stored?.['eReaderModelId']),
    exportQualityMode: migrateLegacyExportQualityMode({
      exportQualityMode: stored?.['exportQualityMode'],
      coverExportMode: stored?.['coverExportMode'],
      bestQuality: stored?.['bestQuality'],
    }),
    adsRemoved: pickBoolean(stored?.['adsRemoved']) ?? false,
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

function normalizeCropTargetCategory(value: unknown): CropTargetCategory | undefined {
  return value === 'e-reader' || value === 'publishing' || value === 'paper' || value === 'ratio'
    ? value
    : undefined;
}

function normalizeCropOrientation(value: unknown): CropOrientation | undefined {
  return value === 'portrait' || value === 'landscape' ? value : undefined;
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
