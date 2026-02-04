import { Injectable, inject } from '@angular/core';
import JSZip from 'jszip';
import { FileKitService, FileRef, FileKitError } from '@sheldrapps/file-kit';
import { TranslateService } from '@ngx-translate/core';

export type CoverEntry = {
  filename: string;
  epubPath: string;
  thumbPath: string;
};

@Injectable({ providedIn: 'root' })
export class FileService {
  private translate = inject(TranslateService);

  private readonly EPUB_FOLDER = 'CoverCreator';
  private readonly THUMB_FOLDER = 'CoverCreatorThumbs';
  private fileKit = inject(FileKitService);

  /**
   * Validate an EPUB file
   */
  validateEpub(
    file: File,
    maxSizeMB: number = 50
  ): { valid: boolean; errorKey?: string } {
    return this.fileKit.validateEpub(file, maxSizeMB);
  }

  async saveEpub(opts: {
    modelId: string;
    coverFile: File;
    title?: string;
    filename?: string;
  }) {
    const lang = this.getEpubLang();

    const filename = this.ensureEpubExt(
      this.sanitizeFilename(opts.filename ?? this.buildFilename(opts.modelId))
    );

    const epubPath = `${this.EPUB_FOLDER}/${filename}`;

    const epubBytes = await this.buildEpub({
      appName: 'EPUB Cover Changer',
      coverFile: opts.coverFile,
      title: opts.title ?? 'EPUB Cover',
      lang,
    });

    // Use file-kit instead of direct Filesystem call
    const epubRef = await this.fileKit.writeBytes({
      dir: 'Documents',
      path: epubPath,
      bytes: epubBytes,
      mimeType: 'application/epub+zip',
    });

    const thumb = await this.buildThumbFromFile(opts.coverFile, filename);

    return {
      path: epubPath,
      uri: epubRef.uri,
      filename,
      thumbPath: thumb.thumbPath,
      thumbFilename: thumb.thumbFilename,
    };
  }

  async shareEpub(opts: { modelId: string; coverFile: File; title?: string }) {
    const lang = this.getEpubLang();

    const filename = this.buildFilename(opts.modelId);
    const cachePath = `${this.EPUB_FOLDER}/${filename}`;

    const epubBytes = await this.buildEpub({
      appName: 'EPUB Cover Changer',
      coverFile: opts.coverFile,
      title: opts.title ?? 'EPUB Cover',
      lang,
    });

    // Use file-kit to write to cache
    const epubRef = await this.fileKit.writeBytes({
      dir: 'Cache',
      path: cachePath,
      bytes: epubBytes,
      mimeType: 'application/epub+zip',
    });

    // Use file-kit to share
    await this.fileKit.share(epubRef, {
      title: opts.title ?? 'EPUB Cover',
      text: 'EPUB cover generated with EPUB Cover Changer',
      dialogTitle: 'Share EPUB',
    });

    return { uri: epubRef.uri, filename };
  }

  getEpubFolder() {
    return this.EPUB_FOLDER;
  }

  getThumbFolder() {
    return this.THUMB_FOLDER;
  }

  getThumbPathForEpubFilename(epubFilename: string) {
    const baseName = epubFilename.replace(/\.epub$/i, '');
    return `${this.THUMB_FOLDER}/${baseName}.jpg`;
  }

  async listCovers(): Promise<CoverEntry[]> {
    try {
      // For file-kit, we need to read the directory
      // Since file-kit doesn't expose readdir yet, we'll use the old Filesystem API
      // This is acceptable as long as the core file operations use file-kit
      
      // TODO: Consider adding readdir to file-kit if needed
      // For now, we maintain backward compatibility with Filesystem
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      
      const list = await Filesystem.readdir({
        directory: Directory.Documents,
        path: this.EPUB_FOLDER,
      });

      const files = (list.files ?? [])
        .map((f: any) => (typeof f === 'string' ? f : f.name))
        .filter((name: string) => name.toLowerCase().endsWith('.epub'));

      return files.map((filename) => ({
        filename,
        epubPath: `${this.EPUB_FOLDER}/${filename}`,
        thumbPath: this.getThumbPathForEpubFilename(filename),
      }));
    } catch (error) {
      console.warn('[file.service] listCovers failed:', error);
      return [];
    }
  }

