import { TranslateService } from '@ngx-translate/core';
import { BEST_CANDIDATE_KIT_TRANSLATIONS } from './best-candidate-kit.translations';

const DEFAULT_LANG = 'en-US';
const SAMPLE_KEY = 'BEST_CANDIDATE.PICKER.TITLE';

type BestCandidateLang = keyof typeof BEST_CANDIDATE_KIT_TRANSLATIONS;

const mergedLangs = new Set<string>();

export function registerBestCandidateKitTranslations(
  translate: TranslateService,
): void {
  const langs = new Set<string>(
    [
      DEFAULT_LANG,
      translate.defaultLang,
      translate.currentLang,
      ...translate.getLangs(),
    ].filter((lang): lang is string => !!lang),
  );

  for (const lang of langs) {
    mergeBestCandidateKitTranslations(translate, lang);
  }
}

export function wireBestCandidateKitTranslations(
  translate: TranslateService,
): void {
  registerBestCandidateKitTranslations(translate);

  translate.onTranslationChange.subscribe((event) => {
    if (event.lang) {
      mergeBestCandidateKitTranslations(translate, event.lang);
    }
  });

  translate.onLangChange.subscribe((event) => {
    mergeBestCandidateKitTranslations(translate, event.lang);
    translate.instant(SAMPLE_KEY);
  });
}

function mergeBestCandidateKitTranslations(
  translate: TranslateService,
  lang: string,
): void {
  if (mergedLangs.has(lang)) {
    return;
  }

  mergedLangs.add(lang);
  translate.setTranslation(
    lang,
    BEST_CANDIDATE_KIT_TRANSLATIONS[DEFAULT_LANG],
    true,
  );

  const dict = resolveDictForLang(lang);
  if (dict) {
    translate.setTranslation(lang, dict, true);
  }

  queueMicrotask(() => {
    mergedLangs.delete(lang);
  });
}

function resolveDictForLang(lang: string) {
  if (isBestCandidateLang(lang)) {
    return BEST_CANDIDATE_KIT_TRANSLATIONS[lang];
  }

  const baseLang = lang.split('-')[0];
  const match = Object.keys(BEST_CANDIDATE_KIT_TRANSLATIONS).find((key) =>
    key.startsWith(`${baseLang}-`),
  );

  return isBestCandidateLang(match)
    ? BEST_CANDIDATE_KIT_TRANSLATIONS[match]
    : null;
}

function isBestCandidateLang(lang: unknown): lang is BestCandidateLang {
  return (
    typeof lang === 'string' &&
    Object.prototype.hasOwnProperty.call(BEST_CANDIDATE_KIT_TRANSLATIONS, lang)
  );
}
