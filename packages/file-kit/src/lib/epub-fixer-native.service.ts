import { Injectable, inject } from '@angular/core';

import {
  EpubRewriteService,
  type PrepareEpubOptions,
  type PrepareEpubResult,
} from './epub-rewrite.service';

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

  cleanup(sessionId: string): Promise<void> {
    return this.epubRewrite.cleanup(sessionId);
  }
}
