import { Injectable } from '@angular/core';

import {
  classifyEpubDiagnosticRepairMode,
  type EpubDiagnosticIssue,
  type EpubDiagnosticIssueCode,
  type EpubDiagnosticRepairMode,
} from './epub-fixer.port';
import { EPUB_REPAIR_MATRIX_CASES } from './epub-repair-matrix.generated';

export type EpubRepairMatrixCase = (typeof EPUB_REPAIR_MATRIX_CASES)[number];

export type EpubRepairMatrixSeverity = EpubRepairMatrixCase['severity'];

export type EpubRepairAction =
  | 'fix'
  | 'review_fix'
  | 'resolve'
  | 'cannot_repair';

export type EpubRepairScope = 'opening_blocker' | 'optional_cleanup';

const ACTION_TO_REPAIR_MODE: Record<EpubRepairAction, EpubDiagnosticRepairMode> = {
  fix: 'automatic',
  review_fix: 'review',
  resolve: 'guided',
  cannot_repair: 'not_repairable',
};

const OPENING_BLOCKER_CASE_IDS = new Set<string>([
  'CRIT-ZIP-001',
  'CRIT-ZIP-002',
  'CRIT-OCF-001',
  'CRIT-OCF-002',
  'CRIT-OCF-003',
  'CRIT-OCF-004',
  'CRIT-OCF-005',
  'CRIT-CON-001',
  'CRIT-CON-002',
  'CRIT-CON-003',
  'CRIT-CON-004',
  'CRIT-CON-005',
  'CRIT-OPF-001',
  'CRIT-OPF-002',
  'CRIT-OPF-003',
  'CRIT-OPF-004',
  'CRIT-OPF-005',
  'CRIT-SPINE-001',
  'CRIT-SPINE-002',
  'CRIT-SPINE-003',
  'CRIT-XHTML-001',
  'CRIT-SEC-001',
  'HIGH-OPF-001',
  'HIGH-OPF-002',
  'HIGH-OPF-003',
  'HIGH-MAN-001',
  'HIGH-MAN-002',
  'HIGH-XHTML-001',
  'HIGH-XHTML-002',
  'HIGH-XHTML-003',
  'HIGH-ENC-001',
  'HIGH-ENC-002',
  'HIGH-FALLBACK-001',
]);

const ISSUE_TO_CASE_IDS: Record<EpubDiagnosticIssueCode, string[]> = {
  MIMETYPE_MISSING: ['CRIT-OCF-001'],
  MIMETYPE_INVALID: ['CRIT-OCF-004'],
  CONTAINER_MISSING: ['CRIT-CON-001', 'CRIT-CON-002', 'CRIT-CON-003'],
  OPF_MISSING: ['CRIT-OPF-001', 'CRIT-OPF-002'],
  OPF_AMBIGUOUS: ['CRIT-CON-005'],
  OPF_VERSION_INVALID: ['HIGH-OPF-001'],
  OPF_UNIQUE_IDENTIFIER_MISSING: ['HIGH-OPF-002'],
  OPF_UNIQUE_IDENTIFIER_INVALID: ['HIGH-OPF-003'],
  'CRIT-XHTML-001': ['CRIT-XHTML-001'],
  'CRIT-SEC-001': ['CRIT-SEC-001'],
  'HIGH-MAN-001': ['HIGH-MAN-001'],
  'HIGH-XHTML-001': ['HIGH-XHTML-001'],
  'HIGH-XHTML-002': ['HIGH-XHTML-002'],
  'HIGH-XHTML-003': ['HIGH-XHTML-003'],
  'HIGH-ENC-001': ['HIGH-ENC-001'],
  'HIGH-ENC-002': ['HIGH-ENC-002'],
  'HIGH-FALLBACK-001': ['HIGH-FALLBACK-001'],
  MANIFEST_ITEM_MISSING: ['HIGH-MAN-002'],
  LINK_TARGET_MISSING: ['HIGH-LINK-003'],
  LINK_FRAGMENT_MISSING: ['HIGH-LINK-004'],
  LINK_PATH_CASE_MISMATCH: ['HIGH-LINK-001'],
  LINK_PATH_UNICODE_MISMATCH: ['HIGH-LINK-002'],
  ORPHAN_RESOURCE_UNUSED: ['LOW-MAN-001', 'LOW-MAN-002'],
  SMIL_MISSING: ['MED-SMIL-001'],
  SPINE_EMPTY: ['CRIT-OPF-005'],
  SPINE_ITEM_INVALID: ['CRIT-SPINE-001'],
  ZIP_UNREADABLE: ['CRIT-ZIP-001'],
  ZIP_CENTRAL_DIRECTORY_TRUNCATED: ['CRIT-ZIP-002'],
};

