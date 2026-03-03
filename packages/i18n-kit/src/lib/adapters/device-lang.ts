/**
 * Device language detection adapter
 * Tries Capacitor Device API first, falls back to navigator.language
 */

/**
 * Get language code from device
 * Attempts Capacitor Device.getLanguageCode() first, then navigator.language
 * Returns raw code without case transformation (will be canonicalized by normalizer)
 */
export async function getDeviceLanguage(): Promise<string> {
  try {
    // Try the most specific Capacitor Device API first.
    const { Device } = await import('@capacitor/device');
    const tag = await Device.getLanguageTag();
    const localeTag = tag?.value || '';
    if (localeTag) return localeTag;
  } catch {
    // Capacitor not available or failed
  }

  try {
    // Fall back to the base language code.
    const { Device } = await import('@capacitor/device');
    const info = await Device.getLanguageCode();
    const code = info?.value || '';
    if (code) return code; // No toLowerCase - preserve raw format
  } catch {
    // Capacitor not available or failed
  }

  // Fallback to browser navigator
  try {
    return navigator.languages?.[0] || navigator.language || '';
  } catch {
    return '';
  }
}

/**
 * Extract language base code (es from es-MX, en from en-US, etc.)
 * Returns base in lowercase for comparison purposes
 */
export function extractLanguageBase(code: string): string {
  if (!code) return '';
  const base = code.trim().split(/[-_]/)[0].toLowerCase();
  return base;
}
