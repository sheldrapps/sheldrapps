import { existsSync, globSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

import { DEFAULT_TEXT_INTEGRITY_CONFIG, isExcludedByConfig, isJsonFile, isSupportedTextExtension, isXmlFile } from "./config.ts";
import { scanTextFile } from "./detect.ts";
import {
  collectSuspiciousQuestionMarkFindings,
  collectUntranslatedLocaleFindings,
} from "./locale.ts";
import { formatHumanReport, toJsonReport } from "./report.ts";
import type { OutputFormat, ScanOptions, ScanResult, TextIntegrityFinding } from "./types.ts";

const repoRoot = process.cwd();

interface CliArgs {
  verbose: boolean;
  suggest: boolean;
  fix: boolean;
  staged: boolean;
  changed: boolean;
  format: OutputFormat;
  paths: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    verbose: false,
    suggest: false,
    fix: false,
    staged: false,
    changed: false,
    format: "human",
    paths: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--verbose") {
      args.verbose = true;
      continue;
    }

    if (arg === "--suggest") {
      args.suggest = true;
      continue;
    }

    if (arg === "--fix") {
      args.fix = true;
      continue;
    }

    if (arg === "--staged") {
      args.staged = true;
      continue;
    }

    if (arg === "--changed") {
      args.changed = true;
      continue;
    }

    if (arg === "--format") {
      args.format = (argv[index + 1] as OutputFormat | undefined) ?? "human";
      index += 1;
      continue;
    }

    if (arg.startsWith("--format=")) {
      args.format = arg.slice("--format=".length) as OutputFormat;
      continue;
    }

    if (arg === "--path") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --path");
      }
      args.paths.push(next);
      index += 1;
      continue;
    }

    if (arg.startsWith("--path=")) {
      args.paths.push(arg.slice("--path=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.staged && args.changed) {
    throw new Error("--staged and --changed are mutually exclusive");
  }

  if (args.format !== "human" && args.format !== "json") {
    throw new Error(`Unsupported format: ${args.format}`);
  }

  return args;
}

function normalizePath(filePath: string): string {
  return resolve(filePath).split(sep).join("/");
}

function isInsideSelectedPaths(filePath: string, selectedPaths: string[]): boolean {
  if (selectedPaths.length === 0) {
    return true;
  }

  const normalizedFile = normalizePath(filePath);
  return selectedPaths.some((selected) =>
    normalizedFile.startsWith(normalizePath(resolve(repoRoot, selected)))
  );
}

function listConfiguredFiles(): string[] {
  const files = new Set<string>();
  for (const pattern of DEFAULT_TEXT_INTEGRITY_CONFIG.include) {
    for (const match of globSync(pattern, { cwd: repoRoot })) {
      const absolute = resolve(repoRoot, match);
      if (isExcludedByConfig(absolute, DEFAULT_TEXT_INTEGRITY_CONFIG)) {
        continue;
      }
      if (!isSupportedTextExtension(absolute, DEFAULT_TEXT_INTEGRITY_CONFIG)) {
        continue;
      }
      files.add(absolute);
    }
  }
  return [...files].sort();
}

function listGitFiles(mode: "staged" | "changed"): string[] {
  const args =
    mode === "staged"
      ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]
      : ["status", "--porcelain"];

  const output = execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

  if (!output) {
    return [];
  }

  if (mode === "staged") {
    return output
      .split(/\r?\n/u)
      .map((line: string) => resolve(repoRoot, line.trim()))
      .filter((file: string) => existsSync(file));
  }

  return output
    .split(/\r?\n/u)
    .map((line: string) => line.slice(3).trim())
    .map((file: string) => resolve(repoRoot, file))
    .filter((file: string) => existsSync(file));
}

function resolveFiles(args: CliArgs): string[] {
  const configured = new Set(listConfiguredFiles());
  const selectedPaths = args.paths.map((value) => resolve(repoRoot, value));

  if (args.staged || args.changed) {
    const gitFiles = listGitFiles(args.staged ? "staged" : "changed");
    return gitFiles
      .filter((file) => configured.has(file))
      .filter((file) => isInsideSelectedPaths(file, selectedPaths))
      .sort();
  }

  return [...configured]
    .filter((file) => isInsideSelectedPaths(file, selectedPaths))
    .sort();
}

function canAutoFix(finding: TextIntegrityFinding): boolean {
  return (
    finding.kind === "mojibake" &&
    finding.confidence === "high" &&
    Boolean(finding.suggested)
  );
}

function applyFixes(
  result: ScanResult,
  config = DEFAULT_TEXT_INTEGRITY_CONFIG
): ScanResult {
  const fixable = result.findings.filter(canAutoFix);
  if (fixable.length === 0) {
    return result;
  }

  let content = readFileSync(result.file, "utf8").replace(/^\uFEFF/, "");
  const hasBom = readFileSync(result.file).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  const replacements = [...fixable]
    .sort((left, right) => right.start.offset - left.start.offset)
    .filter((finding, index, all) => {
      return !all.some(
        (other, otherIndex) =>
          otherIndex < index &&
          other.start.offset <= finding.start.offset &&
          other.end.offset >= finding.end.offset
      );
    });

  let changed = false;
  for (const finding of replacements) {
    if (!finding.suggested) {
      continue;
    }

    const before = content.slice(0, finding.start.offset);
    const current = content.slice(finding.start.offset, finding.end.offset);
    const after = content.slice(finding.end.offset);
    if (current !== finding.original) {
      continue;
    }

    content = `${before}${finding.suggested}${after}`;
    changed = true;
  }

  if (!changed) {
    return result;
  }

  if (isJsonFile(result.file)) {
    JSON.parse(content);
  }

  if (isXmlFile(result.file)) {
    const trimmed = content.trimStart();
    if (!trimmed.startsWith("<")) {
      throw new Error(`Repaired XML file no longer looks like XML: ${result.file}`);
    }
  }

  const serialized = hasBom ? `\uFEFF${content}` : content;
  writeFileSync(result.file, serialized, "utf8");

  const rescanned = scanTextFile(result.file, config);
  rescanned.fixed = true;
  return rescanned;
}

function toExitCode(results: ScanResult[]): number {
  return results.some((result) =>
    result.findings.some((finding) => finding.severity === "error")
  )
    ? 1
    : 0;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const files = resolveFiles(args);
  const options: ScanOptions = {
    config: DEFAULT_TEXT_INTEGRITY_CONFIG,
    suggest: args.suggest,
    fix: args.fix,
    verbose: args.verbose,
    format: args.format,
  };

  const results: ScanResult[] = [];
  for (const file of files) {
    let result = scanTextFile(file, options.config);
    if (options.fix) {
      result = applyFixes(result, options.config);
    }
    results.push(result);
  }

  const localeFindings = collectUntranslatedLocaleFindings(files);
  const suspiciousQuestionMarkFindings =
    collectSuspiciousQuestionMarkFindings(files);
  for (const finding of [
    ...localeFindings,
    ...suspiciousQuestionMarkFindings,
  ]) {
    const result = results.find((entry) => entry.file.endsWith(finding.file));
    if (result) {
      result.findings.push(finding);
      continue;
    }

    results.push({
      file: finding.file,
      findings: [finding],
      bytesValid: true,
      fixed: false,
      skipped: false,
    });
  }

  if (options.format === "json") {
    console.log(JSON.stringify(toJsonReport(results), null, 2));
  } else {
    if (options.verbose) {
      console.log(`Scanned ${files.length} file(s).`);
    }
    console.log(formatHumanReport(results));
  }

  process.exitCode = toExitCode(results);
}

main();
