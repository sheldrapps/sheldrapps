/**
 * JSZip-based EPUB cover operations for web/non-Android environments.
 * Used as a fallback when the native EpubRewritePlugin is not available.
 *
 * WARNING: This service imports jszip, which is excluded in production builds
 * when enableWebDevAdapters is false. Do not use directly in production code.
 */

import { Injectable, InjectionToken } from '@angular/core';
import JSZip, { type JSZipObject } from 'jszip';

const EPUB_MIME = 'application/epub+zip';

export const WEB_EPUB_COVER_SERVICE_TOKEN = new InjectionToken<WebEpubCoverService>(
  'WEB_EPUB_COVER_SERVICE',
);

@Injectable()
export class WebEpubCoverService {
  /**
   * Returns true if the file is a readable EPUB zip with at least a container.xml.
   * Used to replace the native validateEpubStructure check on web.
   */
  async isReadableEpub(file: File): Promise<boolean> {
    try {
      const zip = await JSZip.loadAsync(file);
      return !!zip.file('META-INF/container.xml');
    } catch {
      return false;
    }
  }

  /**
   * Extracts the cover image from an EPUB file using JSZip.
   * Returns null if no cover can be found or the file is not a valid EPUB.
   */
  async extractCover(file: File): Promise<File | null> {
    try {
      const zip = await JSZip.loadAsync(file);
      const opfPath = await this.readOpfPath(zip);
      const opfText = opfPath ? await this.readZipText(zip, opfPath) : null;
      const opfDoc = opfText ? this.parseXml(opfText) : null;
      const opfDir = opfPath ? this.dirname(opfPath) : '';
      const coverEntry =
        (opfDoc ? this.findCoverEntry(opfDoc, zip, opfDir) : null) ??
        this.findFallbackImageEntry(zip, opfDir);
      if (!coverEntry) return null;

      const bytes = await coverEntry.zip.async('uint8array');
      const safeBytes = new Uint8Array(bytes);
      const ext = this.extFromPath(coverEntry.path);
      const mime = this.mimeFromExt(ext);

      return new File([safeBytes], `cover.${ext}`, { type: mime });
    } catch {
      return null;
    }
  }

  /**
   * Replaces the cover image in a source EPUB using JSZip.
   * Updates the OPF manifest entry if the file extension changes.
   * Returns the new EPUB bytes.
   */
  async replaceCover(
    sourceEpub: File,
    coverFile: File,
    _outputName?: string,
  ): Promise<Uint8Array> {
    const zip = await JSZip.loadAsync(sourceEpub);
    const opfPath = await this.readOpfPath(zip);

    const newMime = coverFile.type || 'image/jpeg';
    const newExt = this.extFromMime(newMime);
    const coverBytes = new Uint8Array(await coverFile.arrayBuffer());

    if (opfPath) {
      const opfText = await this.readZipText(zip, opfPath);
      const opfDoc = opfText ? this.parseXml(opfText) : null;

      if (opfDoc) {
        const opfDir = this.dirname(opfPath);
        const coverEntry = this.findCoverEntry(opfDoc, zip, opfDir);

        if (coverEntry) {
          const oldPath = coverEntry.path;
          const base = oldPath.replace(/\.[^.]+$/, '');
          const newPath = `${base}.${newExt}`;

          if (oldPath !== newPath) {
            zip.remove(oldPath);
            this.updateOPFCoverEntry(opfDoc, oldPath, newPath, newMime, opfDir);
          }
          zip.file(newPath, coverBytes);

          const newOpfXml = new XMLSerializer().serializeToString(opfDoc);
          zip.file(opfPath, newOpfXml);
        } else {
          // No existing cover found — inject a new one
          const newPath = opfDir
            ? `${opfDir}/cover.${newExt}`
            : `cover.${newExt}`;
          zip.file(newPath, coverBytes);
          this.injectCoverIntoOPF(opfDoc, newPath, newMime, opfDir);
          const newOpfXml = new XMLSerializer().serializeToString(opfDoc);
          zip.file(opfPath, newOpfXml);
        }
      }
    }

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    return new Uint8Array(await blob.arrayBuffer());
  }

