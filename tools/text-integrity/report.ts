import type { JsonReport, ScanResult, ScanSummary, TextIntegrityFinding } from "./types.ts";

function summarize(results: ScanResult[]): ScanSummary {
  let filesFixed = 0;
  let filesWithErrors = 0;
  let filesWithWarnings = 0;
  let findings = 0;

  for (const result of results) {
    if (result.fixed) {
      filesFixed += 1;
    }

    const hasError = result.findings.some((finding) => finding.severity === "error");
    const hasWarning = result.findings.some((finding) => finding.severity === "warning");
    if (hasError) {
      filesWithErrors += 1;
    }
    if (hasWarning) {
      filesWithWarnings += 1;
    }
    findings += result.findings.length;
  }

  return {
    filesScanned: results.filter((result) => !result.skipped).length,
    filesFixed,
    filesWithErrors,
    filesWithWarnings,
    findings,
  };
}

export function toJsonReport(results: ScanResult[]): JsonReport {
  const findings = results.flatMap((result) => result.findings);
  const summary = summarize(results);

  return {
    ok: !findings.some((finding) => finding.severity === "error"),
    summary,
    findings,
  };
}

function formatFinding(finding: TextIntegrityFinding): string {
  const lines = [
    `${finding.severity.toUpperCase()} ${finding.file}:${finding.start.line}:${finding.start.column}`,
    "",
    "Original:",
    `  ${JSON.stringify(finding.original)}`,
  ];

  if (finding.suggested) {
    lines.push("", "Sugerencia:", `  ${JSON.stringify(finding.suggested)}`);
  }

  lines.push(
    "",
    "Razón:",
    `  ${finding.reason}`,
    "",
    `Confianza: ${finding.confidence}`
  );

  if (finding.pattern) {
    lines.push(`Patrón: ${finding.pattern}`);
  }

  return lines.join("\n");
}

export function formatHumanReport(results: ScanResult[]): string {
  const findings = results.flatMap((result) => result.findings);
  if (findings.length === 0) {
    return "No text-integrity issues found.";
  }

  return findings.map((finding) => formatFinding(finding)).join("\n\n");
}
