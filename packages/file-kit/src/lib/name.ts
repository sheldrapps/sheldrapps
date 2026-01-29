/**
 * Filename sanitization and generation
 */

/**
 * Sanitize a filename to ensure it's safe for filesystem storage
 * @param name Raw filename
 * @param ext Optional extension (will be added/ensured)
 * @returns Safe filename
 */
export function makeSafeFilename(name: string, ext?: string): string {
  if (!name || typeof name !== 'string') {
    name = 'file';
  }

  // Remove path separators
  let safe = name.replace(/[\/\\:*?"<>|]/g, '_');

  // Replace other problematic characters
  safe = safe.replace(/[\x00-\x1f\x7f]/g, '_');

  // Collapse multiple underscores
  safe = safe.replace(/_+/g, '_');

  // Remove leading/trailing underscores
  safe = safe.replace(/^_+|_+$/g, '');

  // Trim to max length (leaving room for extension)
  const maxLen = 120;
  if (safe.length > maxLen) {
    safe = safe.substring(0, maxLen);
  }

  // If empty after sanitization, use default
  if (!safe.trim()) {
    safe = 'file';
  }

  // Add extension
  if (ext) {
    const cleanExt = ext.replace(/^\./, '').replace(/[\/\\:*?"<>|.\s]/g, '');
    if (cleanExt) {
      // Remove any existing extension that might match
      safe = safe.replace(/\.[a-zA-Z0-9]+$/, '');
      safe = `${safe}.${cleanExt}`;
    }
  }

  return safe;
}