  /**
   * Creates a minimal valid EPUB that contains only the cover image.
   * Equivalent to the native createEpubFromCover operation.
   */
  async createMinimalEpub(
    coverFile: File,
    title = 'EPUB Cover',
    lang = 'en',
  ): Promise<Uint8Array> {
    const zip = new JSZip();
    const mime = coverFile.type || 'image/jpeg';
    const ext = this.extFromMime(mime);
    const coverPath = `OEBPS/cover.${ext}`;
    const coverBytes = new Uint8Array(await coverFile.arrayBuffer());

    // EPUB spec: mimetype must be first file, stored uncompressed
    zip.file('mimetype', EPUB_MIME, { compression: 'STORE' });

    // Container
    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    );

    // OPF
    const uid = `urn:uuid:${this.generateUuid()}`;
    zip.file(
      'OEBPS/content.opf',
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${uid}</dc:identifier>
    <dc:title>${this.escapeXml(title)}</dc:title>
    <dc:language>${lang}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="cover-image" href="cover.${ext}" media-type="${mime}" properties="cover-image"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="nav"/>
  </spine>
</package>`,
    );

    // Minimal nav page
    zip.file(
      'OEBPS/nav.xhtml',
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${this.escapeXml(title)}</title></head>
<body><img src="cover.${ext}" alt="cover"/></body>
</html>`,
    );

