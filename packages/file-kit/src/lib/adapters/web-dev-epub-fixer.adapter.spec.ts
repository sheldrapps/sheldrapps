import JSZip from 'jszip';

import { WebDevEpubFixerAdapter } from './web-dev-epub-fixer.adapter';

describe('WebDevEpubFixerAdapter', () => {
  it('recovers a malformed container by using the declared OPF path', async () => {
    const adapter = new WebDevEpubFixerAdapter();
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file(
      'META-INF/container.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OPS/package.xml" media-type="application/oebps-package+xml"/>
  </rootfilesX>
</container>`,
    );
    zip.file(
      'OPS/package.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="chapter-1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter-1"/>
  </spine>
</package>`,
    );
    zip.file('OPS/text/ch1.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body>Hi</body></html>');

    const file = new File(
      [await zip.generateAsync({ type: 'uint8array' })],
      'artifact-15.epub',
      { type: 'application/epub+zip' },
    );

    const prepared = await adapter.prepare({ file });
    const diagnosis = await adapter.diagnose({ sessionId: prepared.sessionId });

    expect(diagnosis.status).toBe('repairable');
    expect(
      diagnosis.issues.find((issue) => issue.code === 'CONTAINER_MISSING'),
    ).toEqual(
      jasmine.objectContaining({
        code: 'CONTAINER_MISSING',
        fixable: true,
      }),
    );

    const repair = await adapter.repair({ sessionId: prepared.sessionId });
    const rediagnosis = await adapter.diagnose({ sessionId: prepared.sessionId });

    expect(repair.success).toBeTrue();
    expect(repair.repairedIssues).toContain('CONTAINER_MISSING');
    expect(rediagnosis.status).toBe('valid');
  });

  it('canonicalizes identical case-variant links without requiring guided selection', async () => {
    const adapter = new WebDevEpubFixerAdapter();
    const zip = new JSZip();
    const content = '<html><body>sample</body></html>';

    zip.file('Text/Intro.xhtml', content);
    zip.file('TEXT/INTRO.XHTML', content);

    const manifestItems = [
      {
        id: 'id1',
        href: 'Text/Intro.xhtml',
        normalizedHref: 'Text/Intro.xhtml',
        resolvedPath: 'Text/Intro.xhtml',
        exists: true,
        mediaType: 'application/xhtml+xml',
        mediaOverlay: '',
        mediaOverlayResolvedPath: '',
        mediaOverlayExists: false,
        element: document.createElement('item'),
      },
      {
        id: 'id2',
        href: 'TEXT/INTRO.XHTML',
        normalizedHref: 'TEXT/INTRO.XHTML',
        resolvedPath: 'TEXT/INTRO.XHTML',
        exists: true,
        mediaType: 'application/xhtml+xml',
        mediaOverlay: '',
        mediaOverlayResolvedPath: '',
        mediaOverlayExists: false,
        element: document.createElement('item'),
      },
    ];

    const resolution = await (
      adapter as unknown as {
        resolveCanonicalInternalPath: (
          zip: JSZip,
          resolvedPath: string,
          manifestItems: any[],
        ) => Promise<{
          canonicalPath?: string;
          issueCode?: string;
          fixable: boolean;
          options?: string[];
        }>;
      }
    ).resolveCanonicalInternalPath(zip, 'text/intro.xhtml', manifestItems);

    expect(resolution).toEqual({
      canonicalPath: 'text/intro.xhtml',
      issueCode: 'LINK_PATH_CASE_MISMATCH',
      fixable: true,
    });
  });
});
