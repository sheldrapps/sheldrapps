/**
 * Android launcher-alias synchronization.
 * Falls back to a no-op on web/iOS or when the native bridge is unavailable.
 */

import { mapToSupportedLocale } from './locale-detection.service';

type LauncherAliasBridge = {
  setActiveLocale(locale: string): void;
};

export async function syncLauncherAlias(locale: string): Promise<void> {
  const bridge = getLauncherAliasBridge();
  if (!bridge) {
    return;
  }

  try {
    bridge.setActiveLocale(mapToSupportedLocale(locale));
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
