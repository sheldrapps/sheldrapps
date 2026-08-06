import { Injectable, inject } from '@angular/core';
import JSZip, { type JSZipObject } from 'jszip';
import { TranslateService } from '@ngx-translate/core';
import { FileKitService } from '@sheldrapps/file-kit';

export type SplitAnalysisUnit = {
  id: string;
  title: string;
  href: string;
  sourcePath: string;
  order: number;
  sizeBytes: number;
  sectionId: string | null;
};

export type SplitAnalysisSection = {
  id: string;
  title: string;
  firstUnitOrder: number;
  lastUnitOrder: number;
};

export type SplitAnalysisTocEntry = {
  id: string;
  title: string;
  href: string;
  spineItemId: string | null;
  children: readonly SplitAnalysisTocEntry[];
};

export type SplitAnalysis = {
  fileName: string;
  fileSizeBytes: number;
  units: readonly SplitAnalysisUnit[];
  sections: readonly SplitAnalysisSection[];
  tocEntries: readonly SplitAnalysisTocEntry[];
  hasUsableToc: boolean;
};

type TocEntry = {
  id: string;
  title: string;
  href: string;
  children: TocEntry[];
};

type ManifestEntry = {
  id: string;
  href: string;
  properties: string;
  mediaType: string;
};

@Injectable({ providedIn: 'root' })
export class SplitAnalysisService {
  private readonly translate = inject(TranslateService);
  private readonly fileKit = inject(FileKitService);

  async analyze(input: {
    fileName: string;
    fileSizeBytes: number;
    workingFile: File | null;
    workingPath: string;
  }): Promise<SplitAnalysis> {
    const bytes = input.workingFile
      ? new Uint8Array(await input.workingFile.arrayBuffer())
      : await this.fileKit.readBytes({ dir: 'Data', path: input.workingPath });
    const zip = await JSZip.loadAsync(bytes);
    const opfPath = await this.resolveOpfPath(zip);

    if (!opfPath) {
      return this.buildFallbackAnalysis(input);
    }

    const opfText = await this.readText(zip, opfPath);
    if (!opfText) {
      return this.buildFallbackAnalysis(input);
    }

    const opfDocument = new DOMParser().parseFromString(opfText, 'application/xml');
    const opfDirectory = opfPath.includes('/')
      ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1)
      : '';
    const manifest = this.readManifest(opfDocument, opfDirectory, zip);
    const spine = this.readSpine(opfDocument, manifest);
    const navigation = await this.readNavigation(zip, opfDocument, manifest, opfDirectory);
    const units = spine.map((item, order) => ({
      id: item.id,
      title: this.titleForSpineItem(item, navigation.entries, order),
      href: item.href,
      sourcePath: item.sourcePath,
      order,
      sizeBytes: this.entrySize(zip.files[item.sourcePath], input.fileSizeBytes, spine.length),
      sectionId: null,
    }));
    const sections = this.buildSections(navigation.topLevelEntries, units);
    const tocEntries = this.buildAnalysisTocEntries(navigation.topLevelEntries, units);
    const unitsWithSections = units.map((unit) => ({
      ...unit,
      sectionId: sections.find(
        (section) => unit.order >= section.firstUnitOrder && unit.order <= section.lastUnitOrder,
      )?.id ?? null,
    }));

