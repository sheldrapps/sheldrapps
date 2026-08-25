import { Injectable, inject } from '@angular/core';
import type { PluginListenerHandle } from '@capacitor/core';

import {
  EpubRewriteService,
  type PrepareEpubOptions,
  type PrepareEpubResult,
} from './epub-rewrite.service';
import type {
  EpubDiagnosticResult,
  EpubDiagnosticMode,
  EpubDiagnosticPage,
  EpubExportResult,
  EpubRepairResult,
} from './epub-fixer.port';

export type PickAndPrepareEpubSessionOptions = {
  maxBytes?: number;
};

@Injectable({ providedIn: 'root' })
export class EpubFixerNativeService {
  private readonly epubRewrite = inject(EpubRewriteService);

  isSupported(): boolean {
    return this.epubRewrite.isSupported();
  }

  prepare(options: PrepareEpubOptions): Promise<PrepareEpubResult> {
    return this.epubRewrite.prepare(options);
  }

  diagnose(
    sessionId: string,
    mode: EpubDiagnosticMode = 'deep',
  ): Promise<EpubDiagnosticResult> {
    return this.epubRewrite.diagnose(sessionId, mode);
  }

  getDiagnosisIssues(
    sessionId: string,
    diagnosisId: string,
    cursor?: string,
    pageSize?: number,
  ): Promise<EpubDiagnosticPage & { diagnosisId: string }> {
    return this.epubRewrite.getDiagnosisIssues(
      sessionId,
      diagnosisId,
      cursor,
      pageSize,
    );
  }

  addProgressListener(
    listener: Parameters<EpubRewriteService['addProgressListener']>[0],
  ): Promise<PluginListenerHandle> {
    return this.epubRewrite.addProgressListener(listener);
  }

  repair(
    sessionId: string,
    diagnosisId?: string,
    preferredOpfPath?: string,
    guidedSelections?: Record<string, string>,
  ): Promise<EpubRepairResult> {
    return this.epubRewrite.repair(
      sessionId,
      diagnosisId,
      preferredOpfPath,
      guidedSelections,
    );
  }

  exportFixed(
    sessionId: string,
    outputName?: string,
  ): Promise<EpubExportResult> {
    return this.epubRewrite.exportFixed(sessionId, outputName);
  }

  async pickAndPrepare(
    options: PickAndPrepareEpubSessionOptions = {},
  ): Promise<PrepareEpubResult> {
    const prepared = await this.epubRewrite.pickAndPrepareEpub({
      maxBytes: options.maxBytes,
      requireCover: false,
      includeCoverPreview: false,
    });

    return {
      sessionId: prepared.sessionId,
      originalName: prepared.originalName,
      originalSize: prepared.originalSize,
      isZipReadable: prepared.isZipReadable,
      workingPath: prepared.workingPath,
      workingName: prepared.workingName,
      workingNativePath: prepared.workingNativePath,
      outputBaseName: prepared.outputBaseName,
    };
  }

  async pickAndPrepareMultiple(
    options: PickAndPrepareEpubSessionOptions = {},
  ): Promise<Awaited<ReturnType<EpubRewriteService['pickAndPrepareEpubs']>>> {
    return this.epubRewrite.pickAndPrepareEpubs({
      maxBytes: options.maxBytes,
      requireCover: false,
      includeCoverPreview: false,
    });
  }

  cleanup(sessionId: string): Promise<void> {
    return this.epubRewrite.cleanup(sessionId);
  }
}
