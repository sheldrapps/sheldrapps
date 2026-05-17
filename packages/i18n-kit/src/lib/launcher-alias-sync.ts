/**
 * Android launcher-alias synchronization.
 * Falls back to a no-op on web/iOS or when the native bridge is unavailable.
 */

import { mapToSupportedLocale } from './locale-detection.service';

type LauncherAliasBridge = {
  setActiveLocale(locale: string): void;
};

export async function syncLauncherAlias(locale: string): Promise<void> {
  const bridge = await waitForLauncherAliasBridge();
  const mappedLocale = mapToSupportedLocale(locale);
  if (!bridge) {
    return;
  }

  try {
    bridge.setActiveLocale(mappedLocale);
  } catch (error) {
    console.warn('[i18n-kit] launcher alias sync failed:', error);
  }
}

function getLauncherAliasBridge(): LauncherAliasBridge | null {
  const scope = globalThis as typeof globalThis & {
    SheldrappsLauncherAlias?: LauncherAliasBridge;
    window?: {
      SheldrappsLauncherAlias?: LauncherAliasBridge;
    };
  };

  return (
    scope.SheldrappsLauncherAlias ??
    scope.window?.SheldrappsLauncherAlias ??
    null
  );
}

async function waitForLauncherAliasBridge(
  timeoutMs = 5000,
  intervalMs = 50
): Promise<LauncherAliasBridge | null> {
  const startedAt = Date.now();
  let bridge = getLauncherAliasBridge();

  while (!bridge && Date.now() - startedAt < timeoutMs) {
    await wait(intervalMs);
    bridge = getLauncherAliasBridge();
  }

  return bridge;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