    return {
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      units: unitsWithSections,
      sections,
      tocEntries,
      hasUsableToc: navigation.entries.length > 0,
    };
  }

  private async resolveOpfPath(zip: JSZip): Promise<string | null> {
    const container = await this.readText(zip, 'META-INF/container.xml');
    if (!container) {
      return null;
    }

    const document = new DOMParser().parseFromString(container, 'application/xml');
    return this.firstElementByLocalName(document, 'rootfile')?.getAttribute('full-path') ?? null;
  }

  private readManifest(
    document: Document,
    opfDirectory: string,
    zip: JSZip,
  ): Map<string, ManifestEntry> {
    const result = new Map<string, ManifestEntry>();
    const manifest = this.firstElementByLocalName(document, 'manifest');
    for (const item of this.directChildrenByLocalName(manifest, 'item')) {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (!id || !href) {
        continue;
      }
      result.set(id, {
        id,
        href: this.resolvePath(opfDirectory, href.split('#')[0]),
        properties: item.getAttribute('properties') ?? '',
        mediaType: item.getAttribute('media-type') ?? '',
      });
    }
    return new Map(
      Array.from(result.entries()).filter(([, item]) => !!zip.files[item.href]),
    );
  }

  private readSpine(document: Document, manifest: Map<string, ManifestEntry>): Array<ManifestEntry & { sourcePath: string }> {
    const spine = this.firstElementByLocalName(document, 'spine');
    return this.directChildrenByLocalName(spine, 'itemref')
      .map((itemref) => manifest.get(itemref.getAttribute('idref') ?? ''))
      .filter((item): item is ManifestEntry => !!item)
      .filter((item) => item.mediaType === 'application/xhtml+xml' || item.mediaType === 'text/html')
      .map((item) => ({ ...item, sourcePath: item.href }));
  }

  private async readNavigation(
    zip: JSZip,
    opfDocument: Document,
    manifest: Map<string, ManifestEntry>,
    opfDirectory: string,
  ): Promise<{ entries: TocEntry[]; topLevelEntries: TocEntry[] }> {
    const navItem = Array.from(manifest.values()).find((item) => this.hasToken(item.properties, 'nav'));
    if (navItem) {
      const navText = await this.readText(zip, navItem.href);
      if (navText) {
        const document = new DOMParser().parseFromString(navText, 'application/xhtml+xml');
        const nav = this.findNavigationElement(document);
        const topLevelEntries = nav ? this.readNavList(this.findNavigationList(nav), navItem.href) : [];
        const entries = this.flattenEntries(topLevelEntries);
        if (entries.length > 0) {
          return { entries, topLevelEntries };
        }
      }
    }

    const ncxItem = Array.from(manifest.values()).find((item) => item.mediaType === 'application/x-dtbncx+xml');
    if (ncxItem) {
      const ncxText = await this.readText(zip, ncxItem.href);
      if (ncxText) {
        const document = new DOMParser().parseFromString(ncxText, 'application/xml');
        const topLevelEntries = this.readNcxList(this.firstElementByLocalName(document, 'navMap'), ncxItem.href);
        const entries = this.flattenEntries(topLevelEntries);
        if (entries.length > 0) {
          return { entries, topLevelEntries };
        }
      }
    }

    return { entries: [], topLevelEntries: [] };
  }

  private readNavList(list: Element | null, sourcePath: string): TocEntry[] {
    if (!list) {
      return [];
    }
    return this.directChildrenByLocalName(list, 'li').map((item, index) => {
      const link = this.findNavigationLink(item);
      const href = link?.getAttribute('href') ?? '';
      return {
        id: `toc-${index}-${href}`,
        title: link?.textContent?.trim() || `Section ${index + 1}`,
        href: this.resolvePath(sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1), href),
        children: this.readNavList(this.findNavigationList(item), sourcePath),
      };
    });
  }

  private directChild(element: Element, localNames: readonly string[]): Element | null {
    return Array.from(element.children).find((child) =>
      localNames.includes(child.localName.toLowerCase()),
    ) ?? null;
  }

  private findNavigationElement(document: Document): Element | null {
    const navigationElements = this.elementsByLocalName(document, 'nav');
    const tocNavigation = navigationElements.find((candidate) => {
      const epubType = candidate.getAttribute('epub:type')
        ?? candidate.getAttributeNS('http://www.idpf.org/2007/ops', 'type')
        ?? candidate.getAttribute('type');
      return this.hasToken(epubType, 'toc') || this.hasToken(candidate.getAttribute('role'), 'doc-toc');
    });
    return tocNavigation ?? (navigationElements.length === 1 ? navigationElements[0] : null);
  }

  private readNcxList(navMap: Element | null, sourcePath: string): TocEntry[] {
    if (!navMap) {
      return [];
    }
    return this.directChildrenByLocalName(navMap, 'navPoint').map((item, index) => {
      const content = this.directChildByLocalName(item, 'content')?.getAttribute('src') ?? '';
      const label = this.directChildByLocalName(item, 'navLabel');
      const text = label ? this.firstElementByLocalName(label, 'text')?.textContent?.trim() : '';
      return {
        id: item.getAttribute('id') ?? `ncx-${index}`,
        title: text || `Section ${index + 1}`,
        href: this.resolvePath(sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1), content),
        children: this.readNcxList(item, sourcePath),
      };
    });
  }

  private buildSections(entries: readonly TocEntry[], units: readonly SplitAnalysisUnit[]): SplitAnalysisSection[] {
    const hierarchicalEntries = entries.filter((entry) => entry.children.length > 0);
    const sectionEntries = hierarchicalEntries.length > 0 ? hierarchicalEntries : entries;

    return sectionEntries
      .map((entry) => {
        const firstUnitOrder = units.findIndex((unit) => this.sameDocument(unit.href, entry.href));
        if (firstUnitOrder < 0) {
          return null;
        }
        const nextSectionOrder = sectionEntries
          .slice(sectionEntries.indexOf(entry) + 1)
          .map((next) => units.findIndex((unit) => this.sameDocument(unit.href, next.href)))
          .find((order) => order > firstUnitOrder);
        return {
          id: entry.id,
          title: entry.title,
          firstUnitOrder,
          lastUnitOrder: nextSectionOrder === undefined ? units.length - 1 : nextSectionOrder - 1,
        };
      })
      .filter((section): section is SplitAnalysisSection => !!section)
      .filter((section, index, sections) => sections.findIndex((item) => item.firstUnitOrder === section.firstUnitOrder) === index);
  }

  private buildAnalysisTocEntries(
    entries: readonly TocEntry[],
    units: readonly SplitAnalysisUnit[],
  ): SplitAnalysisTocEntry[] {
    return entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      href: entry.href,
      spineItemId:
        units.find((unit) => this.sameDocument(unit.href, entry.href))?.id ?? null,
      children: this.buildAnalysisTocEntries(entry.children, units),
    }));
  }

  private titleForSpineItem(item: ManifestEntry, entries: readonly TocEntry[], order: number): string {
    const entry = entries.find((tocEntry) => this.sameDocument(tocEntry.href, item.href));
    return entry?.title || this.translate
      .instant('HOME.SPLIT_CONFIRM.EXAMPLE_CHAPTER_ONE')
      .replace('1', String(order + 1));
  }

  private flattenEntries(entries: readonly TocEntry[]): TocEntry[] {
    return entries.flatMap((entry) => [entry, ...this.flattenEntries(entry.children)]);
  }

  private sameDocument(left: string, right: string): boolean {
    return this.documentPath(left) === this.documentPath(right);
  }

  private resolvePath(directory: string, href: string): string {
    const rawHref = href.trim();
    if (!rawHref || this.isExternalHref(rawHref)) {
      return '';
    }
    const fragmentIndex = rawHref.indexOf('#');
    const queryIndex = rawHref.indexOf('?');
    const pathEnd = [fragmentIndex, queryIndex]
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0] ?? rawHref.length;
    const pathHref = rawHref.slice(0, pathEnd);
    const fragment = fragmentIndex >= 0 ? rawHref.slice(fragmentIndex) : '';
    const base = directory.split('/').filter(Boolean);
    for (const part of decodeURIComponent(pathHref).split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') base.pop();
      else base.push(part);
    }
    return base.join('/') + fragment;
  }

  private documentPath(href: string): string {
    const fragmentIndex = href.indexOf('#');
    const queryIndex = href.indexOf('?');
    const pathEnd = [fragmentIndex, queryIndex]
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0] ?? href.length;
    return href.slice(0, pathEnd);
  }

  private isExternalHref(href: string): boolean {
    return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href);
  }

  private hasToken(value: string | null, expected: string): boolean {
    return value?.split(/\s+/).some((token) => token.toLowerCase() === expected.toLowerCase()) ?? false;
  }

  private findNavigationList(element: Element): Element | null {
    return this.directChild(element, ['ol', 'ul'])
      ?? this.elementsByLocalName(element, 'ol')[0]
      ?? this.elementsByLocalName(element, 'ul')[0]
      ?? null;
  }

  private findNavigationLink(element: Element): Element | null {
    return this.directChild(element, ['a', 'span'])
      ?? this.elementsByLocalName(element, 'a')[0]
      ?? this.elementsByLocalName(element, 'span')[0]
      ?? null;
  }

  private firstElementByLocalName(root: Document | Element, localName: string): Element | null {
    return this.elementsByLocalName(root, localName)[0] ?? null;
  }

  private elementsByLocalName(root: Document | Element, localName: string): Element[] {
    return Array.from(root.getElementsByTagNameNS('*', localName));
  }

  private directChildrenByLocalName(root: Element | null, localName: string): Element[] {
    if (!root) {
      return [];
    }
    return Array.from(root.children).filter((child) => child.localName.toLowerCase() === localName.toLowerCase());
  }

  private directChildByLocalName(root: Element, localName: string): Element | null {
    return this.directChildrenByLocalName(root, localName)[0] ?? null;
  }

  private entrySize(entry: JSZipObject | undefined, totalSize: number, unitCount: number): number {
    const rawSize = (entry as JSZipObject & { _data?: { uncompressedSize?: number } } | undefined)?._data?.uncompressedSize;
    return rawSize && rawSize > 0 ? rawSize : Math.max(1, Math.round(totalSize / Math.max(1, unitCount)));
  }

  private async readText(zip: JSZip, path: string): Promise<string | null> {
    const entry = zip.files[path];
    return entry ? entry.async('text') : null;
  }

  private buildFallbackAnalysis(input: { fileName: string; fileSizeBytes: number }): SplitAnalysis {
    return {
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      units: [],
      sections: [],
      tocEntries: [],
      hasUsableToc: false,
    };
  }
}
