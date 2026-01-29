/**
 * MIME type detection and lookup
 */

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  json: 'application/json',
  txt: 'text/plain',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  gif: 'image/gif',
};

/**
 * Guess MIME type from filename or extension
 * @param filenameOrExt Filename or extension (e.g., 'file.pdf' or 'pdf')
 * @returns MIME type or 'application/octet-stream'
 */
export function guessMimeType(filenameOrExt: string): string {
  if (!filenameOrExt) {
    return 'application/octet-stream';
  }

  // Extract extension
  let ext = filenameOrExt.toLowerCase();
  if (ext.includes('.')) {
    ext = ext.split('.').pop() || '';
  }

  return MIME_TYPES[ext] || 'application/octet-stream';
}
