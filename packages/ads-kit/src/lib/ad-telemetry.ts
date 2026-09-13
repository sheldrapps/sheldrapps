import { Capacitor, registerPlugin, type Plugin } from '@capacitor/core';

type AdsTelemetryPlugin = Plugin & {
  reportTelemetryFailure(options: {
    errorCode: string;
    stage: string;
    message: string;
  }): Promise<void>;
};

const epubTelemetry = registerPlugin<AdsTelemetryPlugin>('EpubRewritePlugin');
const pdfTelemetry = registerPlugin<AdsTelemetryPlugin>('PdfRewritePlugin');

export function reportAdsFailure(options: {
  stage: string;
  errorCode: string;
  reason?: string;
  confidence?: string;
}): void {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const pluginName = Capacitor.isPluginAvailable('EpubRewritePlugin')
    ? 'EpubRewritePlugin'
    : Capacitor.isPluginAvailable('PdfRewritePlugin')
      ? 'PdfRewritePlugin'
      : null;
  if (!pluginName) {
    return;
  }

  const plugin = pluginName === 'EpubRewritePlugin'
    ? epubTelemetry
    : pdfTelemetry;
  const message = [options.reason, options.confidence]
    .filter((value): value is string => !!value)
    .join(' ');

  void plugin.reportTelemetryFailure({
    errorCode: options.errorCode,
    stage: options.stage,
    message,
  }).catch(() => undefined);
}