  async deleteCoverByFilename(filename: string) {
    const epubPath = `${this.EPUB_FOLDER}/${filename}`;
    const thumbPath = this.getThumbPathForEpubFilename(filename);

    // Use file-kit to delete EPUB
    try {
      await this.fileKit.delete({
        dir: 'Documents',
        path: epubPath,
      });
    } catch (error) {
      console.warn('[file.service] Failed to delete EPUB:', error);
    }

    // Use file-kit to delete thumbnail
    try {
      await this.fileKit.delete({
        dir: 'Data',
        path: thumbPath,
      });
    } catch {
      // ignore thumb missing
    }
  }

  async shareCoverByFilename(filename: string) {
    const epubPath = `${this.EPUB_FOLDER}/${filename}`;

    // Get URI via file-kit exists check, then share
    const exists = await this.fileKit.exists({
      dir: 'Documents',
      path: epubPath,
    });

    if (!exists) {
      console.error(`[file.service] Share failed: File not found: ${epubPath}`);
      throw new Error(`File not found: ${epubPath}`);
    }

    // Get the real URI from file-kit
    const uri = await this.fileKit.getUri({
      dir: 'Documents',
      path: epubPath,
    });

    console.log(`[file.service] Sharing file: ${filename} from ${uri}`);

    const fileRef: FileRef = {
      uri,
      filename,
      mimeType: 'application/epub+zip',
    };

    await this.fileKit.share(fileRef, {
      title: filename,
      text: 'EPUB cover generated with EPUB Cover Changer',
      dialogTitle: 'Share EPUB',
    });

    return { uri, filename };
  }

  async getOrBuildThumbDataUrlForFilename(
    filename: string
  ): Promise<string | null> {
    const thumbPath = this.getThumbPathForEpubFilename(filename);

    const existingB64 = await this.tryReadBase64FromFilesystem(thumbPath);
    if (existingB64) return `data:image/jpeg;base64,${existingB64}`;

    const rebuiltB64 = await this.tryRebuildThumbFromEpub(filename, thumbPath);
    return rebuiltB64 ? `data:image/jpeg;base64,${rebuiltB64}` : null;
  }

  private async buildThumbFromFile(coverFile: File, epubFilename: string) {
    const baseName = epubFilename.replace(/\.epub$/i, '');
    const thumbFilename = `${baseName}.jpg`;
    const thumbPath = `${this.THUMB_FOLDER}/${thumbFilename}`;

    const thumbBase64 = await this.makeThumbnailBase64(coverFile, 320, 0.82);
    const thumbBytes = this.fileKit.fromBase64(thumbBase64);

    // Use file-kit to write thumbnail
    await this.fileKit.writeBytes({
      dir: 'Data',
      path: thumbPath,
      bytes: thumbBytes,
      mimeType: 'image/jpeg',
    });

    return { thumbPath, thumbFilename };
  }

  private async tryRebuildThumbFromEpub(
    epubFilename: string,
    thumbPath: string
  ): Promise<string | null> {
    try {
      const extracted = await this.extractCoverFromEpub(epubFilename);
      if (!extracted) return null;

      const thumbBase64 = await this.arrayBufferToJpegThumbBase64(
        extracted.ab,
        extracted.name,
        320,
        0.82
      );

      const thumbBytes = this.fileKit.fromBase64(thumbBase64);

      // Use file-kit to write
      await this.fileKit.writeBytes({
        dir: 'Data',
        path: thumbPath,
        bytes: thumbBytes,
        mimeType: 'image/jpeg',
      });

      return thumbBase64;
    } catch {
      return null;
    }
  }
  private async tryReadBase64FromFilesystem(
    path: string,
    dir: 'Data' | 'Documents' | 'Cache' = 'Data'
  ): Promise<string | null> {
    try {
      const bytes = await this.fileKit.readBytes({
        dir,
        path,
      });
      return this.fileKit.toBase64(bytes);
    } catch (error) {
      console.warn(`[file.service] Failed to read ${path} from ${dir}:`, error);
      return null;
    }
  }

  private async coerceToBase64String(data: string | Blob): Promise<string> {
    if (typeof data === 'string') return data;

    const ab = await data.arrayBuffer();
    return this.arrayBufferToBase64(ab);
  }

  private arrayBufferToBase64(ab: ArrayBuffer): string {
    const bytes = new Uint8Array(ab);
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
  }

