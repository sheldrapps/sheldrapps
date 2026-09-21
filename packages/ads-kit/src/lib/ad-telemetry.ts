import { Capacitor, registerPlugin, type Plugin } from '@capacitor/core';

type AdsTelemetryPlugin = Plugin & {
  reportTelemetryFailure(options: {
    errorCode: string;
    stage: string;
    message: string;
  }): Promise<void>;
};

export type AdsFailureTelemetry = {
  stage: string;
  errorCode: string;
  reason?: string;
  confidence?: string;
  nativeCode?: string | number;
  nativeMessage?: string;
  requestId?: string;
  adUnit?: string;
  elapsedMs?: number;
};

const MAX_FIELD_LENGTH = 180;
const MAX_MESSAGE_LENGTH = 1000;

function compactValue(value: unknown): string {
  return String(value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[=|]/g, ':')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FIELD_LENGTH);
}

function buildFailureMessage(options: AdsFailureTelemetry): string {
  const fields: Array<[string, unknown]> = [
    ['reason', options.reason],
    ['confidence', options.confidence],
    ['native_code', options.nativeCode],
    ['native_message', options.nativeMessage],
    ['request_id', options.requestId],
    ['ad_unit', options.adUnit],
    ['elapsed_ms', options.elapsedMs],
  ];

  const message = fields
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${compactValue(value)}`)
    .join(' ');

  return message.slice(0, MAX_MESSAGE_LENGTH) || 'reason=unknown';
}

const getRegisteredPlugin = <T extends Plugin>(pluginName: string): T => {
  const registry = Capacitor as unknown as {
    Plugins?: Record<string, Plugin | undefined>;
  };
  const existingPlugin = registry.Plugins?.[pluginName];
  return existingPlugin
    ? (existingPlugin as T)
    : registerPlugin<T>(pluginName);
};

const epubTelemetry = getRegisteredPlugin<AdsTelemetryPlugin>('EpubRewritePlugin');
const pdfTelemetry = getRegisteredPlugin<AdsTelemetryPlugin>('PdfRewritePlugin');

export function reportAdsFailure(options: AdsFailureTelemetry): void {
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
  void plugin.reportTelemetryFailure({
    errorCode: options.errorCode,
    stage: options.stage,
    message: buildFailureMessage(options),
  }).catch((error) => {
    // Do not hide a broken telemetry bridge: the ad failure has already been
    // handled by the caller, but this diagnostic is needed to detect gaps in
    // Crashlytics coverage itself.
    console.error('[Ads] failure telemetry bridge rejected', {
      stage: options.stage,
      errorCode: options.errorCode,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}
