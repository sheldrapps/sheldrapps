import { inject, Injectable, InjectionToken } from '@angular/core';
import type { Provider } from '@angular/core';

import { NativeEpubFixerAdapter } from './adapters/native-epub-fixer.adapter';

export type EpubFixerEnvironment = 'native' | 'web-dev';

export type PrepareEpubInput = {
  file?: File;
  uri?: string;
  displayName?: string;
  maxBytes?: number;
};

export type PrepareEpubResult = {
  sessionId: string;
  originalName: string;
  originalSize: number;
  isZipReadable: boolean;
  workingPath?: string;
  workingName?: string;
  workingNativePath?: string;
  outputBaseName?: string;
};

export type EpubDiagnosticStatus =
  | 'valid'
  | 'repairable'
  | 'unsupported'
  | 'failed';

export type EpubDiagnosticRepairMode =
  | 'automatic'
  | 'review'
  | 'guided'
  | 'not_repairable';

export type EpubDiagnosticIssueCode =
  | 'MIMETYPE_MISSING'
  | 'MIMETYPE_INVALID'
  | 'CONTAINER_MISSING'
  | 'OPF_MISSING'
  | 'OPF_AMBIGUOUS'
  | 'OPF_VERSION_INVALID'
  | 'OPF_UNIQUE_IDENTIFIER_MISSING'
  | 'OPF_UNIQUE_IDENTIFIER_INVALID'
  | 'CRIT-XHTML-001'
  | 'CRIT-SEC-001'
  | 'HIGH-MAN-001'
  | 'HIGH-XHTML-001'
  | 'HIGH-XHTML-002'
  | 'HIGH-XHTML-003'
  | 'HIGH-ENC-001'
  | 'HIGH-ENC-002'
  | 'HIGH-FALLBACK-001'
  | 'MANIFEST_ITEM_MISSING'
  | 'LINK_TARGET_MISSING'
  | 'LINK_FRAGMENT_MISSING'
  | 'LINK_PATH_CASE_MISMATCH'
  | 'LINK_PATH_UNICODE_MISMATCH'
  | 'ORPHAN_RESOURCE_UNUSED'
  | 'SMIL_MISSING'
  | 'SPINE_EMPTY'
  | 'SPINE_ITEM_INVALID'
  | 'ZIP_UNREADABLE'
  | 'ZIP_CENTRAL_DIRECTORY_TRUNCATED';

export type EpubDiagnosticIssue = {
  code: EpubDiagnosticIssueCode;
  severity: 'info' | 'warning' | 'error';
  fixable: boolean;
  messageKey: string;
  repairMode?: EpubDiagnosticRepairMode;
  details?: string;
  options?: string[];
};

export function buildEpubIssueSelectionKey(
  issue: Pick<EpubDiagnosticIssue, 'code' | 'details' | 'options'>,
): string {
  const options = (issue.options ?? [])
    .map((option) => option.trim())
    .filter((option): option is string => !!option);

  return [
    issue.code,
    issue.details ?? '',
    ...options,
  ].join('::');
}

