import { DE_DE } from './de-DE';
import { EN_US } from './en-US';
import { ES_MX } from './es-MX';
import { FR_FR } from './fr-FR';
import { IT_IT } from './it-IT';
import { PT_BR } from './pt-BR';
import type {
  RecommendedAppsLocale,
  RecommendedAppsTranslations,
} from './types';
import {
  resolveLocaleWithFallback,
  resolveLocaleWithFallbackAsync,
} from '../recommended-apps.runtime.js';

const DEFAULT_RECOMMENDED_APPS_LOCALE: RecommendedAppsLocale = 'en-US';

const RECOMMENDED_APPS_TRANSLATIONS: Record<
  RecommendedAppsLocale,
  RecommendedAppsTranslations
> = {
  'es-MX': ES_MX,
  'en-US': EN_US,
  'de-DE': DE_DE,
  'fr-FR': FR_FR,
  'it-IT': IT_IT,
  'pt-BR': PT_BR,
};

const SUPPORTED_RECOMMENDED_APPS_LOCALES = Object.keys(
  RECOMMENDED_APPS_TRANSLATIONS
) as RecommendedAppsLocale[];

export function detectRecommendedAppsLocale(
  preferredLocale?: string
): RecommendedAppsLocale {
  return resolveLocaleWithFallback(
    SUPPORTED_RECOMMENDED_APPS_LOCALES,
    preferredLocale,
    DEFAULT_RECOMMENDED_APPS_LOCALE
  ) as RecommendedAppsLocale;
}

export async function detectRecommendedAppsLocaleAsync(
  preferredLocale?: string
): Promise<RecommendedAppsLocale> {
  return (await resolveLocaleWithFallbackAsync(
    SUPPORTED_RECOMMENDED_APPS_LOCALES,
    preferredLocale,
    DEFAULT_RECOMMENDED_APPS_LOCALE
  )) as RecommendedAppsLocale;
}

export function getRecommendedAppsTranslations(
  preferredLocale?: string
): RecommendedAppsTranslations {
  const locale = detectRecommendedAppsLocale(preferredLocale);
  return RECOMMENDED_APPS_TRANSLATIONS[locale];
}

export async function getRecommendedAppsTranslationsAsync(
  preferredLocale?: string
): Promise<RecommendedAppsTranslations> {
  const locale = await detectRecommendedAppsLocaleAsync(preferredLocale);
  return RECOMMENDED_APPS_TRANSLATIONS[locale];
}
