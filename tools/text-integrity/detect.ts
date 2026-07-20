import { readFileSync } from "node:fs";

import { decodeUtf8Strict } from "./decode.ts";
import { suggestRepair, scoreCorruption, hasSuspiciousQuestionMark } from "./repair.ts";
import type { ScanResult, TextIntegrityFinding, TextIntegrityConfig, TextPosition } from "./types.ts";

export { hasSuspiciousQuestionMark, scoreCorruption, suggestRepair };

const STRONG_PATTERNS = [
  {
    id: "double-question-mark",
    pattern: /\p{Letter}\?{2,}\p{Letter}|\?{2,}\p{Letter}|\p{Letter}\?{2,}/gu,
    reason: "Question-mark replacement sequence detected inside text.",
  },
  {
    id: "question-mark-in-word",
    pattern: /\p{Letter}\?\p{Letter}/gu,
    reason: "Question mark appears where a letter or punctuation encoding was likely lost.",
  },
  {
    id: "replacement-character",
    pattern: /\uFFFD/gu,
    reason: "Replacement character U+FFFD indicates prior decoding damage.",
  },
  {
    id: "c1-control",
    pattern: /[\u0080-\u009F]/gu,
    reason: "Unexpected C1 control character detected in text.",
  },
  {
    id: "mojibake-sequence",
    pattern:
      /(?:Ãƒ|Ã‚|Ã¢â‚¬|â€™|â€œ|â€|â€“|â€”|â€¦|â€¢|â‚¬|â„¢|ðŸ|ï¿½|Ã°Å¸|Ã¯Â¿Â½)/gu,
    reason: "Common mojibake sequence detected.",
  },
];

const HARD_BOUNDARY = /[\u0000-\u001f"'`{}[\](),:;<>|]/u;

function positionAt(text: string, offset: number): TextPosition {
  const prefix = text.slice(0, offset);
  const lines = prefix.split(/\r\n|\n|\r/u);
  return {
    offset,
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function findQuotedSpan(
  line: string,
  start: number,
  end: number
): { start: number; end: number } | null {
  for (const quote of [`"`, `'`, "`"]) {
    const left = line.lastIndexOf(quote, start);
    if (left === -1) {
      continue;
    }
    const right = line.indexOf(quote, end);
    if (right === -1 || right <= left) {
      continue;
    }

    if (right - left <= 200) {
      return { start: left + 1, end: right };
    }
  }

  return null;
}

function findSoftSpan(line: string, start: number, end: number): {
  start: number;
  end: number;
} {
  let left = start;
  let right = end;

  while (left > 0 && !HARD_BOUNDARY.test(line[left - 1])) {
    left -= 1;
  }

  while (right < line.length && !HARD_BOUNDARY.test(line[right])) {
    right += 1;
  }

  while (left < right && /\s/u.test(line[left])) {
    left += 1;
  }

  while (right > left && /\s/u.test(line[right - 1])) {
    right -= 1;
  }

  return { start: left, end: right };
}

function expandFragment(line: string, start: number, end: number): {
  start: number;
  end: number;
} {
  return findQuotedSpan(line, start, end) ?? findSoftSpan(line, start, end);
}

function confidenceForFinding(
  original: string,
  suggested?: string
): TextIntegrityFinding["confidence"] {
  if (!suggested) {
    return scoreCorruption(original) >= 40 ? "medium" : "low";
  }

  const improvement = scoreCorruption(original) - scoreCorruption(suggested);
  const hasHardDamage = /[\u0080-\u009F\uFFFD]/u.test(original);
  if (hasHardDamage && improvement >= 24) {
    return "high";
  }

  if (improvement >= 40) {
    return "high";
  }

  if (improvement >= 24) {
    return "medium";
  }

  return "low";
}

function severityForFinding(
  confidence: TextIntegrityFinding["confidence"]
): TextIntegrityFinding["severity"] {
  return confidence === "high" ? "error" : "warning";
}

function dedupeFindings(findings: TextIntegrityFinding[]): TextIntegrityFinding[] {
  const seen = new Set<string>();
  const output: TextIntegrityFinding[] = [];

  for (const finding of findings) {
    const key = [
      finding.file,
      finding.kind,
      finding.start.offset,
      finding.end.offset,
      finding.original,
    ].join("::");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(finding);
  }

  return output.sort((left, right) => {
    return (
      left.file.localeCompare(right.file) ||
      left.start.line - right.start.line ||
      left.start.column - right.start.column
    );
  });
}

export function hasSemanticMojibake(value: string): boolean {
  return collectSemanticMojibakeFindings("(memory)", value).some(
    (finding) => finding.confidence === "high" || finding.confidence === "medium"
  );
}

export function collectSemanticMojibakeFindings(
  filePath: string,
  text: string
): TextIntegrityFinding[] {
  const findings: TextIntegrityFinding[] = [];
  const linePattern = /.*?(?:\r\n|\n|\r|$)/gu;
  let lineMatch: RegExpExecArray | null;

  while ((lineMatch = linePattern.exec(text)) !== null) {
    const chunk = lineMatch[0];
    if (chunk.length === 0) {
      break;
    }

    const line = chunk.replace(/(?:\r\n|\n|\r)$/u, "");
    const absoluteOffset = lineMatch.index;

    for (const entry of STRONG_PATTERNS) {
      entry.pattern.lastIndex = 0;
      for (const match of line.matchAll(entry.pattern)) {
        const matched = match[0];
        const localStart = match.index ?? 0;
        const localEnd = localStart + matched.length;
        const expanded = expandFragment(line, localStart, localEnd);
        const original = line.slice(expanded.start, expanded.end);
        if (!original) {
          continue;
        }

        const repair = suggestRepair(original);
        const confidence = confidenceForFinding(original, repair?.value);
        const start = positionAt(text, absoluteOffset + expanded.start);
        const end = positionAt(text, absoluteOffset + expanded.end);
        const reason = repair
          ? `Likely mojibake. Suggested reversible repair via ${repair.strategy}.`
          : entry.reason;

        findings.push({
          kind: "mojibake",
          file: filePath,
          severity: severityForFinding(confidence),
          confidence,
          reason,
          original,
          suggested: repair?.value,
          pattern: entry.id,
          start,
          end,
        });
      }
    }
  }

  return dedupeFindings(findings);
}

export function scanTextFile(
  filePath: string,
  config: TextIntegrityConfig
): ScanResult {
  const buffer = readFileSync(filePath);
  const decoded = decodeUtf8Strict(filePath, buffer, config);
  const findings = [...decoded.findings];

  if (decoded.bytesValid && decoded.text !== undefined) {
    findings.push(...collectSemanticMojibakeFindings(filePath, decoded.text));
  }

  return {
    file: filePath,
    findings: dedupeFindings(findings),
    bytesValid: decoded.bytesValid,
    fixed: false,
    skipped: false,
  };
}
