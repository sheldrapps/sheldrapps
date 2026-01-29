/**
 * Language code normalization
 * Maps short codes (es, en) to full codes (es-MX, en-US)
 */

/**
 * Canonicalize language code to standard format
 * Preserves correct case for locale codes to match JSON filenames
 * Examples: 'EN-us' -> 'en-US', 'fr-fr' -> 'fr-FR', 'es' -> 'es'
 */
export function canonicalizeLanguage(code: string): string {
  if (!code) return '';

  // Trim and replace underscores with hyphens
  const cleaned = code.trim().replace(/_/g, '-');

  // Split into parts
  const parts = cleaned.split('-');
  if (parts.length === 0) return '';

  // Base language (first part) in lowercase
  const base = parts[0].toLowerCase();

  // Region (second part) in UPPERCASE if present
  if (parts.length >= 2 && parts[1]) {
    const region = parts[1].toUpperCase();
    return `${base}-${region}`;
  }

  // No region, just return base
  return base;
}

/**
 * Normalize language code to a supported variant
 * Handles:
 * - Short codes: es → map[es] → es-MX
 * - Full codes: es-MX → es-MX (pass through if valid)
 * - Case insensitive: ES-mx → es-MX (canonicalized)
 */
export function normalizeLanguage(
  code: string,
  supportedLangs: string[],
  normalizationMap?: Record<string, string>
): string | null {
  if (!code) return null;

  // First canonicalize to get proper case
  const canonical = canonicalizeLanguage(code);
  if (!canonical) return null;

  // Try case-insensitive match in supported langs (returns canonical from list)
  const supported = supportedLangs.find(
    (lang) => lang.toLowerCase() === canonical.toLowerCase()
  );
  if (supported) return supported;

  // Extract base and try mapping
  const base = canonical.split('-')[0].toLowerCase();
  const mapped = normalizationMap?.[base];

  if (mapped && isLanguageSupported(mapped, supportedLangs)) {
    return mapped;
  }

  return null;
}

/**
 * Check if a language code is in the supported list
 */
export function isLanguageSupported(
  code: string,
  supportedLangs: string[]
): boolean {
  if (!code) return false;
  const normalized = code.trim().toLowerCase();
  return supportedLangs.some((lang) => lang.toLowerCase() === normalized);
}

/**
 * Build default normalization map from supported languages
 * Auto-extracts base codes: ['es-MX', 'en-US'] → { es: 'es-MX', en: 'en-US' }
 * Preserves canonical case from supportedLangs
 */
export function buildDefaultNormalizationMap(
  supportedLangs: string[]
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const lang of supportedLangs) {
    const base = lang.split(/[-_]/)[0].toLowerCase();
    // Only add if base is not already mapped (first occurrence wins)
    if (!map[base]) {
      map[base] = lang; // Keep canonical case from supportedLangs
    }
  }

  return map;
}