@Injectable({ providedIn: 'root' })
export class EpubRepairingService {
  listCases(): readonly EpubRepairMatrixCase[] {
    return EPUB_REPAIR_MATRIX_CASES;
  }

  getCase(caseId: string): EpubRepairMatrixCase | undefined {
    return EPUB_REPAIR_MATRIX_CASES.find((repairCase) => repairCase.id === caseId);
  }

  getCasesBySeverity(severity: EpubRepairMatrixSeverity): EpubRepairMatrixCase[] {
    return EPUB_REPAIR_MATRIX_CASES.filter((repairCase) => repairCase.severity === severity);
  }

  getCasesByAction(action: EpubRepairAction): EpubRepairMatrixCase[] {
    return EPUB_REPAIR_MATRIX_CASES.filter((repairCase) =>
      repairCase.actions.some((candidate) => candidate === action),
    );
  }

  getRepairMode(
    caseOrAction:
      | EpubRepairMatrixCase
      | EpubRepairAction
      | Pick<EpubDiagnosticIssue, 'code' | 'fixable' | 'options'>,
  ): EpubDiagnosticRepairMode {
    if (typeof caseOrAction === 'string') {
      return ACTION_TO_REPAIR_MODE[caseOrAction];
    }

    if ('recommendedAction' in caseOrAction) {
      return ACTION_TO_REPAIR_MODE[caseOrAction.recommendedAction];
    }

    return classifyEpubDiagnosticRepairMode(caseOrAction);
  }

  resolveDiagnosticCaseIds(
    issue: Pick<EpubDiagnosticIssue, 'code' | 'details'>,
  ): string[] {
    const ids = ISSUE_TO_CASE_IDS[issue.code];
    if (!ids) {
      return [];
    }

    if (issue.code === 'CONTAINER_MISSING') {
      return this.resolveContainerCaseIds(issue.details);
    }

    if (issue.code === 'OPF_MISSING') {
      return this.resolveOpfCaseIds(issue.details);
    }

    return ids;
  }

  resolveDiagnosticCases(
    issue: Pick<EpubDiagnosticIssue, 'code' | 'details'>,
  ): EpubRepairMatrixCase[] {
    return this.resolveDiagnosticCaseIds(issue)
      .map((caseId) => this.getCase(caseId))
      .filter((repairCase): repairCase is EpubRepairMatrixCase => !!repairCase);
  }

  summarize(): {
    totalCases: number;
    bySeverity: Record<EpubRepairMatrixSeverity, number>;
    byAction: Record<EpubRepairAction, number>;
    byScope: Record<EpubRepairScope, number>;
  } {
    const bySeverity: Record<EpubRepairMatrixSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byAction: Record<EpubRepairAction, number> = {
      fix: 0,
      review_fix: 0,
      resolve: 0,
      cannot_repair: 0,
    };
    const byScope: Record<EpubRepairScope, number> = {
      opening_blocker: 0,
      optional_cleanup: 0,
    };

    for (const repairCase of EPUB_REPAIR_MATRIX_CASES) {
      bySeverity[repairCase.severity] += 1;
      for (const action of repairCase.actions) {
        byAction[action] += 1;
      }
      byScope[this.getCaseScope(repairCase)] += 1;
    }

    return {
      totalCases: EPUB_REPAIR_MATRIX_CASES.length,
      bySeverity,
      byAction,
      byScope,
    };
  }

  getCasesByScope(scope: EpubRepairScope): EpubRepairMatrixCase[] {
    return EPUB_REPAIR_MATRIX_CASES.filter(
      (repairCase) => this.getCaseScope(repairCase) === scope,
    );
  }

  getOpeningBlockerCases(): EpubRepairMatrixCase[] {
    return this.getCasesByScope('opening_blocker');
  }

  getOptionalCleanupCases(): EpubRepairMatrixCase[] {
    return this.getCasesByScope('optional_cleanup');
  }

  private getCaseScope(repairCase: EpubRepairMatrixCase): EpubRepairScope {
    return OPENING_BLOCKER_CASE_IDS.has(repairCase.id)
      ? 'opening_blocker'
      : 'optional_cleanup';
  }

  private resolveContainerCaseIds(details?: string): string[] {
    const normalized = (details ?? '').toLowerCase();
    if (normalized.includes('not parseable')) {
      return ['CRIT-CON-002'];
    }
    if (normalized.includes('rootfile')) {
      return ['CRIT-CON-003'];
    }
    if (normalized.includes('missing')) {
      return ['CRIT-CON-001'];
    }
    return ['CRIT-CON-004'];
  }

  private resolveOpfCaseIds(details?: string): string[] {
    const normalized = (details ?? '').toLowerCase();
    if (normalized.includes('not parseable')) {
      return ['CRIT-OPF-002'];
    }
    if (normalized.includes('multiple')) {
      return ['CRIT-CON-005'];
    }
    return ['CRIT-OPF-001'];
  }
}
