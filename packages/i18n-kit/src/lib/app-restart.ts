import { syncLauncherAlias } from './launcher-alias-sync';

type AppControlBridge = {
  restartApp(): void;
};

const DEFAULT_LANGUAGE_RESTART_DELAY_MS = 900;

export async function restartForLanguageChange(
  locale: string,
  delayMs = DEFAULT_LANGUAGE_RESTART_DELAY_MS
): Promise<void> {
  await wait(delayMs);
  await syncLauncherAlias(locale);
  restartApp();
}

export function restartApp(): void {
  const bridge = getAppControlBridge();
  if (bridge) {
    bridge.restartApp();
    return;
  }

  try {
    globalThis.window?.location?.reload();
  } catch {
    // Ignore environments without a browser location.
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function getAppControlBridge(): AppControlBridge | null {
  const scope = globalThis as typeof globalThis & {
    SheldrappsAppControl?: AppControlBridge;
    window?: {
      SheldrappsAppControl?: AppControlBridge;
    };
  };

  return scope.SheldrappsAppControl ?? scope.window?.SheldrappsAppControl ?? null;
}
