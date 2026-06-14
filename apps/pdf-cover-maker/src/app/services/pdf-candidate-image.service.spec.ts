import { TestBed } from '@angular/core/testing';

import { FileService } from './file.service';
import { PdfCandidateImageService } from './pdf-candidate-image.service';
import { PdfRewriteService } from './pdf-rewrite.service';

describe('PdfCandidateImageService', () => {
  let service: PdfCandidateImageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PdfCandidateImageService,
        {
          provide: FileService,
          useValue: jasmine.createSpyObj<FileService>('FileService', [
            'extractCoverFromPdfFile',
          ]),
        },
        {
          provide: PdfRewriteService,
          useValue: {
            isSupported: () => false,
          },
        },
      ],
    });

    service = TestBed.inject(PdfCandidateImageService);
  });

  it('discoverInternalImages should build multiple page candidates from pdf pages', async () => {
    spyOn<any>(service, 'collectEmbeddedImageCandidates').and.resolveTo([
      {
        id: 'embedded-cover',
        src: 'blob:embedded-cover',
        sourcePath: 'embedded-cover',
        fileName: 'story_cover.png',
        width: 1400,
        height: 1800,
        mimeType: 'image/png',
        sizeBytes: 12345,
        index: 0,
        metadata: {
          file: new File([new Uint8Array([1])], 'story_cover.png', {
            type: 'image/png',
          }),
          pageNumber: 1,
          source: 'embedded-image',
        },
      },
    ]);
    spyOn<any>(service, 'loadPdfDocument').and.resolveTo({
      document: {
        destroy: jasmine.createSpy('destroy').and.resolveTo(),
      },
      loadingTask: {
        destroy: jasmine.createSpy('destroy').and.resolveTo(),
      },
      pdfjs: {
        OPS: {
          paintImageXObject: 85,
          paintInlineImageXObject: 86,
          paintImageXObjectRepeat: 87,
          paintInlineImageXObjectGroup: 88,
        },
        ImageKind: {
          GRAYSCALE_1BPP: 1,
          RGB_24BPP: 2,
          RGBA_32BPP: 3,
        },
      },
    });

    const result = await service.discoverInternalImages({
      pdfFile: new File([new Uint8Array([1, 2, 3])], 'story.pdf', {
        type: 'application/pdf',
      }),
      pdfName: 'story',
      maxImages: 3,
    });

    expect(result.images.length).toBe(1);
    expect(result.images[0].id).toBe('embedded-cover');
    expect(result.images[0].metadata?.['source']).toBe('embedded-image');
    expect(result.diagnostics.manifestImageCount).toBe(1);
    expect(result.diagnostics.candidatesAfterFilters).toBe(1);
  });

  it('discoverInternalImages should fall back to the strict cover when page scanning fails', async () => {
    const coverFile = new File([new Uint8Array([9, 8, 7])], 'cover.png', {
      type: 'image/png',
    });
    spyOn(URL, 'createObjectURL').and.returnValue('blob:first-page');
    spyOn(URL, 'revokeObjectURL').and.stub();

    spyOn<any>(service, 'loadPdfBytes').and.resolveTo(null);
    spyOn<any>(service, 'resolveStrictCover').and.resolveTo({
      file: coverFile,
      sourcePath: 'first-page-render',
    });
    spyOn<any>(service, 'readImageDimensions').and.resolveTo({
      width: 1200,
      height: 1600,
    });

    const result = await service.discoverInternalImages({
      pdfFile: new File([new Uint8Array([1])], 'story.pdf', {
        type: 'application/pdf',
      }),
      pdfName: 'story',
    });

    expect(result.images.length).toBe(1);
    expect(result.images[0].sourcePath).toBe('first-page-render');
    expect(result.images[0].metadata?.['file']).toBe(coverFile);
  });
});
