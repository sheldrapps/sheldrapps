export type Confidence = "high" | "medium" | "low";
export type Severity = "error" | "warning";
export type FindingKind =
  | "utf8-invalid"
  | "utf8-bom"
  | "nul-byte"
  | "replacement-character"
  | "c1-control"
  | "mojibake"
  | "untranslated-locale";

export type OutputFormat = "human" | "json";

export interface TextPosition {
  offset: number;
  line: number;
  column: number;
}

export interface RepairSuggestion {
  value: string;
  strategy: string;
  passes: number;
  scoreBefore: number;
  scoreAfter: number;
}

export interface TextIntegrityFinding {
  kind: FindingKind;
  file: string;
  severity: Severity;
  confidence: Confidence;
  reason: string;
  original: string;
  suggested?: string;
  pattern?: string;
  start: TextPosition;
  end: TextPosition;
}

export interface TextIntegrityConfig {
  include: string[];
  excludeContains: string[];
  textExtensions: string[];
  bomMode: "allow" | "warn" | "error";
  allowC1ByPath: string[];
  maxFixPasses: number;
}

export interface ScanOptions {
  config: TextIntegrityConfig;
  suggest: boolean;
  fix: boolean;
  verbose: boolean;
  format: OutputFormat;
}

export interface ScanResult {
  file: string;
  findings: TextIntegrityFinding[];
  bytesValid: boolean;
  fixed: boolean;
  skipped: boolean;
}

export interface ScanSummary {
  filesScanned: number;
  filesFixed: number;
  filesWithErrors: number;
  filesWithWarnings: number;
  findings: number;
}

export interface JsonReport {
  ok: boolean;
  summary: ScanSummary;
  findings: TextIntegrityFinding[];
}
