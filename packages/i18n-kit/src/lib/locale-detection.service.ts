/**
 * Shared locale detection and mapping helpers.
 */

import { Injectable } from '@angular/core';

export type SupportedLocale =
  | "en-US"
  | "es-MX"
  | "de-DE"
  | "fr-FR"
  | "it-IT"
  | "pt-BR"
  | "zh-TW"
  | "hi-IN"
  | "ar-SA"
  | "ja-JP"
  | "ko-KR"
  | "zh-CN"
  | "ru-RU";

export const DEFAULT_SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  "en-US",
  "es-MX",
  "de-DE",
  "fr-FR",
  "it-IT",
  "pt-BR",
  "zh-TW",
  "hi-IN",
  "ar-SA",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "ru-RU",
] as const;

export const DEFAULT_FALLBACK_LOCALE: SupportedLocale = 'en-US';

export async function getSystemLocaleTag(): Promise<string> {
  try {
    const { Device } = await import('@capacitor/device');
    const tag = await Device.getLanguageTag();
    if (tag?.value) {
      return tag.value;
    }
  } catch {
    // Fall through to less-specific sources.
  }

  try {
    const { Device } = await import('@capacitor/device');
    const code = await Device.getLanguageCode();
    if (code?.value) {
      return code.value;
    }
  } catch {
    // Fall through to navigator.
  }

  try {
    return navigator.languages?.[0] || navigator.language || '';
  } catch {
    return '';
  }
}

export function mapToSupportedLocale(
  locale: string,
  fallback: SupportedLocale = DEFAULT_FALLBACK_LOCALE
): SupportedLocale {
  const raw = normalizeLocaleInput(locale);
  if (!raw) {
    return fallback;
  }

  const directMatch = DEFAULT_SUPPORTED_LOCALES.find(
    (supportedLocale) => supportedLocale.toLowerCase() === raw,
  );
  if (directMatch) {
    return directMatch;
  }

  const [base, region] = raw.split('-', 2);

  if (base === 'es') return 'es-MX';
  if (base === 'en') return 'en-US';
  if (base === 'de') return 'de-DE';
  if (base === 'fr') return 'fr-FR';
  if (base === 'it') return 'it-IT';
  if (base === 'pt') return 'pt-BR';
  if (base === 'pr' && region === 'br') return 'pt-BR';
  if (base === "zh" && region === "cn") return "zh-CN";
  if (base === "zh") return "zh-TW";
  if (base === "hi") return "hi-IN";
  if (base === "ar") return "ar-SA";
  if (base === "ja") return "ja-JP";
  if (base === "ko") return "ko-KR";
  if (base === "ru") return "ru-RU";

  return fallback;
}

export async function detectSupportedLocale(
  fallback: SupportedLocale = DEFAULT_FALLBACK_LOCALE
): Promise<SupportedLocale> {
  const systemLocale = await getSystemLocaleTag();
  return mapToSupportedLocale(systemLocale, fallback);
}

@Injectable({ providedIn: 'root' })
export class LocaleDetectionService {
  async getSystemLocaleTag(): Promise<string> {
    return getSystemLocaleTag();
  }

  mapToSupported(locale: string): SupportedLocale {
    return mapToSupportedLocale(locale);
  }

  async detectSupported(): Promise<SupportedLocale> {
    return detectSupportedLocale();
  }
}

function normalizeLocaleInput(locale: string): string {
  if (!locale) {
    return '';
  }

  return locale
    .trim()
    .replace(/_/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
}
