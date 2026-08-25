import { PdfSplitPlannerService } from './pdf-split-planner.service';
import type { PdfAnalysis } from './pdf-domain';

describe('PdfSplitPlannerService', () => {
  const planner = new PdfSplitPlannerService();
  const analysis: PdfAnalysis = {
    pageCount: 10,
    pages: [],
    bookmarks: [
      {
        id: 'section-a',
        title: 'Section A',
        destinationPageIndex: 0,
        children: [
          { id: 'chapter-a1', title: 'Chapter A1', destinationPageIndex: 1, children: [] },
          { id: 'chapter-a2', title: 'Chapter A2', destinationPageIndex: 4, children: [] },
        ],
      },
      {
        id: 'section-b',
        title: 'Section B',
        destinationPageIndex: 6,
        children: [
          { id: 'chapter-b1', title: 'Chapter B1', destinationPageIndex: 7, children: [] },
        ],
      },
    ],
  };

  it('splits by chapter or section bookmark destinations', () => {
    const chapters = planner.buildOutputs({
      analysis,
      method: 'bookmarks',
      bookmarkMode: 'chapter',
      manualMode: 'toc',
      manualBookmarkIds: [],
      manualPageInput: '',
      equalParts: 2,
      maximumPagesPerFile: 10,
    });
    const sections = planner.buildOutputs({
      analysis,
      method: 'bookmarks',
      bookmarkMode: 'section',
      manualMode: 'toc',
      manualBookmarkIds: [],
      manualPageInput: '',
      equalParts: 2,
      maximumPagesPerFile: 10,
    });

    expect(chapters.map((output) => output.title)).toEqual(['Chapter A1.pdf', 'Chapter A2.pdf', 'Chapter B1.pdf']);
    expect(chapters.map((output) => output.pageCount)).toEqual([4, 3, 3]);
    expect(sections.map((output) => output.title)).toEqual(['Section A.pdf', 'Section B.pdf']);
    expect(sections.map((output) => output.pageCount)).toEqual([6, 4]);
  });

  it('splits every requested number of pages and supports selected TOC entries', () => {
    const pages = planner.buildOutputs({
      analysis,
      method: 'manual-cut-points',
      bookmarkMode: 'chapter',
      manualMode: 'pages',
      manualBookmarkIds: [],
      manualPageInput: '3',
      equalParts: 2,
      maximumPagesPerFile: 10,
    });
    const toc = planner.buildOutputs({
      analysis,
      method: 'manual-cut-points',
      bookmarkMode: 'chapter',
      manualMode: 'toc',
      manualBookmarkIds: ['chapter-a2'],
      manualPageInput: '',
      equalParts: 2,
      maximumPagesPerFile: 10,
    });

    expect(pages.map((output) => output.pageCount)).toEqual([3, 3, 3, 1]);
    expect(toc.map((output) => output.pageCount)).toEqual([4, 6]);

    const fourParts = planner.buildOutputs({
      analysis: { ...analysis, pageCount: 175 },
      method: 'manual-cut-points',
      bookmarkMode: 'chapter',
      manualMode: 'pages',
      manualBookmarkIds: [],
      manualPageInput: '50',
      equalParts: 2,
      maximumPagesPerFile: 10,
    });

    expect(fourParts.map((output) => output.pageCount)).toEqual([50, 50, 50, 25]);
  });

  it('uses the level immediately above detailed entries for sections', () => {
    const wrappedAnalysis: PdfAnalysis = {
      pageCount: 10,
      pages: [],
      bookmarks: [
        {
          id: 'book',
          title: 'Book',
          destinationPageIndex: 0,
          children: [
            {
              id: 'wrapped-section-a',
              title: 'Section A',
              destinationPageIndex: 1,
              children: [
                { id: 'wrapped-chapter-a1', title: 'Chapter A1', destinationPageIndex: 2, children: [] },
                { id: 'wrapped-chapter-a2', title: 'Chapter A2', destinationPageIndex: 5, children: [] },
              ],
            },
            {
              id: 'wrapped-section-b',
              title: 'Section B',
              destinationPageIndex: 7,
              children: [
                { id: 'wrapped-chapter-b1', title: 'Chapter B1', destinationPageIndex: 8, children: [] },
              ],
            },
          ],
        },
      ],
    };

    const sections = planner.buildOutputs({
      analysis: wrappedAnalysis,
      method: 'bookmarks',
      bookmarkMode: 'section',
      manualMode: 'toc',
      manualBookmarkIds: [],
      manualPageInput: '',
      equalParts: 2,
      maximumPagesPerFile: 10,
    });

    expect(sections.map((output) => output.title)).toEqual(['Section A.pdf', 'Section B.pdf']);
    expect(sections.map((output) => output.pageCount)).toEqual([7, 3]);
  });

  it('balances equal parts and groups pages by estimated maximum size', () => {
    const equal = planner.buildOutputs({
      analysis,
      method: 'equal-number-of-parts',
      bookmarkMode: 'chapter',
      manualMode: 'pages',
      manualBookmarkIds: [],
      manualPageInput: '',
      equalParts: 3,
      maximumPagesPerFile: 10,
    });
    const maximumPages = planner.buildOutputs({
      analysis,
      method: 'maximum-pages-per-file',
      bookmarkMode: 'chapter',
      manualMode: 'pages',
      manualBookmarkIds: [],
      manualPageInput: '',
      equalParts: 2,
      maximumPagesPerFile: 4,
    });

    expect(equal.map((output) => output.pageCount)).toEqual([3, 3, 4]);
    expect(maximumPages.map((output) => output.pageCount)).toEqual([4, 4, 2]);
  });
});
