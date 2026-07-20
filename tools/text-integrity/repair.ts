import { TextDecoder } from "node:util";

import type { RepairSuggestion } from "./types.ts";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

const WINDOWS_1252_MAP = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

export function hasSuspiciousQuestionMark(value: string, baseValue = ""): boolean {
  if (!value.includes("?")) {
    return false;
  }

  if (/\?{2,}/u.test(value)) {
    return true;
  }

  if (/\p{Letter}\?\p{Letter}/u.test(value)) {
    return true;
  }

  if (!baseValue) {
    return false;
  }

  if (baseValue.includes("?")) {
    return false;
  }

  if (/^\?\p{Letter}|\p{Letter}\?$/u.test(value)) {
    return true;
  }

  return false;
}

const STRONG_NEEDLES = [
  "Ãƒ",
  "Ã‚",
  "Ã¢â‚¬",
  "â€™",
  "â€œ",
  "â€",
  "â€“",
  "â€”",
  "â€¦",
  "â€¢",
  "â‚¬",
  "â„¢",
  "ðŸ",
  "ï¿½",
  "Ã°Å¸",
  "Ã¯Â¿Â½",
];

function countNeedles(value: string, needle: string): number {
  let count = 0;
  let start = 0;

  while (start < value.length) {
    const index = value.indexOf(needle, start);
    if (index === -1) {
      break;
    }
    count += 1;
    start = index + needle.length;
  }

  return count;
}

export function scoreCorruption(value: string): number {
  let score = 0;

  for (const needle of STRONG_NEEDLES) {
    score += countNeedles(value, needle) * 24;
  }

  score += countNeedles(value, "\uFFFD") * 60;
  score += countNeedles(value, "Ã") * 8;
  score += countNeedles(value, "Â") * 8;
  score += countNeedles(value, "â") * 10;
  score += countNeedles(value, "ð") * 10;
  score += countNeedles(value, "ï") * 10;

  if (hasSuspiciousQuestionMark(value)) {
    score += 28;
  }

  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint >= 0x80 && codePoint <= 0x9f) {
      score += 36;
    }
  }

  return score;
}

function encodeLatin1Bytes(value: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint > 0xff) {
      return null;
    }
    bytes.push(codePoint);
  }
  return Uint8Array.from(bytes);
}

function encodeWindows1252Bytes(value: string): Uint8Array | null {
  const bytes: number[] = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const mapped = WINDOWS_1252_MAP.get(codePoint);
    if (mapped === undefined) {
      return null;
    }

    bytes.push(mapped);
  }

  return Uint8Array.from(bytes);
}

function decodeReinterpretedUtf8(
  value: string,
  codec: "latin1" | "windows-1252"
): string | null {
  const bytes =
    codec === "latin1" ? encodeLatin1Bytes(value) : encodeWindows1252Bytes(value);

  if (!bytes) {
    return null;
  }

  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    return null;
  }
}

interface Candidate {
  value: string;
  steps: string[];
}

function canAcceptRepair(original: string, candidate: string): boolean {
  if (candidate === original) {
    return false;
  }

  if (candidate.includes("\uFFFD")) {
    return false;
  }

  for (const char of candidate) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint >= 0x80 && codePoint <= 0x9f) {
      return false;
    }
  }

  const originalScore = scoreCorruption(original);
  const candidateScore = scoreCorruption(candidate);
  return originalScore - candidateScore >= 24;
}

export function suggestRepair(
  value: string,
  maxPasses = 3
): RepairSuggestion | undefined {
  const originalScore = scoreCorruption(value);
  if (originalScore === 0) {
    return undefined;
  }

  const queue: Candidate[] = [{ value, steps: [] }];
  const seen = new Set<string>([value]);
  let best: RepairSuggestion | undefined;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.steps.length >= maxPasses) {
      continue;
    }

    for (const codec of ["windows-1252", "latin1"] as const) {
      const decoded = decodeReinterpretedUtf8(current.value, codec);
      if (!decoded || seen.has(decoded)) {
        continue;
      }

      seen.add(decoded);
      const steps = [...current.steps, `${codec} -> utf-8`];
      const candidateScore = scoreCorruption(decoded);
      if (canAcceptRepair(value, decoded)) {
        if (
          !best ||
          candidateScore < best.scoreAfter ||
          (candidateScore === best.scoreAfter && steps.length < best.passes)
        ) {
          best = {
            value: decoded,
            strategy: steps.join(" | "),
            passes: steps.length,
            scoreBefore: originalScore,
            scoreAfter: candidateScore,
          };
        }
      }

      queue.push({ value: decoded, steps });
    }
  }

  return best;
}
