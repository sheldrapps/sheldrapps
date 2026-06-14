import { TestBed } from '@angular/core/testing';

import { FileService } from './file.service.js';

describe('FileService', () => {
  let service: FileService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('saveGeneratedEpub should reuse filename when overwriteExisting is set', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const coverFile = new File([new Uint8Array([7, 8, 9])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const epubRewrite = (service as any).epubRewrite;
    spyOn(epubRewrite, 'isSupported').and.returnValue(true);
    spyOn<any>(service, 'applyCoverMetadataToEpubBytes').and.resolveTo(bytes);
    const writeEpubSpy = spyOn<any>(service, 'writePublicEpub').and.resolveTo();
    const getUriSpy = spyOn<any>(service, 'getPublicEpubFileUriOrThrow').and.resolveTo(
      'app://library/book.epub',
    );
    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'should-not-be-used.epub',
    );
    spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCreatorThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
      overwriteExisting: true,
    });

    expect(getUniqueSpy).not.toHaveBeenCalled();
    expect(writeEpubSpy).toHaveBeenCalledWith('book.epub', bytes);
    expect(getUriSpy).toHaveBeenCalledWith('book.epub');
    expect(result.filename).toBe('book.epub');
  });

  it('saveGeneratedEpub should generate a unique filename on web when overwriteExisting is not set', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const coverFile = new File([new Uint8Array([1, 2, 3])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const epubRewrite = (service as any).epubRewrite;
    spyOn(epubRewrite, 'isSupported').and.returnValue(false);
    const fileKit = (service as any).fileKit;
    const writeBytesSpy = spyOn(fileKit, 'writeBytes').and.resolveTo();
    const getUriSpy = spyOn(fileKit, 'getUri').and.resolveTo('app://library/book-1.epub');
    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'book (1).epub',
    );
    const persistAssetsSpy = spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCreatorThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
    });

    expect(getUniqueSpy).toHaveBeenCalledWith('book.epub');
    expect(writeBytesSpy).toHaveBeenCalled();
    expect(getUriSpy).toHaveBeenCalledWith({
      dir: 'Documents',
      path: 'EPUBCreator/book (1).epub',
    });
    expect(persistAssetsSpy).toHaveBeenCalledWith(coverFile, 'book (1).epub');
    expect(result).toEqual({
      path: 'EPUBCreator/book (1).epub',
      uri: 'app://library/book-1.epub',
      filename: 'book (1).epub',
      thumbPath: 'EPUBCreatorThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });
  });

  it('saveGeneratedEpub should generate a unique filename when rewrite is supported', async () => {
    const bytes = new Uint8Array([4, 5, 6]);
    const coverFile = new File([new Uint8Array([1, 2, 3])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    const epubRewrite = (service as any).epubRewrite;
    spyOn(epubRewrite, 'isSupported').and.returnValue(true);
    spyOn<any>(service, 'applyCoverMetadataToEpubBytes').and.resolveTo(bytes);
    const writeEpubSpy = spyOn<any>(service, 'writePublicEpub').and.resolveTo();
    const getUriSpy = spyOn<any>(service, 'getPublicEpubFileUriOrThrow').and.resolveTo(
      'app://library/book-1.epub',
    );
    const getUniqueSpy = spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo(
      'book (1).epub',
    );
    spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCreatorThumbs/book-1.jpg',
      thumbFilename: 'book-1.jpg',
    });

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
    });

    expect(getUniqueSpy).toHaveBeenCalledWith('book.epub');
    expect(writeEpubSpy).toHaveBeenCalledWith('book (1).epub', bytes);
    expect(getUriSpy).toHaveBeenCalledWith('book (1).epub');
    expect(result.filename).toBe('book (1).epub');
  });
});
