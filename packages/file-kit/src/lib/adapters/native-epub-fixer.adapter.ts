import { Injectable, inject } from '@angular/core';

import { EpubFixerNativeService } from '../epub-fixer-native.service';
import {
  EpubFixerPort,
  EpubFixerPortError,
  type EpubDiagnosticResult,
  type EpubExportResult,
  type EpubRepairResult,
  type PrepareEpubInput,
  type PrepareEpubResult,
} from '../epub-fixer.port';

@Injectable({ providedIn: 'root' })
export class NativeEpubFixerAdapter implements EpubFixerPort {
  readonly environment = 'native' as const;

  private readonly native = inject(EpubFixerNativeService);

  async prepare(input: PrepareEpubInput): Promise<PrepareEpubResult> {
    if (!input.uri) {
      throw new EpubFixerPortError('PREPARE_INPUT_INVALID');
    }

    const prepared = await this.native.prepare({
      uri: input.uri,
      displayName: input.displayName,
      maxBytes: input.maxBytes,
    });

    return {
      sessionId: prepared.sessionId,
      originalName: prepared.originalName,
      originalSize: prepared.originalSize,
      isZipReadable: prepared.isZipReadable,
    };
  }

  diagnose(_input: { sessionId: string }): Promise<EpubDiagnosticResult> {
    throw new EpubFixerPortError('NATIVE_DIAGNOSE_UNAVAILABLE');
  }

  repair(_input: { sessionId: string }): Promise<EpubRepairResult> {
    throw new EpubFixerPortError('NATIVE_REPAIR_UNAVAILABLE');
  }

  exportFixed(_input: {
    sessionId: string;
    outputName?: string;
  }): Promise<EpubExportResult> {
    throw new EpubFixerPortError('NATIVE_EXPORT_UNAVAILABLE');
  }

  cleanup(input: { sessionId: string }): Promise<void> {
    return this.native.cleanup(input.sessionId);
  }
}