  private async arrayBufferToJpegThumbBase64(
    ab: ArrayBuffer,
    filename: string,
    maxWidth = 320,
    quality = 0.82
  ): Promise<string> {
    const mime = this.mimeFromFilename(filename);
    const blob = new Blob([ab], { type: mime });
    const objectUrl: string = URL.createObjectURL(blob);

    try {
      const img = await this.urlToImage(objectUrl);

      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');

      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const b64 = dataUrl.split(',')[1] ?? '';
      if (!b64) throw new Error('Thumb encode failed');
      return b64;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private urlToImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = url;
    });
  }

  private mimeFromFilename(name: string): string {
    const ext = (name.split('.').pop() ?? '').toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  }

  private buildFilename(modelId: string) {
    const now = new Date();
    const safeTs =
      `${now.getFullYear()}` +
      `${String(now.getMonth() + 1).padStart(2, '0')}` +
      `${String(now.getDate()).padStart(2, '0')}_` +
      `${String(now.getHours()).padStart(2, '0')}` +
      `${String(now.getMinutes()).padStart(2, '0')}`;
    return `epub_cover_${modelId}_${safeTs}.epub`;
  }

  private ensureEpubExt(name: string) {
    return /\.epub$/i.test(name) ? name : `${name}.epub`;
  }

  private sanitizeFilename(name: string) {
    const trimmed = (name ?? '').trim() || 'epub_cover';
    return trimmed.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').slice(0, 120);
  }

  private async buildEpub(params: {
    appName: string;
    coverFile: File;
    title: string;
    lang: string;
  }) {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    zip.file('META-INF/container.xml', containerXml);

    const coverExt = this.coverExtFromMime(params.coverFile.type);
    const coverMediaType = this.coverMediaTypeFromMime(params.coverFile.type);
    const coverFileName = `cover.${coverExt}`;
    const coverId = 'cover-image';

    const coverXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8"/>
    <title>Cover</title>
    <style>
      html, body { margin:0; padding:0; height:100%; }
      body { display:flex; align-items:center; justify-content:center; }
      img { max-width:100%; max-height:100%; }
    </style>
  </head>
  <body>
    <img src="${coverFileName}" alt="Cover"/>
  </body>
</html>`;

    const thanksXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${this.escapeXml(
      params.lang
    )}">
  <head>
    <meta charset="utf-8"/>
    <title>Thanks</title>
    <style>
      body { font-family: serif; line-height: 1.4; padding: 8%; }
      h1 { margin-top: 0; }
      .small { opacity: 0.85; }
      .lang { display: none; }
      html[lang="en"] .lang-en,
      html[lang="es"] .lang-es,
      html[lang="de"] .lang-de,
      html[lang="fr"] .lang-fr,
      html[lang="it"] .lang-it,
      html[lang="pt"] .lang-pt { display: block; }
    </style>
  </head>
  <body>
    <section class="lang lang-en">
      <h1>Thanks for using ${this.escapeXml(params.appName)}!</h1>
      <p class="small">
        If this helped you, please recommend the app and leave a rating.
        It really supports development.
      </p>
    </section>

    <section class="lang lang-es">
      <h1>¡Gracias por usar ${this.escapeXml(params.appName)}!</h1>
      <p class="small">
        Si te sirvió, recomiéndala y deja una reseña.
        Eso apoya muchísimo el desarrollo.
      </p>
    </section>

    <section class="lang lang-de">
      <h1>Danke, dass du ${this.escapeXml(params.appName)} nutzt!</h1>
      <p class="small">
        Wenn es dir geholfen hat, empfehle die App weiter und hinterlasse una Bewertung.
        Das unterstützt die Entwicklung sehr.
      </p>
    </section>

    <section class="lang lang-fr">
      <h1>Merci d&apos;avoir utilisé ${this.escapeXml(params.appName)} !</h1>
      <p class="small">
        Si ça t&apos;a aidé, recommande l&apos;app et laisse une note.
        Ça soutient vraiment le développement.
      </p>
    </section>

    <section class="lang lang-it">
      <h1>Grazie per aver usato ${this.escapeXml(params.appName)}!</h1>
      <p class="small">
        Se ti è stato utile, consiglia l&apos;app e lascia una recensione.
        Aiuta davvero lo sviluppo.
      </p>
    </section>

    <section class="lang lang-pt">
      <h1>Obrigado por usar ${this.escapeXml(params.appName)}!</h1>
      <p class="small">
        Se isso te ajudou, recomende o app e deixe uma avaliação.
        Isso apoia muito o desenvolvimento.
      </p>
    </section>
  </body>
</html>`;

    const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head>
    <meta charset="utf-8"/>
    <title>Navigation</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <ol>
        <li><a href="cover.xhtml">Cover</a></li>
        <li><a href="thanks.xhtml">Thanks</a></li>
      </ol>
    </nav>
  </body>
</html>`;

    const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${crypto.randomUUID()}</dc:identifier>
    <dc:title>${this.escapeXml(params.title)}</dc:title>
    <dc:language>${this.escapeXml(params.lang)}</dc:language>
    <meta property="dcterms:modified">${new Date()
      .toISOString()
      .replace(/\.\d+Z$/, 'Z')}</meta>
    <meta name="cover" content="${coverId}"/>
  </metadata>

  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="thanks" href="thanks.xhtml" media-type="application/xhtml+xml"/>
    <item id="${coverId}" href="${coverFileName}" media-type="${coverMediaType}" properties="cover-image"/>
  </manifest>

  <spine>
    <itemref idref="cover"/>
    <itemref idref="thanks"/>
  </spine>
</package>`;

    zip.file('OEBPS/content.opf', contentOpf);
    zip.file('OEBPS/nav.xhtml', navXhtml);
    zip.file('OEBPS/cover.xhtml', coverXhtml);
    zip.file('OEBPS/thanks.xhtml', thanksXhtml);

    const coverBytes = new Uint8Array(await params.coverFile.arrayBuffer());
    zip.file(`OEBPS/${coverFileName}`, coverBytes);

    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  private coverExtFromMime(mime: string): 'jpg' | 'png' | 'webp' {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  private coverMediaTypeFromMime(mime: string): string {
    if (mime === 'image/png') return 'image/png';
    if (mime === 'image/webp') return 'image/webp';
    return 'image/jpeg';
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  private base64ToUint8(base64: string): Uint8Array {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  private async makeThumbnailBase64(
    file: File,
    maxWidth = 320,
    quality = 0.82
  ): Promise<string> {
    const img = await this.fileToImage(file);

    const scale = Math.min(1, maxWidth / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');

    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const b64 = dataUrl.split(',')[1] ?? '';
    if (!b64) throw new Error('Thumbnail encode failed');
    return b64;
  }

  private fileToImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid image'));
      };
      img.src = objectUrl;
    });
  }

  private escapeXml(s: string): string {
    return s.replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&apos;';
        default:
          return ch;
      }
    });
  }

  private getEpubLang(): string {
    const raw =
      this.translate.currentLang ||
      this.translate.defaultLang ||
      (typeof navigator !== 'undefined' ? navigator.language : '') ||
      'en';

    return this.normalizeLang(raw);
  }

  private normalizeLang(raw: string): string {
    const base = String(raw).trim().toLowerCase().split(/[-_]/)[0];

    if (base === 'es') return 'es';
    if (base === 'de') return 'de';
    if (base === 'fr') return 'fr';
    if (base === 'it') return 'it';
    if (base === 'pt') return 'pt';
    return 'en';
  }

  async generateEpubBytes(opts: {
    modelId: string;
    coverFile: File;
    title?: string;
    filename?: string;
  }): Promise<{ bytes: Uint8Array; filename: string }> {
    const lang = this.getEpubLang();

    const filename = this.ensureEpubExt(
      this.sanitizeFilename(opts.filename ?? this.buildFilename(opts.modelId))
    );

    const bytes = await this.buildEpub({
      appName: 'EPUB Cover Changer',
      coverFile: opts.coverFile,
      title: opts.title ?? 'EPUB Cover',
      lang,
    });

    return { bytes, filename };
  }

  async saveGeneratedEpub(opts: {
    bytes: Uint8Array;
    filename: string;
    coverFileForThumb: File;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const epubPath = `${this.EPUB_FOLDER}/${filename}`;

    // Use file-kit to save EPUB
    const epubRef = await this.fileKit.writeBytes({
      dir: 'Documents',
      path: epubPath,
      bytes: opts.bytes,
      mimeType: 'application/epub+zip',
    });

    const thumb = await this.buildThumbFromFile(
      opts.coverFileForThumb,
      filename
    );

    return {
      path: epubPath,
      uri: epubRef.uri,
      filename,
      thumbPath: thumb.thumbPath,
      thumbFilename: thumb.thumbFilename,
    };
  }

  async renameGeneratedEpub(opts: { from: string; to: string }) {
    const fromFilename = this.ensureEpubExt(
      this.sanitizeFilename(opts.from)
    );
    const toFilename = this.ensureEpubExt(this.sanitizeFilename(opts.to));

    if (fromFilename === toFilename) {
      return {
        filename: toFilename,
        path: `${this.EPUB_FOLDER}/${toFilename}`,
        thumbPath: this.getThumbPathForEpubFilename(toFilename),
      };
    }

    const fromPath = `${this.EPUB_FOLDER}/${fromFilename}`;
    const toPath = `${this.EPUB_FOLDER}/${toFilename}`;

    const exists = await this.fileKit.exists({
      dir: 'Documents',
      path: fromPath,
    });

    if (!exists) {
      throw new Error(`File not found: ${fromPath}`);
    }

    const epubBytes = await this.fileKit.readBytes({
      dir: 'Documents',
      path: fromPath,
    });

    await this.fileKit.writeBytes({
      dir: 'Documents',
      path: toPath,
      bytes: epubBytes,
      mimeType: 'application/epub+zip',
    });

    try {
      await this.fileKit.delete({
        dir: 'Documents',
        path: fromPath,
      });
    } catch {
    }

    const fromThumbPath = this.getThumbPathForEpubFilename(fromFilename);
    const toThumbPath = this.getThumbPathForEpubFilename(toFilename);
    const thumbExists = await this.fileKit.exists({
      dir: 'Data',
      path: fromThumbPath,
    });

    if (thumbExists) {
      const thumbBytes = await this.fileKit.readBytes({
        dir: 'Data',
        path: fromThumbPath,
      });

      await this.fileKit.writeBytes({
        dir: 'Data',
        path: toThumbPath,
        bytes: thumbBytes,
        mimeType: 'image/jpeg',
      });

      try {
        await this.fileKit.delete({
          dir: 'Data',
          path: fromThumbPath,
        });
      } catch {
      }
    }

    return {
      filename: toFilename,
      path: toPath,
      thumbPath: toThumbPath,
    };
  }

  async deleteGeneratedEpub(filename: string) {
    await this.deleteCoverByFilename(filename);
  }

  async shareGeneratedEpub(opts: {
    bytes: Uint8Array;
    filename: string;
    title?: string;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const cachePath = `${this.EPUB_FOLDER}/${filename}`;

    // Use file-kit to write to cache
    const epubRef = await this.fileKit.writeBytes({
      dir: 'Cache',
      path: cachePath,
      bytes: opts.bytes,
      mimeType: 'application/epub+zip',
    });

    // Use file-kit to share
    await this.fileKit.share(epubRef, {
      title: opts.title ?? 'EPUB Cover',
      text: 'EPUB cover generated with EPUB Cover Changer',
      dialogTitle: 'Share EPUB',
    });

    return { uri: epubRef.uri, filename };
  }

  async getCoverDataUrlForFilename(
    epubFilename: string
  ): Promise<string | null> {
    const extracted = await this.extractCoverFromEpub(epubFilename);
    if (!extracted) return null;

    return this.arrayBufferToDataUrl(extracted.ab, extracted.name);
  }

  private async extractCoverFromEpub(
    epubFilename: string
  ): Promise<{ ab: ArrayBuffer; name: string } | null> {
    try {
      const epubPath = `${this.EPUB_FOLDER}/${epubFilename}`;

      const epubB64 = await this.tryReadBase64FromFilesystem(epubPath, 'Documents');
      if (!epubB64) {
        console.warn(`[file.service] Could not read EPUB file: ${epubPath}`);
        return null;
      }

      const epubBytes = this.base64ToUint8(epubB64);
      const zip = await JSZip.loadAsync(epubBytes);

      const coverFile =
        zip.file('OEBPS/cover.jpg') ??
        zip.file('OEBPS/cover.jpeg') ??
        zip.file('OEBPS/cover.png') ??
        zip.file('OEBPS/cover.webp');

      if (!coverFile) return null;

      const coverAb = await coverFile.async('arraybuffer');
      return { ab: coverAb, name: coverFile.name };
    } catch {
      return null;
    }
  }

  private arrayBufferToDataUrl(ab: ArrayBuffer, filename: string): string {
    const mime = this.mimeFromFilename(filename);
    const b64 = this.arrayBufferToBase64(ab);
    return `data:${mime};base64,${b64}`;
  }
}

