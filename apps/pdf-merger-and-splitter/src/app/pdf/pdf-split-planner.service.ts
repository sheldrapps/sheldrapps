import { Injectable } from '@angular/core';
import {
  type PdfAnalysis,
  type PdfBookmark,
  type PdfSplitMethod,
  type PdfSplitOutputPlan,
} from './pdf-domain';

export type PdfSplitBookmarkMode = 'chapter' | 'section';
export type PdfManualSplitMode = 'toc' | 'pages';

export interface PdfSplitBookmarkOption {
  id: string;
  title: string;
  pageIndex: number;
  depth: number;
  hasChildren: boolean;
}

interface PdfSplitBookmarkNode extends PdfSplitBookmarkOption {
  parentId?: string;
  hasNavigableChildren: boolean;
}

export interface PdfSplitPlanRequest {
  analysis: PdfAnalysis | null | undefined;
  sourceSizeBytes: number;
  coverSizeBytes?: number;
  method: PdfSplitMethod;
  bookmarkMode: PdfSplitBookmarkMode;
  manualMode: PdfManualSplitMode;
  manualBookmarkIds: readonly string[];
  manualPageInput: string;
  equalParts: number;
  maximumSizeMb: number;
}

@Injectable({ providedIn: 'root' })
export class PdfSplitPlannerService {
  flattenBookmarks(analysis: PdfAnalysis | null | undefined): PdfSplitBookmarkOption[] {
    return this.flattenBookmarkTree(analysis).map(({ parentId: _parentId, hasNavigableChildren: _hasNavigableChildren, ...bookmark }) => bookmark);
  }

  sectionBookmarks(analysis: PdfAnalysis | null | undefined): PdfSplitBookmarkOption[] {
    const nodes = this.flattenBookmarkTree(analysis);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const sectionIds = new Set<string>();

    nodes
      .filter((node) => !node.hasNavigableChildren)
      .forEach((chapter) => {
        let parentId = chapter.parentId;
        while (parentId) {
          const parent = nodeById.get(parentId);
          if (!parent) break;
          if (typeof parent.pageIndex === 'number') {
            sectionIds.add(parent.id);
            break;
          }
          parentId = parent.parentId;
        }
      });

    return nodes
      .filter((node) => sectionIds.has(node.id))
      .map(({ parentId: _parentId, hasNavigableChildren: _hasNavigableChildren, ...bookmark }) => bookmark)
      .sort((left, right) => left.pageIndex - right.pageIndex || left.depth - right.depth);
  }

  chapterBookmarks(analysis: PdfAnalysis | null | undefined): PdfSplitBookmarkOption[] {
    const nodes = this.flattenBookmarkTree(analysis);
    const hasNestedEntries = nodes.some((bookmark) => bookmark.depth > 0);
    return nodes
      .filter((bookmark) => !hasNestedEntries || !bookmark.hasNavigableChildren)
      .map(({ parentId: _parentId, hasNavigableChildren: _hasNavigableChildren, ...bookmark }) => bookmark)
      .sort((left, right) => left.pageIndex - right.pageIndex || left.depth - right.depth);
  }

  buildOutputs(request: PdfSplitPlanRequest): PdfSplitOutputPlan[] {
    const pageCount = request.analysis?.pageCount ?? 0;
    if (pageCount < 1) return [];

    const coverSizeBytes = Math.max(0, request.coverSizeBytes ?? 0);
    const outputs = (() => {
    switch (request.method) {
      case 'bookmarks':
        return this.buildBookmarkOutputs(pageCount, this.bookmarksForMode(request));
      case 'manual-cut-points':
        return this.buildManualOutputs(pageCount, request);
      case 'equal-number-of-parts':
        return this.buildEqualOutputs(pageCount, request.equalParts);
      case 'maximum-file-size':
        return this.buildMaximumSizeOutputs(pageCount, request.sourceSizeBytes, request.maximumSizeMb, coverSizeBytes);
    }
    })();

    return outputs.map((output) => {
      const bookSizeBytes = Math.max(0, Math.round(request.sourceSizeBytes * output.pageCount / pageCount));
      return {
        ...output,
        bookSizeBytes,
        coverSizeBytes,
        estimatedSizeBytes: bookSizeBytes + coverSizeBytes,
      };
    });
  }

