import { WebPlugin } from '@capacitor/core';

import type {
  CancelRewriteResult,
  CreateEpubFromCoverOptions,
  CreateEpubFromCoverResult,
  DiagnoseEpubResult,
  EpubRewritePlugin,
  ExtractCoverAssetOptions,
  ExtractCoverAssetResult,
  InspectEpubOptions,
  InspectEpubResult,
  PrepareEpubOptions,
  PrepareEpubResult,
  RepairEpubResult,
  PickAndPrepareEpubOptions,
  PickAndPrepareEpubResult,
  RewriteCoverOptions,
  RewriteCoverResult,
  ExportFixedResult,
} from './definitions';

export class EpubRewriteWeb
  extends WebPlugin
  implements EpubRewritePlugin
{
  async openExternalFile(_options: {
    inputPath: string;
    mimeType?: string;
    chooserTitle?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    stage?: string;
  }> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async prepare(_options: PrepareEpubOptions): Promise<PrepareEpubResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async pickAndPrepareEpub(
    _options: PickAndPrepareEpubOptions,
  ): Promise<PickAndPrepareEpubResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async inspectEpub(_options: InspectEpubOptions): Promise<InspectEpubResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async diagnoseEpub(_options: { sessionId: string }): Promise<DiagnoseEpubResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async repairEpub(_options: { sessionId: string }): Promise<RepairEpubResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async exportFixed(_options: {
    sessionId: string;
    outputName?: string;
  }): Promise<ExportFixedResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async rewriteCover(
    _options: RewriteCoverOptions,
  ): Promise<RewriteCoverResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async extractCoverAsset(
    _options: ExtractCoverAssetOptions,
  ): Promise<ExtractCoverAssetResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async createEpubFromCover(
    _options: CreateEpubFromCoverOptions,
  ): Promise<CreateEpubFromCoverResult> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async cleanup(_options: { sessionId: string }): Promise<void> {
    throw this.unimplemented('Epub rewrite is only available on Android.');
  }

  async cancelRewrite(): Promise<CancelRewriteResult> {
    return { cancelled: false };
  }
}
