import { Capacitor } from '@capacitor/core';

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