  parseManualPageSize(input: string, pageCount: number): number | null {
    const pageSize = Number(input.trim());
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > pageCount) return null;
    return pageSize;
  }

  private bookmarksForMode(request: PdfSplitPlanRequest): PdfSplitBookmarkOption[] {
    return request.bookmarkMode === 'section'
      ? this.sectionBookmarks(request.analysis)
      : this.chapterBookmarks(request.analysis);
  }

  private buildManualOutputs(pageCount: number, request: PdfSplitPlanRequest): PdfSplitOutputPlan[] {
    if (request.manualMode === 'pages') {
      const pageSize = this.parseManualPageSize(request.manualPageInput, pageCount);
      if (!pageSize) return [];
      const starts = Array.from(
        { length: Math.ceil(pageCount / pageSize) },
        (_, index) => ({ pageIndex: index * pageSize, title: undefined }),
      );
      return this.buildOutputsFromStarts(pageCount, starts);
    }
    const starts = this.flattenBookmarks(request.analysis)
      .filter((bookmark) => request.manualBookmarkIds.includes(bookmark.id))
      .map((bookmark) => ({ pageIndex: bookmark.pageIndex, title: bookmark.title }));
    return this.buildOutputsFromStarts(pageCount, starts);
  }

  private buildBookmarkOutputs(
    pageCount: number,
    bookmarks: readonly PdfSplitBookmarkOption[],
  ): PdfSplitOutputPlan[] {
    if (bookmarks.length === 0) return [];
    const firstBookmark = bookmarks[0];
    const starts = firstBookmark.pageIndex > 0
      ? [{ pageIndex: 0, title: firstBookmark.title }, ...bookmarks.slice(1).map((bookmark) => ({ pageIndex: bookmark.pageIndex, title: bookmark.title }))]
      : bookmarks.map((bookmark) => ({ pageIndex: bookmark.pageIndex, title: bookmark.title }));
    return this.buildOutputsFromStarts(
      pageCount,
      starts,
    );
  }

  private flattenBookmarkTree(analysis: PdfAnalysis | null | undefined): PdfSplitBookmarkNode[] {
    const flattened: PdfSplitBookmarkNode[] = [];
    const visit = (
      bookmarks: readonly PdfBookmark[],
      depth: number,
      parentId?: string,
    ): boolean => {
      let hasNavigableChildren = false;
      bookmarks.forEach((bookmark) => {
        const childHasNavigableEntries = visit(bookmark.children, depth + 1, bookmark.id);
        const hasDestination = typeof bookmark.destinationPageIndex === 'number';
        if (hasDestination) {
          flattened.push({
            id: bookmark.id,
            title: bookmark.title,
            pageIndex: bookmark.destinationPageIndex!,
            depth,
            hasChildren: bookmark.children.length > 0,
            parentId,
            hasNavigableChildren: childHasNavigableEntries,
          });
        }
        if (hasDestination || childHasNavigableEntries) hasNavigableChildren = true;
      });
      return hasNavigableChildren;
    };

    visit(analysis?.bookmarks ?? [], 0);
    return flattened.sort((left, right) => left.pageIndex - right.pageIndex || left.depth - right.depth);
  }

  private buildOutputsFromStarts(
    pageCount: number,
    starts: readonly { pageIndex: number; title?: string }[],
  ): PdfSplitOutputPlan[] {
    const validStarts = starts
      .filter((start) => start.pageIndex >= 0 && start.pageIndex < pageCount)
      .sort((left, right) => left.pageIndex - right.pageIndex)
      .filter((start, index, values) => index === 0 || start.pageIndex !== values[index - 1].pageIndex);
    const first = validStarts.find((start) => start.pageIndex === 0);
    const boundaries = [
      { pageIndex: 0, title: first?.title },
      ...validStarts.filter((start) => start.pageIndex > 0),
    ];
    return boundaries.map((start, index) => {
      const next = boundaries[index + 1];
      const end = (next?.pageIndex ?? pageCount) - 1;
      return this.outputFromRange(index + 1, start.pageIndex, end, start.title);
    });
  }

  private buildEqualOutputs(pageCount: number, requestedParts: number): PdfSplitOutputPlan[] {
    const parts = Math.max(2, Math.min(requestedParts, pageCount));
    return Array.from({ length: parts }, (_, index) => {
      const start = Math.floor((index * pageCount) / parts);
      const end = Math.floor(((index + 1) * pageCount) / parts) - 1;
      return this.outputFromRange(index + 1, start, end);
    });
  }

  private buildMaximumSizeOutputs(
    pageCount: number,
    sourceSizeBytes: number,
    maximumSizeMb: number,
    coverSizeBytes: number,
  ): PdfSplitOutputPlan[] {
    const maximumBytes = Math.max(1, maximumSizeMb) * 1024 * 1024;
    const estimatedPageBytes = Math.max(1, sourceSizeBytes / pageCount);
    const maximumBookBytes = Math.max(1, maximumBytes - coverSizeBytes);
    const outputs: PdfSplitOutputPlan[] = [];
    let start = 0;
    let accumulatedBytes = 0;

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      if (pageIndex > start && accumulatedBytes + estimatedPageBytes > maximumBookBytes) {
        outputs.push(this.outputFromRange(outputs.length + 1, start, pageIndex - 1));
        start = pageIndex;
        accumulatedBytes = 0;
      }
      accumulatedBytes += estimatedPageBytes;
    }

    outputs.push(this.outputFromRange(outputs.length + 1, start, pageCount - 1));
    return outputs;
  }

  private outputFromRange(
    index: number,
    start: number,
    end: number,
    title?: string,
  ): PdfSplitOutputPlan {
    return {
      id: `part-${index}`,
      title: `${this.normalizeTitle(title) || `part-${index}`}.pdf`,
      ranges: [{ fromPageIndex: start, toPageIndex: end }],
      pageCount: Math.max(0, end - start + 1),
    };
  }

  private normalizeTitle(title: string | undefined): string {
    return (title ?? '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
