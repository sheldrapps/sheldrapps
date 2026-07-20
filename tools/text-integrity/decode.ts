import { TextDecoder } from "node:util";

import type { TextIntegrityFinding, TextPosition, TextIntegrityConfig } from "./types.ts";
import { allowsC1Controls } from "./config.ts";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

export interface Utf8ValidationResult {
  text?: string;
  findings: TextIntegrityFinding[];
  bytesValid: boolean;
  hasBom: boolean;
}

interface Utf8Error {
  offset: number;
  reason: string;
}

function decodePrefix(buffer: Uint8Array): string {
  if (buffer.byteLength === 0) {
    return "";
  }

  return UTF8_DECODER.decode(buffer);
}

function positionFromDecodedPrefix(buffer: Uint8Array, offset: number): TextPosition {
  const prefix = decodePrefix(buffer.subarray(0, offset));
  const lines = prefix.split(/\r\n|\n|\r/u);
  const line = lines.length;
  const column = (lines.at(-1)?.length ?? 0) + 1;

  return {
    offset,
    line,
    column,
  };
}

function makeSinglePointFinding(
  filePath: string,
  kind: TextIntegrityFinding["kind"],
  severity: TextIntegrityFinding["severity"],
  confidence: TextIntegrityFinding["confidence"],
  reason: string,
  original: string,
  start: TextPosition
): TextIntegrityFinding {
  return {
    kind,
    file: filePath,
    severity,
    confidence,
    reason,
    original,
    start,
    end: start,
  };
}

function validateUtf8Bytes(buffer: Uint8Array): Utf8Error | null {
  let index = 0;

  while (index < buffer.length) {
    const current = buffer[index];

    if (current <= 0x7f) {
      index += 1;
      continue;
    }

    if (current >= 0xc2 && current <= 0xdf) {
      if (index + 1 >= buffer.length) {
        return { offset: index, reason: "Truncated 2-byte UTF-8 sequence" };
      }
      const next = buffer[index + 1];
      if (next < 0x80 || next > 0xbf) {
        return { offset: index, reason: "Invalid continuation byte in 2-byte UTF-8 sequence" };
      }
      index += 2;
      continue;
    }

    if (current === 0xe0) {
      if (index + 2 >= buffer.length) {
        return { offset: index, reason: "Truncated 3-byte UTF-8 sequence" };
      }
      const next = buffer[index + 1];
      const third = buffer[index + 2];
      if (next < 0xa0 || next > 0xbf || third < 0x80 || third > 0xbf) {
        return { offset: index, reason: "Invalid 3-byte UTF-8 sequence" };
      }
      index += 3;
      continue;
    }

    if ((current >= 0xe1 && current <= 0xec) || (current >= 0xee && current <= 0xef)) {
      if (index + 2 >= buffer.length) {
        return { offset: index, reason: "Truncated 3-byte UTF-8 sequence" };
      }
      const next = buffer[index + 1];
      const third = buffer[index + 2];
      if (
        next < 0x80 ||
        next > 0xbf ||
        third < 0x80 ||
        third > 0xbf
      ) {
        return { offset: index, reason: "Invalid continuation byte in 3-byte UTF-8 sequence" };
      }
      index += 3;
      continue;
    }

    if (current === 0xed) {
      if (index + 2 >= buffer.length) {
        return { offset: index, reason: "Truncated surrogate UTF-8 sequence" };
      }
      const next = buffer[index + 1];
      const third = buffer[index + 2];
      if (next < 0x80 || next > 0x9f || third < 0x80 || third > 0xbf) {
        return { offset: index, reason: "UTF-8 sequence encodes an invalid UTF-16 surrogate" };
      }
      index += 3;
      continue;
    }

    if (current === 0xf0) {
      if (index + 3 >= buffer.length) {
        return { offset: index, reason: "Truncated 4-byte UTF-8 sequence" };
      }
      const next = buffer[index + 1];
      const third = buffer[index + 2];
      const fourth = buffer[index + 3];
      if (
        next < 0x90 ||
        next > 0xbf ||
        third < 0x80 ||
        third > 0xbf ||
        fourth < 0x80 ||
        fourth > 0xbf
      ) {
        return { offset: index, reason: "Invalid 4-byte UTF-8 sequence" };
      }
      index += 4;
      continue;
    }

    if (current >= 0xf1 && current <= 0xf3) {
      if (index + 3 >= buffer.length) {
        return { offset: index, reason: "Truncated 4-byte UTF-8 sequence" };
      }
      const next = buffer[index + 1];
      const third = buffer[index + 2];
      const fourth = buffer[index + 3];
      if (
        next < 0x80 ||
        next > 0xbf ||
        third < 0x80 ||
        third > 0xbf ||
        fourth < 0x80 ||
        fourth > 0xbf
      ) {
        return { offset: index, reason: "Invalid continuation byte in 4-byte UTF-8 sequence" };
      }
      index += 4;
      continue;
    }

    if (current === 0xf4) {
      if (index + 3 >= buffer.length) {
        return { offset: index, reason: "Truncated 4-byte UTF-8 sequence" };
      }
      const next = buffer[index + 1];
      const third = buffer[index + 2];
      const fourth = buffer[index + 3];
      if (
        next < 0x80 ||
        next > 0x8f ||
        third < 0x80 ||
        third > 0xbf ||
        fourth < 0x80 ||
        fourth > 0xbf
      ) {
        return { offset: index, reason: "UTF-8 sequence exceeds Unicode range" };
      }
      index += 4;
      continue;
    }

    return { offset: index, reason: "Invalid UTF-8 leading byte" };
  }

  return null;
}

