import { Injectable, inject } from '@angular/core';

import {
  EPUB_FIXER_PORT,
  EpubFixerNativeService,
  type EpubDiagnosticResult,
  type EpubExportResult,
  type EpubRepairResult,
} from '@sheldrapps/file-kit';

type PreparedEpubSession = {
  sessionId: string;
  originalName: string;
  originalSize: number;
  isZipReadable: boolean;
};

@Injectable({ providedIn: 'root' })
export class EpubFixerWorkflowService {
  readonly maxNativeSizeMB = 1024;
  readonly recommendedWebSizeMB = 50;

  private readonly port = inject(EPUB_FIXER_PORT);
  private readonly nativePicker = inject(EpubFixerNativeService);
  private currentSessionId?: string;

  isWebDevMode(): boolean {
    return this.port.environment === 'web-dev';
  }

  supportsFullWorkflow(): boolean {
    return true;
  }

  usesNativePicker(): boolean {
    return this.nativePicker.isSupported();
  }

  async pickAndPrepareNative(): Promise<PreparedEpubSession> {
    const prepared = await this.nativePicker.pickAndPrepare({
      maxBytes: this.maxNativeSizeMB * 1024 * 1024,
    });
    this.currentSessionId = prepared.sessionId;

    return {
      sessionId: prepared.sessionId,
      originalName: prepared.originalName,
      originalSize: prepared.originalSize,
      isZipReadable: prepared.isZipReadable,
    };
  }

  prepareFromFile(file: File): Promise<PreparedEpubSession> {
    return this.port.prepare({
      file,
      displayName: file.name,
    }).then((prepared) => {
      this.currentSessionId = prepared.sessionId;
      return prepared;
    });
  }

  prepareFromUri(
    uri: string,
    displayName?: string,
  ): Promise<PreparedEpubSession> {
    return this.port.prepare({
      uri,
      displayName,
    }).then((prepared) => {
      this.currentSessionId = prepared.sessionId;
      return prepared;
    });
  }

  diagnose(sessionId: string): Promise<EpubDiagnosticResult> {
    return this.port.diagnose({ sessionId });
  }

  diagnoseCurrentEpub(): Promise<EpubDiagnosticResult> {
    return this.diagnose(this.requireCurrentSessionId());
  }

  repair(
    sessionId: string,
    preferredOpfPath?: string,
    guidedSelections?: Record<string, string>,
  ): Promise<EpubRepairResult> {
    return this.port.repair({ sessionId, preferredOpfPath, guidedSelections });
  }

  repairCurrentEpub(
    preferredOpfPath?: string,
    guidedSelections?: Record<string, string>,
  ): Promise<EpubRepairResult> {
    return this.repair(
      this.requireCurrentSessionId(),
      preferredOpfPath,
      guidedSelections,
    );
  }

  exportFixed(
    sessionId: string,
    outputName?: string,
  ): Promise<EpubExportResult> {
    return this.port.exportFixed({ sessionId, outputName });
  }

  exportCurrentEpub(outputName?: string): Promise<EpubExportResult> {
    return this.exportFixed(this.requireCurrentSessionId(), outputName);
  }

  cleanup(sessionId: string): Promise<void> {
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
    }
    return this.port.cleanup({ sessionId });
  }

  cleanupCurrentEpub(): Promise<void> {
    const sessionId = this.currentSessionId;
    this.currentSessionId = undefined;
    if (!sessionId) {
      return Promise.resolve();
    }
    return this.port.cleanup({ sessionId });
  }

  shouldWarnForLargeWebFile(size?: number): boolean {
    return (
      this.isWebDevMode() &&
      Number.isFinite(size as number) &&
      (size as number) > this.recommendedWebSizeMB * 1024 * 1024
    );
  }

  buildFixedOutputName(originalName?: string): string {
    const baseName = (originalName || 'book').replace(/\.epub$/i, '');
    return `${baseName}_fixed.epub`;
  }

  private requireCurrentSessionId(): string {
    if (!this.currentSessionId) {
      throw new Error('No prepared EPUB session is available.');
    }
    return this.currentSessionId;
  }
}
