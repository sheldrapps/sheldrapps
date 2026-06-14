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
};

export type EpubDiagnosticStatus =
  | 'valid'
  | 'repairable'
  | 'unsupported'
  | 'failed';

export type EpubDiagnosticIssueCode =
  | 'MIMETYPE_MISSING'
  | 'MIMETYPE_INVALID'
  | 'CONTAINER_MISSING'
  | 'OPF_MISSING'
  | 'MANIFEST_ITEM_MISSING'
  | 'SPINE_EMPTY'
  | 'SPINE_ITEM_INVALID'
  | 'ZIP_UNREADABLE';

export type EpubDiagnosticIssue = {
  code: EpubDiagnosticIssueCode;
  severity: 'info' | 'warning' | 'error';
  fixable: boolean;
  messageKey: string;
  details?: string;
};

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
