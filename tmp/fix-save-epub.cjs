const fs = require('fs');
const path = 'apps/epub-cover-changer/src/app/services/file.service.ts';
let src = fs.readFileSync(path, 'utf8');

// Find the saveGeneratedEpub method start and end
const methodStart = src.indexOf('  async saveGeneratedEpub(opts: {');
if (methodStart === -1) { console.error('method not found'); process.exit(1); }

// Find the ending: the placeholder DELETE_ME and the comment after it
const placeholderStr = '  async saveGeneratedEpub_PLACEHOLDER_DELETE_ME() {}\n  // replaced above\n';
const placeholderIdx = src.indexOf(placeholderStr);
if (placeholderIdx === -1) { console.error('placeholder not found'); process.exit(1); }
const methodEnd = placeholderIdx + placeholderStr.length;

const fixed = `  async saveGeneratedEpub(opts: {
    bytes: Uint8Array;
    filename: string;
    coverFileForThumb: File;
    coverMetadata?: CoverProcessingMetadataInput;
  }) {
    const filename = this.ensureEpubExt(this.sanitizeFilename(opts.filename));
    const finalBytes = await this.applyCoverMetadataToEpubBytes(
      opts.bytes,
      opts.coverMetadata,
    );

    // On web: trigger browser download instead of writing to (invisible) IndexedDB.
    if (!Capacitor.isNativePlatform()) {
      this.webEpubCover.triggerDownload(finalBytes, filename);
      this.debugLog('saveGeneratedEpub:webDownload', {
        filename,
        bytes: finalBytes.byteLength,
      });
      return {
        path: filename,
        uri: '',
        filename,
        thumbPath: null as string | null,
        thumbFilename: null as string | null,
      };
    }

    const uniqueFilename = await this.getUniqueDocumentFilename(filename);
    const epubPath = \`\${this.EPUB_FOLDER}/\${uniqueFilename}\`;

    await this.writePublicEpub(uniqueFilename, finalBytes);
    this.debugLog('saveGeneratedEpub:finalWriteComplete', {
      filename: uniqueFilename,
      writeCompletedAt: new Date().toISOString(),
      bytes: finalBytes.byteLength,
    });
    const uri = await this.getPublicEpubFileUriOrThrow(uniqueFilename);
    this.debugLog('saveGeneratedEpub', {
      filename: uniqueFilename,
      bytes: finalBytes.byteLength,
    });

    const assets = await this.persistCoverAssetsFromFile(
      opts.coverFileForThumb,
      uniqueFilename,
    );
    this.cacheResolvedCoverMetadata(uniqueFilename, opts.coverMetadata);

    return {
      path: epubPath,
      uri,
      filename: uniqueFilename,
      thumbPath: assets.thumbPath,
      thumbFilename: assets.thumbFilename,
    };
  }
`;

const result = src.slice(0, methodStart) + fixed + src.slice(methodEnd);
fs.writeFileSync(path, result, 'utf8');
console.log('OK — saveGeneratedEpub fixed, chars replaced:', methodEnd - methodStart, '->', fixed.length);
