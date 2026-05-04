import { AR_SA } from "./ar-SA";
import { DE_DE } from "./de-DE";
import { EN_US } from "./en-US";
import { ES_MX } from "./es-MX";
import { FR_FR } from "./fr-FR";
import { HI_IN } from "./hi-IN";
import { IT_IT } from "./it-IT";
import { JA_JP } from "./ja-JP";
import { KO_KR } from "./ko-KR";
import { PT_BR } from "./pt-BR";
import { RU_RU } from "./ru-RU";
import { ZH_CN } from "./zh-CN";
import { ZH_TW } from "./zh-TW";
import type {
  RecommendedAppsLocale,
  RecommendedAppsTranslations,
} from "./types";
import {
  resolveLocaleWithFallback,
  resolveLocaleWithFallbackAsync,
} from "../recommended-apps.runtime.js";

const DEFAULT_RECOMMENDED_APPS_LOCALE: RecommendedAppsLocale = "en-US";

const RECOMMENDED_APPS_TRANSLATIONS: Record<
  RecommendedAppsLocale,
  RecommendedAppsTranslations
> = {
  "es-MX": ES_MX,
  "en-US": EN_US,
  "de-DE": DE_DE,
  "fr-FR": FR_FR,
  "it-IT": IT_IT,
  "pt-BR": PT_BR,
  "ar-SA": AR_SA,
  "hi-IN": HI_IN,
  "ja-JP": JA_JP,
  "ko-KR": KO_KR,
  "ru-RU": RU_RU,
  "zh-CN": ZH_CN,
  "zh-TW": ZH_TW,
};

const SUPPORTED_RECOMMENDED_APPS_LOCALES = Object.keys(
  RECOMMENDED_APPS_TRANSLATIONS,
) as RecommendedAppsLocale[];

export function detectRecommendedAppsLocale(
  preferredLocale?: string,
): RecommendedAppsLocale {
  return resolveLocaleWithFallback(
    SUPPORTED_RECOMMENDED_APPS_LOCALES,
    preferredLocale,
    DEFAULT_RECOMMENDED_APPS_LOCALE,
  ) as RecommendedAppsLocale;
}

export async function detectRecommendedAppsLocaleAsync(
  preferredLocale?: string,
): Promise<RecommendedAppsLocale> {
  return (await resolveLocaleWithFallbackAsync(
    SUPPORTED_RECOMMENDED_APPS_LOCALES,
    preferredLocale,
    DEFAULT_RECOMMENDED_APPS_LOCALE,
  )) as RecommendedAppsLocale;
}

export function getRecommendedAppsTranslations(
  preferredLocale?: string,
): RecommendedAppsTranslations {
  const locale = detectRecommendedAppsLocale(preferredLocale);
  return RECOMMENDED_APPS_TRANSLATIONS[locale];
}

export async function getRecommendedAppsTranslationsAsync(
  preferredLocale?: string,
): Promise<RecommendedAppsTranslations> {
  const locale = await detectRecommendedAppsLocaleAsync(preferredLocale);
  return RECOMMENDED_APPS_TRANSLATIONS[locale];
}
