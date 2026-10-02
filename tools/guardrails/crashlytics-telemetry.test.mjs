import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workspaceRoot = path.resolve(import.meta.dirname, '../..');

function readWorkspaceFile(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8');
}

test('Billing diagnostics reach Crashlytics through both native rewrite hosts', () => {
  const telemetrySource = readWorkspaceFile('packages/ads-kit/src/lib/ad-telemetry.ts');
  const billingSource = readWorkspaceFile('packages/ads-kit/src/lib/billing.service.ts');
  const nativeSources = [
    readWorkspaceFile(
      'plugins/epub-rewrite/android/src/main/java/com/sheldrapps/plugins/epubrewrite/EpubRewritePlugin.java',
    ),
    readWorkspaceFile(
      'plugins/pdf-rewrite/android/src/main/java/com/sheldrapps/plugins/pdfrewrite/PdfRewritePlugin.java',
    ),
  ];

  assert.match(telemetrySource, /logCrashlyticsEvent/);
  assert.match(telemetrySource, /reportCrashlyticsDiagnostic/);
  assert.match(billingSource, /reportCrashlyticsDiagnostic/);
  assert.match(billingSource, /BILLING_SUPPORT_RESULT/);
  assert.match(billingSource, /BILLING_SUPPORT_FAILED/);

  for (const nativeSource of nativeSources) {
    assert.match(nativeSource, /public void logCrashlyticsEvent\(PluginCall call\)/);
    assert.match(nativeSource, /last_diagnostic_event/);
    assert.match(nativeSource, /last_diagnostic_elapsed_ms/);
  }
});

test('Native purchases diagnostics cover the billing connection wait lifecycle', () => {
  const patchSource = readWorkspaceFile('scripts/patch-capgo-native-purchases.cjs');

  for (const event of [
    'BILLING_SETUP_STARTED',
    'BILLING_SETUP_WAIT_STARTED',
    'BILLING_SETUP_CALLBACK',
    'BILLING_SERVICE_DISCONNECTED',
    'BILLING_SETUP_TIMEOUT',
    'BILLING_SETUP_SUCCEEDED',
  ]) {
    assert.match(patchSource, new RegExp(event));
  }

  assert.match(patchSource, /logBillingDiagnostic/);
  assert.match(patchSource, /FirebaseCrashlytics/);
});
