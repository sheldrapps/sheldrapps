import type { Plugin, PluginListenerHandle } from '@capacitor/core';

export interface InspectEpubOptions {
  inputPath: string;
}

export interface InspectEpubResult {
  success: boolean;
  coverEntryPath?: string;
  extractedCoverPath?: string;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
}

export interface RewriteCoverOptions {
  inputPath: string;
  outputPath?: string;
  coverEntryPath: string;
  newCoverPath: string;
}

export interface RewriteCoverResult {
  success: boolean;
  error?: string;
  message?: string;
  stage?: string;
  outputPath?: string;
  requiredBytes?: number;
  availableBytes?: number;
}

export interface ExtractCoverAssetOptions {
  epubPath: string;
  preferCoverEntryPath?: string;
  maxBytes?: number;
}

export interface ExtractCoverAssetResult {
  success: boolean;
  tempImagePath?: string;
  mimeType?: string;
  coverEntryPath?: string;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
}

export interface CreateEpubFromCoverOptions {
  outputPath: string;
  coverPath: string;
  title?: string;
  lang?: string;
  appName?: string;
}

export interface CreateEpubFromCoverResult {
  success: boolean;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
}

export interface RewriteProgressEvent {
  percent: number;
}

export interface PickAndPrepareEpubOptions {
  maxBytes?: number;
}

export interface PickAndPrepareEpubResult {
  success: boolean;
  selectedName?: string;
  sourceSize?: number;
  sourceLastModified?: number;
  sourceMimeType?: string;
  workingPath?: string;
  workingName?: string;
  workingNativePath?: string;
  outputBaseName?: string;
  coverEntryPath?: string;
  extractedCoverPath?: string;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
}

export interface CancelRewriteResult {
  cancelled: boolean;
}

export interface EpubRewritePlugin extends Plugin {
  pickAndPrepareEpub(
    options: PickAndPrepareEpubOptions,
  ): Promise<PickAndPrepareEpubResult>;
  inspectEpub(options: InspectEpubOptions): Promise<InspectEpubResult>;
  rewriteCover(options: RewriteCoverOptions): Promise<RewriteCoverResult>;
  extractCoverAsset(
    options: ExtractCoverAssetOptions,
  ): Promise<ExtractCoverAssetResult>;
  createEpubFromCover(
    options: CreateEpubFromCoverOptions,
  ): Promise<CreateEpubFromCoverResult>;
  cancelRewrite(): Promise<CancelRewriteResult>;
  addListener(
    eventName: 'rewriteProgress',
    listenerFunc: (event: RewriteProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
}
