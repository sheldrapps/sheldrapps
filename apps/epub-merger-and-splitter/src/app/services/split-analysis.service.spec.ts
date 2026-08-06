import JSZip from 'jszip';

import { SplitAnalysisService } from './split-analysis.service';

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
});