function findDecodedIssues(
  filePath: string,
  text: string,
  buffer: Uint8Array,
  config: TextIntegrityConfig
): TextIntegrityFinding[] {
  const findings: TextIntegrityFinding[] = [];
  let line = 1;
  let column = 1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const codePoint = char.codePointAt(0) ?? 0;
    const start: TextPosition = { offset: index, line, column };

    if (char === "\n") {
      line += 1;
      column = 1;
      continue;
    }

    if (char === "\r") {
      if (text[index + 1] === "\n") {
        line += 1;
        column = 1;
        continue;
      }

      line += 1;
      column = 1;
      continue;
    }

    if (char === "\uFFFD") {
      findings.push(
        makeSinglePointFinding(
          filePath,
          "replacement-character",
          "error",
          "high",
          "Found replacement character U+FFFD. Text was already corrupted before this final file was written.",
          char,
          start
        )
      );
    } else if (codePoint >= 0x80 && codePoint <= 0x9f && !allowsC1Controls(filePath, config)) {
      findings.push(
        makeSinglePointFinding(
          filePath,
          "c1-control",
          "error",
          "high",
          "Found unexpected C1 control character in text content.",
          char,
          start
        )
      );
    }

    column += 1;
  }

  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0x00) {
      continue;
    }

    const start = positionFromDecodedPrefix(buffer, index);
    findings.push(
      makeSinglePointFinding(
        filePath,
        "nul-byte",
        "error",
        "high",
        "Found NUL byte inside a text file.",
        "\\0",
        start
      )
    );
  }

  return findings;
}

export function decodeUtf8Strict(
  filePath: string,
  buffer: Uint8Array,
  config: TextIntegrityConfig
): Utf8ValidationResult {
  const findings: TextIntegrityFinding[] = [];
  const hasBom =
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf;

  if (hasBom && config.bomMode !== "allow") {
    const start = { offset: 0, line: 1, column: 1 };
    findings.push(
      makeSinglePointFinding(
        filePath,
        "utf8-bom",
        config.bomMode === "error" ? "error" : "warning",
        config.bomMode === "error" ? "high" : "medium",
        "Unexpected UTF-8 BOM in a maintained text file.",
        "EF BB BF",
        start
      )
    );
  }

  const utf8Error = validateUtf8Bytes(buffer);
  if (utf8Error) {
    const start = positionFromDecodedPrefix(buffer, utf8Error.offset);
    findings.push(
      makeSinglePointFinding(
        filePath,
        "utf8-invalid",
        "error",
        "high",
        utf8Error.reason,
        Array.from(buffer.subarray(utf8Error.offset, utf8Error.offset + 4))
          .map((value) => value.toString(16).padStart(2, "0"))
          .join(" "),
        start
      )
    );
    return {
      findings,
      bytesValid: false,
      hasBom,
    };
  }

  const text = UTF8_DECODER.decode(buffer);
  findings.push(...findDecodedIssues(filePath, text, buffer, config));

  return {
    text,
    findings,
    bytesValid: true,
    hasBom,
  };
}