    // Cover image
    zip.file(coverPath, coverBytes);

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      mimeType: EPUB_MIME,
    });
    return new Uint8Array(await blob.arrayBuffer());
  }

  /**
   * Triggers a browser download dialog for the given bytes.
   * On web this is the equivalent of "saving to Documents".
   */
  triggerDownload(bytes: Uint8Array, filename: string): void {
    const safeBytes = new Uint8Array(bytes);
    const blob = new Blob([safeBytes], { type: EPUB_MIME });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async readOpfPath(zip: JSZip): Promise<string | null> {
    const containerText = await this.readZipText(
      zip,
      'META-INF/container.xml',
    );
    if (!containerText) return null;
    const doc = this.parseXml(containerText);
    if (!doc) return null;
    const rootfile = this.firstByTagName(doc, 'rootfile');
    return rootfile?.getAttribute('full-path')?.trim() ?? null;
  }

  /**
   * Finds the ZIP entry for the cover image and its resolved path.
   * Returns null when no cover can be located in the OPF manifest.
   */
  private findCoverEntry(
    opfDoc: XMLDocument,
    zip: JSZip,
    opfDir: string,
  ): { path: string; zip: JSZipObject } | null {
    const manifest = this.firstByTagName(opfDoc, 'manifest');
    if (!manifest) return null;

    const items = Array.from(manifest.children).filter(
      (el) => el.localName === 'item',
    );

    // EPUB3: properties="cover-image"
    const epub3 = items.find((item) =>
      item
        .getAttribute('properties')
        ?.split(/\s+/)
        .includes('cover-image'),
    );
    if (epub3) {
      const href = epub3.getAttribute('href');
      if (href) {
        const resolved = this.resolvePath(opfDir, href);
        const entry = zip.file(resolved);
        if (entry) return { path: resolved, zip: entry };
      }
    }

    // EPUB2: <meta name="cover" content="item-id"/>
    const metadata = this.firstByTagName(opfDoc, 'metadata');
    if (metadata) {
      const coverMeta = Array.from(metadata.children).find(
        (el) =>
          el.localName === 'meta' && el.getAttribute('name') === 'cover',
      );
      const coverId = coverMeta?.getAttribute('content');
      if (coverId) {
        const coverItem = items.find(
          (item) => item.getAttribute('id') === coverId,
        );
        const href = coverItem?.getAttribute('href');
        if (href) {
          const resolved = this.resolvePath(opfDir, href);
          const entry = zip.file(resolved);
          if (entry) return { path: resolved, zip: entry };
        }
      }
    }

    // Fallback: item id is "cover" or "cover-image" AND it is an image
    const byId = items.find((item) => {
      const id = item.getAttribute('id') ?? '';
      const mtype = item.getAttribute('media-type') ?? '';
      return (
        (id === 'cover' || id === 'cover-image') &&
        mtype.startsWith('image/')
      );
    });
    if (byId) {
      const href = byId.getAttribute('href');
      if (href) {
        const resolved = this.resolvePath(opfDir, href);
        const entry = zip.file(resolved);
        if (entry) return { path: resolved, zip: entry };
      }
    }

    return null;
  }

  /**
   * Fallback when EPUB metadata does not point at a cover image.
   * Prefers filenames that look like covers before falling back to the
   * first image entry in the archive.
   */
  private findFallbackImageEntry(
    zip: JSZip,
    opfDir: string,
  ): { path: string; zip: JSZipObject } | null {
    const candidates = Object.entries(zip.files)
      .filter(([path, entry]) => !!entry && !entry.dir && this.isImagePath(path))
      .map(([path, entry]) => ({
        path,
        zip: entry as JSZipObject,
        score: this.scoreFallbackImagePath(path, opfDir),
      }))
      .sort(
        (left, right) =>
          left.score - right.score || left.path.localeCompare(right.path),
      );

    return candidates[0]
      ? { path: candidates[0].path, zip: candidates[0].zip }
      : null;
  }

  /** Patches the OPF manifest href and media-type when the cover path changes. */
  private updateOPFCoverEntry(
    opfDoc: XMLDocument,
    oldPath: string,
    newPath: string,
    newMime: string,
    opfDir: string,
  ): void {
    const manifest = this.firstByTagName(opfDoc, 'manifest');
    if (!manifest) return;
    const items = Array.from(manifest.children).filter(
      (el) => el.localName === 'item',
    );
    const oldRelative = opfDir
      ? oldPath.replace(`${opfDir}/`, '')
      : oldPath;
    const newRelative = opfDir
      ? newPath.replace(`${opfDir}/`, '')
      : newPath;
    const item = items.find((el) => {
      const href = el.getAttribute('href') ?? '';
      return href === oldRelative || href === oldPath;
    });
    if (item) {
      item.setAttribute('href', newRelative);
      item.setAttribute('media-type', newMime);
    }
  }

  /** Adds a cover-image manifest entry when none exists. */
  private injectCoverIntoOPF(
    opfDoc: XMLDocument,
    coverPath: string,
    mime: string,
    opfDir: string,
  ): void {
    const manifest = this.firstByTagName(opfDoc, 'manifest');
    if (!manifest) return;
    const relative = opfDir
      ? coverPath.replace(`${opfDir}/`, '')
      : coverPath;
    const item = opfDoc.createElementNS(
      manifest.namespaceURI ?? null,
      'item',
    );
    item.setAttribute('id', 'cover-image');
    item.setAttribute('href', relative);
    item.setAttribute('media-type', mime);
    item.setAttribute('properties', 'cover-image');
    manifest.appendChild(item);
  }

  private async readZipText(
    zip: JSZip,
    path: string,
  ): Promise<string | null> {
    const entry = zip.file(path);
    if (!entry) return null;
    return entry.async('string').catch(() => null);
  }

  private parseXml(text: string): XMLDocument | null {
    try {
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      if (doc.querySelector('parsererror')) return null;
      return doc as unknown as XMLDocument;
    } catch {
      return null;
    }
  }

  private firstByTagName(doc: Document, name: string): Element | null {
    return (
      doc.getElementsByTagName(name).item(0) ??
      doc.getElementsByTagNameNS('*', name).item(0)
    );
  }

  private dirname(path: string): string {
    const idx = path.lastIndexOf('/');
    return idx >= 0 ? path.slice(0, idx) : '';
  }

  private resolvePath(dir: string, href: string): string {
    if (!dir) return href;
    if (href.startsWith('/') || href.includes('://')) return href;
    return `${dir}/${href}`;
  }

  private extFromPath(path: string): string {
    return path.split('.').pop()?.toLowerCase() ?? 'jpg';
  }

  private isImagePath(path: string): boolean {
    return /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(path);
  }

  private scoreFallbackImagePath(path: string, opfDir: string): number {
    const normalized = path.replace(/\\/g, '/').toLowerCase();
    const filename = normalized.split('/').pop() ?? normalized;
    let score = 20;

    if (filename.includes('cover')) {
      score -= 12;
    } else if (filename.includes('front')) {
      score -= 8;
    } else if (filename.includes('jacket')) {
      score -= 6;
    }

    if (normalized.includes('/images/')) {
      score -= 2;
    }

    if (opfDir && normalized.startsWith(`${opfDir.toLowerCase()}/`)) {
      score -= 2;
    }

    if (normalized.includes('/cover')) {
      score -= 3;
    }

    return score;
  }

  private mimeFromExt(ext: string): string {
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  }

  private extFromMime(mime: string): string {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private generateUuid(): string {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }
    // Fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
