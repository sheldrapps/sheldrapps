import { existsSync, globSync, readFileSync } from "node:fs";

import type { TextIntegrityFinding, TextPosition } from "./types.ts";
import { hasSuspiciousQuestionMark } from "./repair.ts";

const BASE_LOCALE = "en-US";
const ALLOWED_IDENTICAL_KEYS = new Set([
  "APP.TITLE",
  "COMMON.ERROR",
  "COMMON.PRO_ONLY",
  "FIX.REVIEW_CONTAINER",
  "FIX.REVIEW_OPF",
  "MY_EPUBS.ERROR",
  "MY_EPUBS.PLACEHOLDER",
]);
const ALLOWED_IDENTICAL_VALUES = new Set([
  "EPUB",
  "PRO",
  "Error",
  "container.xml",
  "content.opf",
]);
const NON_TRANSLATABLE_KEY_PREFIXES = [
  "KINDLE_",
  "KOBO_",
  "NOOK_",
  "POCKETBOOK_",
  "TOLINO_",
];

function flattenTranslations(
  value: unknown,
  prefix = "",
  output = new Map<string, string>(),
): Map<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childKey = prefix ? `${prefix}.${key}` : key;
      flattenTranslations(child, childKey, output);
    }
    return output;
  }

  if (typeof value === "string") {
    output.set(prefix, value);
  }

  return output;
}

function positionAt(text: string, offset: number): TextPosition {
  const lines = text.slice(0, offset).split(/\r\n|\n|\r/u);
  return {
    offset,
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function createFinding(
  file: string,
  text: string,
  key: string,
  value: string,
  baseLocale: string,
): TextIntegrityFinding {
  const keyName = key.split(".").at(-1) ?? key;
  const keyOffset = text.indexOf(`"${keyName}"`);
  const valueOffset = keyOffset >= 0 ? text.indexOf(JSON.stringify(value), keyOffset) : -1;
  const startOffset = valueOffset >= 0 ? valueOffset : Math.max(keyOffset, 0);
  const endOffset = valueOffset >= 0 ? startOffset + value.length + 2 : startOffset;

  return {
    kind: "untranslated-locale",
    file,
    severity: "error",
    confidence: "high",
    reason: `Translation value is identical to ${baseLocale}.`,
    original: value,
    pattern: key,
    start: positionAt(text, startOffset),
    end: positionAt(text, endOffset),
  };
}

function shouldIgnoreIdenticalValue(key: string, value: string): boolean {
  return ALLOWED_IDENTICAL_KEYS.has(key) || ALLOWED_IDENTICAL_VALUES.has(value);
}

function isLikelyTranslatableValue(key: string, value: string): boolean {
  if (key.startsWith("FIX.ISSUE_")) {
    return true;
  }

  if (NON_TRANSLATABLE_KEY_PREFIXES.some((prefix) => key.split(".").at(-2)?.startsWith(prefix))) {
    return false;
  }

  if (/^(?:https?:\/\/|mailto:)/iu.test(value) || /@/u.test(value)) {
    return false;
  }

  if (/^[\d\s./()_+-]+$/u.test(value)) {
    return false;
  }

  return value.trim().length >= 24;
}

function localeFilePath(file: string): { directory: string; locale: string } | null {
  if (!file.toLowerCase().endsWith(".json")) {
    return null;
  }

  return {
    directory: file.replace(/[\\/][^\\/]+$/u, ""),
    locale: file.replace(/^.*[\\/]/u, "").replace(/\.json$/iu, ""),
  };
}

export function collectUntranslatedLocaleFindings(files: string[]): TextIntegrityFinding[] {
  const localeGroups = new Map<string, Map<string, string>>();

  for (const file of files) {
    const metadata = localeFilePath(file);
    if (!metadata) {
      continue;
    }

    const group = localeGroups.get(metadata.directory) ?? new Map<string, string>();
    for (const siblingPath of globSync(`${metadata.directory}/*.json`)) {
      const siblingLocale = siblingPath
        .replace(/^.*[\\/]/u, "")
        .replace(/\.json$/iu, "");
      group.set(siblingLocale, siblingPath);
    }
    localeGroups.set(metadata.directory, group);
  }

  const findings: TextIntegrityFinding[] = [];
  for (const [directory, locales] of localeGroups) {
    const baseFile = locales.get(BASE_LOCALE);
    if (!baseFile || !existsSync(baseFile)) {
      continue;
    }

    const baseText = readFileSync(baseFile, "utf8").replace(/^\uFEFF/u, "");
    const baseTranslations = flattenTranslations(JSON.parse(baseText));
    for (const [locale, file] of locales) {
      if (locale === BASE_LOCALE) {
        continue;
      }

      const text = readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
      const translations = flattenTranslations(JSON.parse(text));
      for (const [key, value] of translations) {
        const baseValue = baseTranslations.get(key);
        if (
          baseValue === undefined ||
          value !== baseValue ||
          shouldIgnoreIdenticalValue(key, value) ||
          !isLikelyTranslatableValue(key, value)
        ) {
          continue;
        }

        findings.push(createFinding(file, text, key, value, BASE_LOCALE));
      }
    }
  }

  return findings;
}

export function collectSuspiciousQuestionMarkFindings(
  files: string[],
): TextIntegrityFinding[] {
  const findings: TextIntegrityFinding[] = [];

  for (const file of files) {
    const metadata = localeFilePath(file);
    if (!metadata) {
      continue;
    }

    const baseFile = `${metadata.directory}/en-US.json`;
    if (metadata.locale === BASE_LOCALE || !existsSync(baseFile)) {
      continue;
    }

    const baseText = readFileSync(baseFile, "utf8").replace(/^\uFEFF/u, "");
    const text = readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
    const baseTranslations = flattenTranslations(JSON.parse(baseText));
    const translations = flattenTranslations(JSON.parse(text));

    for (const [key, value] of translations) {
      const baseValue = baseTranslations.get(key);
      if (
        baseValue === undefined ||
        !hasSuspiciousQuestionMark(value, baseValue)
      ) {
        continue;
      }

      const finding = createFinding(file, text, key, value, BASE_LOCALE);
      findings.push({
        ...finding,
        kind: "suspicious-question-mark",
        reason: `Question-mark replacement detected against ${BASE_LOCALE}.`,
        pattern: key,
      });
    }
  }

  return findings;
}
