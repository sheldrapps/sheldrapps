import { Capacitor, type Plugin } from '@capacitor/core';
import { registerCapacitorPluginOnce } from './capacitor-plugin';

type FileTelemetryPlugin = Plugin & {
  reportFileFailure(options: {
    errorCode: string;
    stage: string;
    sizeBucket: string;
  }): Promise<void>;
};

export type FileTelemetryFormat = 'epub' | 'pdf';

const epubTelemetry = registerCapacitorPluginOnce<FileTelemetryPlugin>('EpubRewritePlugin');
const pdfTelemetry = registerCapacitorPluginOnce<FileTelemetryPlugin>('PdfRewritePlugin');

export function reportFileWriteFailure(options: {
  format: FileTelemetryFormat;
  stage: string;
  errorCode?: string;
  sizeBytes?: number;
}): void {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const pluginName = options.format === 'epub'
    ? 'EpubRewritePlugin'
    : 'PdfRewritePlugin';
  if (!Capacitor.isPluginAvailable(pluginName)) {
    return;
  }

  const plugin = options.format === 'epub' ? epubTelemetry : pdfTelemetry;
  void plugin.reportFileFailure({
    errorCode: options.errorCode ?? 'WRITE_FAILED',
    stage: options.stage,
    sizeBucket: classifyFileSize(options.sizeBytes),
  }).catch(() => undefined);
}

export function reportFileReadFailure(options: {
  format: FileTelemetryFormat;
  stage: string;
  sizeBytes?: number;
}): void {
  reportFileWriteFailure({
    format: options.format,
    stage: options.stage,
    errorCode: 'READ_FAILED',
    sizeBytes: options.sizeBytes,
  });
}

export function reportFileShareFailure(options: {
  format: FileTelemetryFormat;
  stage: string;
}): void {
  reportFileWriteFailure({
    format: options.format,
    stage: options.stage,
    errorCode: 'SHARE_FAILED',
  });
}

export function classifyFileSize(sizeBytes?: number): string {
  if (!Number.isFinite(sizeBytes) || (sizeBytes ?? 0) < 0) {
    return 'unknown';
  }
  if ((sizeBytes ?? 0) <= 10 * 1024 * 1024) {
    return 'small';
  }
  if ((sizeBytes ?? 0) <= 100 * 1024 * 1024) {
    return 'medium';
  }
  return 'large';
}
