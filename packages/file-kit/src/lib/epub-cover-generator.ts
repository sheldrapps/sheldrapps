import JSZip from 'jszip';

const EPUB_MIMETYPE = 'application/epub+zip';

export type CoverOnlyEpubOptions = {
  coverFile: File;
  title?: string;
  lang?: string;
  creator?: string;
  identifier?: string;
};

export async function buildCoverOnlyEpubBytes(
  options: CoverOnlyEpubOptions,
): Promise<Uint8Array> {
  const coverBytes = new Uint8Array(await options.coverFile.arrayBuffer());
  const coverMime = options.coverFile.type || mimeFromFilename(options.coverFile.name);
  const coverExt = extensionFromMime(coverMime);
  const identifier = options.identifier?.trim() || buildIdentifier();
  const title = escapeXml(options.title?.trim() || 'Cover');
  const lang = escapeXml(normalizeLang(options.lang));
  const creator = escapeXml(options.creator?.trim() || 'Sheldrapps');
  const coverPath = `OEBPS/Images/cover.${coverExt}`;

  const zip = new JSZip();
  zip.file('mimetype', EPUB_MIMETYPE, { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:language>${lang}</dc:language>
    <dc:identifier id="BookId">${escapeXml(identifier)}</dc:identifier>
    <dc:creator>${creator}</dc:creator>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="cover" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-image" href="Images/cover.${coverExt}" media-type="${escapeXml(coverMime)}"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="cover"/>
  </spine>
  <guide>
    <reference type="cover" title="Cover" href="Text/cover.xhtml"/>
  </guide>
</package>`,
  );
  zip.file(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${title}</text>
  </docTitle>
  <navMap>
    <navPoint id="cover" playOrder="1">
      <navLabel>
        <text>Cover</text>
      </navLabel>
      <content src="Text/cover.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`,
  );
  zip.file(
    'OEBPS/Text/cover.xhtml',
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>${title}</title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <style type="text/css">
      html, body { margin: 0; padding: 0; }
      body { text-align: center; }
      img { display: block; width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <img src="../Images/cover.${coverExt}" alt="${title}"/>
  </body>
</html>`,
  );
  zip.file(coverPath, coverBytes, { binary: true });

  return zip.generateAsync({
    type: 'uint8array',
    mimeType: EPUB_MIMETYPE,
    compression: 'DEFLATE',
    platform: 'UNIX',
  });
}

function buildIdentifier(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `urn:uuid:${crypto.randomUUID()}`;
  }
  return `urn:uuid:web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeLang(raw?: string): string {
  const value = String(raw || 'en')
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return value || 'en';
}

function extensionFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function mimeFromFilename(name: string): string {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
