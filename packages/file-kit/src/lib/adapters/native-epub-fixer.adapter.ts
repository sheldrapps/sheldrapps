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
      workingPath: prepared.workingPath,
      workingName: prepared.workingName,
      workingNativePath: prepared.workingNativePath,
      outputBaseName: prepared.outputBaseName,
    };
  }

  diagnose(_input: { sessionId: string }): Promise<EpubDiagnosticResult> {
    return this.native.diagnose(_input.sessionId);
  }

  repair(_input: {
    sessionId: string;
    preferredOpfPath?: string;
    guidedSelections?: Record<string, string>;
  }): Promise<EpubRepairResult> {
    return this.native.repair(
      _input.sessionId,
      _input.preferredOpfPath,
      _input.guidedSelections,
    );
  }

  exportFixed(_input: {
    sessionId: string;
    outputName?: string;
  }): Promise<EpubExportResult> {
    return this.native.exportFixed(_input.sessionId, _input.outputName);
  }

  cleanup(input: { sessionId: string }): Promise<void> {
    return this.native.cleanup(input.sessionId);
  }
}
