import JSZip from 'jszip';

import { SplitAnalysisService, type SplitAnalysisUnit } from './split-analysis.service';

describe('SplitAnalysisService TOC parsing', () => {
  const service = Object.create(SplitAnalysisService.prototype) as SplitAnalysisService;
  const queryDelimiter = String.fromCharCode(63);

  it('reads namespaced manifest and spine elements', () => {
    const document = new DOMParser().parseFromString(
      '<package xmlns="http://www.idpf.org/2007/opf"><manifest>'
        + '<item id="chapter" href="text/chapter.xhtml" media-type="application/xhtml+xml"/>'
        + '</manifest><spine><itemref idref="chapter"/></spine></package>',
      'application/xml',
    );
    const zip = new JSZip().file('OPS/text/chapter.xhtml', '<html/>');
    const manifest = (service as unknown as {
      readManifest: (document: Document, directory: string, zip: JSZip) => Map<string, unknown>;
    }).readManifest(document, 'OPS/', zip);
    const spine = (service as unknown as {
      readSpine: (document: Document, manifest: Map<string, unknown>) => unknown[];
    }).readSpine(document, manifest);

    expect(manifest.get('chapter')).toEqual(jasmine.objectContaining({ href: 'OPS/text/chapter.xhtml' }));
    expect(spine).toEqual([
      jasmine.objectContaining({ id: 'chapter', sourcePath: 'OPS/text/chapter.xhtml' }),
    ]);
  });

  it('accepts tokenized toc types and wrapped navigation lists', () => {
    const document = new DOMParser().parseFromString(
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">'
        + '<body><nav epub:type="frontmatter toc"><div><ol>'
        + `<li><div><a href="text/chapter.xhtml${queryDelimiter}reader=1#start">Chapter</a></div></li>`
        + '</ol></div></nav></body></html>',
      'application/xhtml+xml',
    );
    const findNavigationElement = (service as unknown as {
      findNavigationElement: (document: Document) => Element | null;
    }).findNavigationElement;
    const readNavList = (service as unknown as {
      readNavList: (list: Element | null, sourcePath: string) => unknown[];
    }).readNavList;
    const nav = findNavigationElement.call(service, document);
    if (!nav) {
      throw new Error('TOC navigation was not found');
    }
    const list = (service as unknown as {
      findNavigationList: (element: Element) => Element | null;
    }).findNavigationList.call(service, nav);
    const entries = readNavList.call(service, list, 'OPS/nav.xhtml');

    expect(entries).toEqual([
      jasmine.objectContaining({ href: 'OPS/text/chapter.xhtml#start', title: 'Chapter' }),
    ]);
  });

  it('falls back to a usable NCX when the declared nav is empty', async () => {
    const document = new DOMParser().parseFromString('<package/>', 'application/xml');
    const zip = new JSZip()
      .file('OPS/nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav><ol/></nav></body></html>')
      .file('OPS/toc.ncx', '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>'
        + '<navPoint id="chapter"><navLabel><text>Chapter</text></navLabel>'
        + '<content src="text/chapter.xhtml"/></navPoint></navMap></ncx>');
    const manifest = new Map([
      ['nav', { id: 'nav', href: 'OPS/nav.xhtml', properties: 'nav', mediaType: 'application/xhtml+xml' }],
      ['ncx', { id: 'ncx', href: 'OPS/toc.ncx', properties: '', mediaType: 'application/x-dtbncx+xml' }],
    ]);
    const readNavigation = (service as unknown as {
      readNavigation: (zip: JSZip, opf: Document, manifest: Map<string, unknown>, directory: string) => Promise<unknown>;
    }).readNavigation;

    const navigation = await readNavigation.call(service, zip, document, manifest, 'OPS/');

    expect(navigation).toEqual({
      entries: [jasmine.objectContaining({ title: 'Chapter', href: 'OPS/text/chapter.xhtml' })],
      topLevelEntries: [jasmine.objectContaining({ title: 'Chapter', href: 'OPS/text/chapter.xhtml' })],
    });
  });

  it('normalizes query strings while preserving fragment targets', () => {
    const resolvePath = (service as unknown as {
      resolvePath: (directory: string, href: string) => string;
    }).resolvePath;

    expect(resolvePath.call(service, 'OPS/text/', `../chapter.xhtml${queryDelimiter}source=nav#section`)).toBe(
      'OPS/chapter.xhtml#section',
    );
    expect(resolvePath.call(service, 'OPS/text/', 'https://example.com/chapter.xhtml')).toBe('');
  });

  it('selects the section level immediately above detailed TOC entries', () => {
    const buildSections = (service as unknown as {
      buildSections: (entries: readonly unknown[], units: readonly SplitAnalysisUnit[]) => unknown;
    }).buildSections;
    const units: SplitAnalysisUnit[] = [
      { id: 'chapter-1', title: 'Chapter 1', href: 'OPS/chapter-1.xhtml', sourcePath: 'OPS/chapter-1.xhtml', order: 0, sizeBytes: 1, sectionId: null },
      { id: 'chapter-2', title: 'Chapter 2', href: 'OPS/chapter-2.xhtml', sourcePath: 'OPS/chapter-2.xhtml', order: 1, sizeBytes: 1, sectionId: null },
      { id: 'chapter-3', title: 'Chapter 3', href: 'OPS/chapter-3.xhtml', sourcePath: 'OPS/chapter-3.xhtml', order: 2, sizeBytes: 1, sectionId: null },
    ];
    const entries = [
      {
        id: 'book', title: 'Book', href: 'OPS/book.xhtml', children: [
          {
            id: 'section-1', title: 'Section 1', href: 'OPS/section-1.xhtml', children: [
              { id: 'chapter-1-entry', title: 'Chapter 1', href: 'OPS/chapter-1.xhtml', children: [] },
              { id: 'chapter-2-entry', title: 'Chapter 2', href: 'OPS/chapter-2.xhtml', children: [] },
            ],
          },
          {
            id: 'section-2', title: 'Section 2', href: 'OPS/section-2.xhtml', children: [
              { id: 'chapter-3-entry', title: 'Chapter 3', href: 'OPS/chapter-3.xhtml', children: [] },
            ],
          },
        ],
      },
    ];

    expect(buildSections.call(service, entries, units)).toEqual([
      { id: 'section-1', title: 'Section 1', firstUnitOrder: 0, lastUnitOrder: 1 },
      { id: 'section-2', title: 'Section 2', firstUnitOrder: 2, lastUnitOrder: 2 },
    ]);
  });

  it('uses native metadata without reading the EPUB through Filesystem', async () => {
    const nativeService = Object.create(SplitAnalysisService.prototype) as SplitAnalysisService;
    const analyzeSplitEpub = jasmine.createSpy('analyzeSplitEpub').and.resolveTo({
      fileSizeBytes: 75 * 1024 * 1024,
      units: [
        {
          id: 'chapter-1',
          title: '',
          href: 'OPS/chapter-1.xhtml',
          sourcePath: 'OPS/chapter-1.xhtml',
          order: 0,
          sizeBytes: 1024,
        },
        {
          id: 'chapter-2',
          title: 'Chapter 2',
          href: 'OPS/chapter-2.xhtml',
          sourcePath: 'OPS/chapter-2.xhtml',
          order: 1,
          sizeBytes: 2048,
        },
      ],
      tocEntries: [
        {
          id: 'section-1',
          title: 'Section 1',
          href: 'OPS/chapter-1.xhtml',
          spineItemId: 'chapter-1',
          children: [
            {
              id: 'chapter-1-entry',
              title: 'Chapter 1',
              href: 'OPS/chapter-1.xhtml',
              spineItemId: 'chapter-1',
              children: [],
            },
            {
              id: 'chapter-2-entry',
              title: 'Chapter 2',
              href: 'OPS/chapter-2.xhtml',
              spineItemId: 'chapter-2',
              children: [],
            },
          ],
        },
      ],
    });
    Object.defineProperties(nativeService, {
      epubRewrite: {
        value: {
          isSupported: () => true,
          analyzeSplitEpub,
        },
      },
      translate: {
        value: {
          instant: () => 'Chapter 1',
        },
      },
    });

    const analysis = await nativeService.analyze({
      fileName: 'book.epub',
      fileSizeBytes: 75 * 1024 * 1024,
      workingFile: null,
      workingPath: 'EpubWork/book.epub',
      workingNativePath: '/data/user/0/app/files/book.epub',
    });

    expect(analyzeSplitEpub).toHaveBeenCalledWith('/data/user/0/app/files/book.epub');
    expect(analysis.units).toEqual([
      jasmine.objectContaining({ id: 'chapter-1', title: 'Chapter 1', sectionId: 'section-1' }),
      jasmine.objectContaining({ id: 'chapter-2', title: 'Chapter 2', sectionId: 'section-1' }),
    ]);
    expect(analysis.hasUsableToc).toBeTrue();
  });

  it('does not fall back to an in-memory native EPUB read', async () => {
    const nativeService = Object.create(SplitAnalysisService.prototype) as SplitAnalysisService;
    Object.defineProperties(nativeService, {
      epubRewrite: {
        value: {
          isSupported: () => false,
        },
      },
      translate: {
        value: {
          instant: () => 'Chapter 1',
        },
      },
    });

    await expectAsync(nativeService.analyze({
      fileName: 'book.epub',
      fileSizeBytes: 75 * 1024 * 1024,
      workingFile: null,
      workingPath: 'EpubWork/book.epub',
      workingNativePath: '/data/user/0/app/files/book.epub',
    })).toBeRejectedWithError('NATIVE_SPLIT_ANALYSIS_UNAVAILABLE');
  });
});
