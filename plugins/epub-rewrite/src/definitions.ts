import type { Plugin, PluginListenerHandle } from '@capacitor/core';

export interface InspectEpubOptions {
  inputPath: string;
}

export interface PrepareEpubOptions {
  uri: string;
  displayName?: string;
  maxBytes?: number;
};

export interface PrepareEpubResult {
  success: boolean;
  sessionId?: string;
  originalName?: string;
  originalSize?: number;
  isZipReadable?: boolean;
  workingPath?: string;
  workingName?: string;
  workingNativePath?: string;
  outputBaseName?: string;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
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

export interface DiagnoseEpubResult {
  success: boolean;
  sessionId?: string;
  status?: 'valid' | 'repairable' | 'unsupported' | 'failed';
  issues?: Array<{
    code:
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
      | 'ORPHAN_RESOURCE_UNUSED'
      | 'SMIL_MISSING'
      | 'SPINE_EMPTY'
      | 'SPINE_ITEM_INVALID'
      | 'ZIP_UNREADABLE';
    severity: 'info' | 'warning' | 'error';
    fixable: boolean;
    messageKey: string;
    repairMode?: 'automatic' | 'review' | 'guided' | 'partial_recovery' | 'not_repairable';
    details?: string;
    options?: string[];
  }>;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
}

export interface RewriteCoverOptions {
  inputPath: string;
  outputPath?: string;
  coverEntryPath?: string;
  newCoverPath: string;
  replacementCoverEntryPath?: string;
}

export interface RewriteCoverResult {
  success: boolean;
  error?: string;
  message?: string;
  stage?: string;
  outputPath?: string;
  coverEntryPath?: string;
  coverInserted?: boolean;
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

export interface RepairEpubResult {
  success: boolean;
  repairedIssues?: string[];
  outputPath?: string;
  error?: string;
  message?: string;
  stage?: string;
  requiredBytes?: number;
  availableBytes?: number;
}

export interface ExportFixedResult {
  success: boolean;
  outputUri?: string;
  size?: number;
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
  requireCover?: boolean;
  includeCoverPreview?: boolean;
}

export interface PickAndPrepareEpubResult {
  success: boolean;
  sessionId?: string;
  originalName?: string;
  originalSize?: number;
  isZipReadable?: boolean;
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
  openExternalFile(options: {
    inputPath: string;
    mimeType?: string;
    chooserTitle?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    stage?: string;
  }>;
  prepare(options: PrepareEpubOptions): Promise<PrepareEpubResult>;
  pickAndPrepareEpub(
    options: PickAndPrepareEpubOptions,
  ): Promise<PickAndPrepareEpubResult>;
  inspectEpub(options: InspectEpubOptions): Promise<InspectEpubResult>;
  diagnoseEpub(options: { sessionId: string }): Promise<DiagnoseEpubResult>;
  repairEpub(options: {
    sessionId: string;
    preferredOpfPath?: string;
  }): Promise<RepairEpubResult>;
  exportFixed(options: {
    sessionId: string;
    outputName?: string;
  }): Promise<ExportFixedResult>;
  rewriteCover(options: RewriteCoverOptions): Promise<RewriteCoverResult>;
  extractCoverAsset(
    options: ExtractCoverAssetOptions,
  ): Promise<ExtractCoverAssetResult>;
  createEpubFromCover(
    options: CreateEpubFromCoverOptions,
  ): Promise<CreateEpubFromCoverResult>;
  cleanup(options: { sessionId: string }): Promise<void>;
  cancelRewrite(): Promise<CancelRewriteResult>;
  addListener(
    eventName: 'rewriteProgress',
    listenerFunc: (event: RewriteProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
}