export function classifyEpubDiagnosticRepairMode(
  issue: Pick<EpubDiagnosticIssue, 'code' | 'fixable' | 'options'>,
): EpubDiagnosticRepairMode {
  if (
    issue.code === 'ZIP_UNREADABLE' ||
    issue.code === 'ZIP_CENTRAL_DIRECTORY_TRUNCATED'
  ) {
    return issue.fixable ? 'automatic' : 'not_repairable';
  }

  if (
    issue.code === 'MIMETYPE_MISSING' ||
    issue.code === 'MIMETYPE_INVALID'
  ) {
    return 'automatic';
  }

  if (issue.code === 'CONTAINER_MISSING' || issue.code === 'OPF_MISSING') {
    return issue.fixable ? 'automatic' : 'not_repairable';
  }

  if (issue.code === 'OPF_AMBIGUOUS') {
    return 'guided';
  }

  if (
    issue.code === 'OPF_VERSION_INVALID' ||
    issue.code === 'OPF_UNIQUE_IDENTIFIER_MISSING' ||
    issue.code === 'OPF_UNIQUE_IDENTIFIER_INVALID'
  ) {
    return issue.fixable ? 'automatic' : 'not_repairable';
  }

  if (issue.code === 'HIGH-MAN-001') {
    return issue.fixable ? 'automatic' : 'not_repairable';
  }

  if (issue.code === 'HIGH-XHTML-001') {
    return issue.fixable ? 'review' : 'not_repairable';
  }

  if (issue.code === 'HIGH-XHTML-002' || issue.code === 'HIGH-XHTML-003') {
    return issue.fixable ? 'automatic' : 'not_repairable';
  }

  if (issue.code === 'HIGH-ENC-001') {
    return issue.fixable ? 'automatic' : 'not_repairable';
  }

  if (issue.code === 'HIGH-ENC-002') {
    return issue.fixable ? 'review' : 'not_repairable';
  }

  if (issue.code === 'HIGH-FALLBACK-001') {
    return issue.fixable ? 'review' : 'not_repairable';
  }

  if (issue.code === 'CRIT-XHTML-001') {
    return issue.fixable ? 'review' : 'not_repairable';
  }

  if (issue.code === 'CRIT-SEC-001') {
    return 'not_repairable';
  }

  if (
    (issue.code === 'LINK_TARGET_MISSING' ||
      issue.code === 'LINK_FRAGMENT_MISSING' ||
      issue.code === 'LINK_PATH_CASE_MISMATCH' ||
      issue.code === 'LINK_PATH_UNICODE_MISMATCH') &&
    (issue.options?.length ?? 0) > 1
  ) {
    return 'guided';
  }

  if (issue.code === 'SMIL_MISSING') {
    return 'automatic';
  }

  if (
    issue.code === 'MANIFEST_ITEM_MISSING' ||
    issue.code === 'SPINE_ITEM_INVALID'
  ) {
    return 'automatic';
  }

  if (
    issue.code === 'LINK_TARGET_MISSING' ||
    issue.code === 'LINK_FRAGMENT_MISSING' ||
    issue.code === 'LINK_PATH_CASE_MISMATCH' ||
    issue.code === 'LINK_PATH_UNICODE_MISMATCH'
  ) {
    return issue.fixable ? 'automatic' : 'not_repairable';
  }

  if (issue.code === 'ORPHAN_RESOURCE_UNUSED') {
    return issue.fixable ? 'review' : 'not_repairable';
  }

  if (issue.code === 'SPINE_EMPTY') {
    return issue.fixable ? 'review' : 'not_repairable';
  }

  return issue.fixable ? 'review' : 'not_repairable';
}

export function normalizeEpubDiagnosticIssue(
  issue: EpubDiagnosticIssue,
): EpubDiagnosticIssue {
  const normalizedMessageKey = issue.messageKey.startsWith('FIX.ISSUE_')
    ? `FIX.ISSUE_${issue.code.replace(/-/g, '_')}`
    : issue.messageKey;

  return {
    ...issue,
    messageKey: normalizedMessageKey,
    repairMode: issue.repairMode ?? classifyEpubDiagnosticRepairMode(issue),
  };
}

export type EpubDiagnosticResult = {
  sessionId: string;
  status: EpubDiagnosticStatus;
  issues: EpubDiagnosticIssue[];
};

export type EpubRepairResult = {
  success: boolean;
  repairedIssues: string[];
};

export type EpubExportResult = {
  outputUri: string;
  size: number;
};

export interface EpubFixerPort {
  readonly environment: EpubFixerEnvironment;

  prepare(input: PrepareEpubInput): Promise<PrepareEpubResult>;

  diagnose(input: {
    sessionId: string;
  }): Promise<EpubDiagnosticResult>;

  repair(input: {
    sessionId: string;
    preferredOpfPath?: string;
    guidedSelections?: Record<string, string>;
  }): Promise<EpubRepairResult>;

  exportFixed(input: {
    sessionId: string;
    outputName?: string;
  }): Promise<EpubExportResult>;

  cleanup(input: {
    sessionId: string;
  }): Promise<void>;
}

export class EpubFixerPortError extends Error {
  constructor(
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'EpubFixerPortError';
  }
}

export const EPUB_FIXER_PORT = new InjectionToken<EpubFixerPort>(
  'EPUB_FIXER_PORT',
);

export function provideEpubFixerPort(): Provider[] {
  return [
    NativeEpubFixerAdapter,
    {
      provide: EPUB_FIXER_PORT,
      useFactory: () => inject(NativeEpubFixerAdapter),
    },
  ];
}
