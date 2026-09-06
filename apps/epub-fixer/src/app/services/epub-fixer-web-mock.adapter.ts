import { Injectable } from '@angular/core';

import {
  classifyEpubDiagnosticRepairMode,
  EpubFixerPortError,
  type EpubDiagnosticIssue,
  type EpubDiagnosticPage,
  type EpubDiagnosticResult,
  type EpubExportResult,
  type EpubFixerPort,
  type EpubRepairResult,
  type PrepareEpubInput,
  type PrepareEpubResult,
} from '@sheldrapps/file-kit';

type WebMockSession = {
  id: string;
  file: File;
  diagnosisId?: string;
  exportUrls: Set<string>;
};

const MOCK_ISSUE_COUNT = 532;
const MOCK_PAGE_SIZE = 50;
const MOCK_ISSUE_CODE = 'MANIFEST_ITEM_MISSING' as const;

@Injectable({ providedIn: 'root' })
export class EpubFixerWebMockAdapter implements EpubFixerPort {
  readonly environment = 'web-dev' as const;

  private readonly sessions = new Map<string, WebMockSession>();

  async prepare(input: PrepareEpubInput): Promise<PrepareEpubResult> {
    if (!input.file) {
      throw new EpubFixerPortError('PREPARE_INPUT_INVALID');
    }

    const sessionId = this.createId('web-mock');
    this.sessions.set(sessionId, {
      id: sessionId,
      file: input.file,
      exportUrls: new Set<string>(),
    });

    return {
      sessionId,
      originalName: input.displayName || input.file.name,
      originalSize: input.file.size,
      isZipReadable: true,
    };
  }

  async diagnose(input: { sessionId: string }): Promise<EpubDiagnosticResult> {
    const session = this.requireSession(input.sessionId);
    const diagnosisId = this.createId('diagnosis');
    session.diagnosisId = diagnosisId;
    return this.buildDiagnosis(session.id, diagnosisId);
  }

  async getDiagnosisIssues(input: {
    sessionId: string;
    diagnosisId: string;
    cursor?: string;
    pageSize?: number;
  }): Promise<EpubDiagnosticPage & { diagnosisId: string }> {
    const pageSize = Math.max(1, Math.min(250, input.pageSize ?? MOCK_PAGE_SIZE));
    const start = this.parseCursor(input.cursor);
    const issues = this.buildMockIssues();
    const items = issues.slice(start, start + pageSize);
    const nextCursor = start + items.length < issues.length
      ? String(start + items.length)
      : undefined;

    return {
      diagnosisId: input.diagnosisId,
      items,
      total: issues.length,
      nextCursor,
    };
  }

  async repair(input: {
    sessionId: string;
    diagnosisId?: string;
    preferredOpfPath?: string;
    guidedSelections?: Record<string, string>;
  }): Promise<EpubRepairResult> {
    const session = this.requireSession(input.sessionId);
    if (input.diagnosisId) {
      this.requireDiagnosis(session, input.diagnosisId);
    }

    return {
      success: true,
      repairedIssues: [MOCK_ISSUE_CODE],
    };
  }

  async exportFixed(input: {
    sessionId: string;
    outputName?: string;
  }): Promise<EpubExportResult> {
    const session = this.requireSession(input.sessionId);
    const outputUri = URL.createObjectURL(session.file);
    session.exportUrls.add(outputUri);

    return {
      outputUri,
      size: session.file.size,
    };
  }

  async cleanup(input: { sessionId: string }): Promise<void> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      return;
    }

    for (const outputUrl of session.exportUrls) {
      URL.revokeObjectURL(outputUrl);
    }
    this.sessions.delete(input.sessionId);
  }

  private buildDiagnosis(
    sessionId: string,
    diagnosisId: string,
  ): EpubDiagnosticResult {
    const allIssues = this.buildMockIssues();
    const firstPage = allIssues.slice(0, MOCK_PAGE_SIZE);

    return {
      sessionId,
      diagnosisId,
      status: 'repairable',
      issues: allIssues,
      summary: {
        totalFindings: allIssues.length,
        fixableFindings: allIssues.length,
        byCode: { [MOCK_ISSUE_CODE]: allIssues.length },
        bySeverity: { warning: allIssues.length },
      },
      page: {
        items: firstPage,
        total: allIssues.length,
        nextCursor: String(firstPage.length),
      },
      mode: 'deep',
      coverage: 'complete',
      metrics: {
        elapsedMs: 0,
        inspectedEntries: 0,
        totalEntries: 0,
        inspectedTextBytes: 0,
        scannedLinks: 0,
        reusedCache: false,
      },
    };
  }

  private buildMockIssues(): EpubDiagnosticIssue[] {
    return Array.from({ length: MOCK_ISSUE_COUNT }, (_, index) => ({
      code: MOCK_ISSUE_CODE,
      severity: 'warning' as const,
      fixable: true,
      messageKey: `FIX.ISSUE_${MOCK_ISSUE_CODE}`,
      repairMode: classifyEpubDiagnosticRepairMode({
        code: MOCK_ISSUE_CODE,
        fixable: true,
      }),
      details: `mock/chapter-${String(index + 1).padStart(3, '0')}.xhtml`,
    }));
  }

  private parseCursor(cursor?: string): number {
    const parsed = Number.parseInt(cursor ?? '0', 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  private requireSession(sessionId: string): WebMockSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new EpubFixerPortError('SESSION_NOT_FOUND', { sessionId });
    }
    return session;
  }

  private requireDiagnosis(session: WebMockSession, diagnosisId: string): void {
    if (session.diagnosisId !== diagnosisId) {
      throw new EpubFixerPortError('DIAGNOSIS_NOT_FOUND', { diagnosisId });
    }
  }

  private createId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
