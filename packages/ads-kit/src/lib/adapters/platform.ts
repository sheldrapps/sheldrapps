import { Capacitor } from '@capacitor/core';

type SheldrappsNativeRuntime = {
  isDebugBuild?: () => boolean;
};

type SheldrappsGlobal = typeof globalThis & {
  SheldrappsRuntime?: SheldrappsNativeRuntime;
  __SHELDRAPPS_NATIVE_DEBUG__?: boolean;
};

/**
 * Get current Capacitor platform
 */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}

/**
 * Check if running on native platform (Android or iOS)
 */
export function isNative(): boolean {
  const platform = getPlatform();
  return platform === 'android' || platform === 'ios';
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return getPlatform() === 'ios';
}

/**
 * Check if running on web
 */
export function isWeb(): boolean {
  return getPlatform() === 'web';
}

/**
 * Check whether the native container is a debug build.
 */
export function isNativeDebugBuild(): boolean {
  const runtime = globalThis as SheldrappsGlobal;

  if (typeof runtime.__SHELDRAPPS_NATIVE_DEBUG__ === 'boolean') {
    return runtime.__SHELDRAPPS_NATIVE_DEBUG__;
  }

  try {
    return !!runtime.SheldrappsRuntime?.isDebugBuild?.();
  } catch {
    return false;
  }
}
