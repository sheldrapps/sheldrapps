import { WebPlugin } from '@capacitor/core';

import type {
  CancelRewriteResult,
  CreateEpubFromCoverOptions,
  CreateEpubFromCoverResult,
  EpubRewritePlugin,
  ExtractCoverAssetOptions,
  ExtractCoverAssetResult,
  InspectEpubOptions,
  InspectEpubResult,
  RewriteCoverOptions,
  RewriteCoverResult,
} from './definitions';

export class EpubRewriteWeb
  extends WebPlugin
  implements EpubRewritePlugin
{
  async inspectEpub(_options: InspectEpubOptions): Promise<InspectEpubResult> {
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

  async cancelRewrite(): Promise<CancelRewriteResult> {
    return { cancelled: false };
  }
}
