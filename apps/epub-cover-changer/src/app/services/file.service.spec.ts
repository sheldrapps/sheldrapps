import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import {
  FileKitService,
  WebEpubCoverService,
} from '@sheldrapps/file-kit';

import { FileService } from './file.service';
import { EpubRewriteService } from './epub-rewrite.service';

describe('FileService', () => {
  let service: FileService;
  let webEpubCover: jasmine.SpyObj<WebEpubCoverService>;

  beforeEach(() => {
    webEpubCover = jasmine.createSpyObj<WebEpubCoverService>(
      'WebEpubCoverService',
      ['triggerDownload'],
    );

    TestBed.configureTestingModule({
      providers: [
        FileService,
        {
          provide: TranslateService,
          useValue: {
            currentLang: 'en',
            defaultLang: 'en',
            instant: (key: string) => key,
          },
        },
        {
          provide: FileKitService,
          useValue: {
            writeBytes: jasmine.createSpy('writeBytes'),
            getUri: jasmine.createSpy('getUri'),
            readBytes: jasmine.createSpy('readBytes'),
            delete: jasmine.createSpy('delete'),
            exists: jasmine.createSpy('exists'),
            share: jasmine.createSpy('share'),
            fromBase64: jasmine.createSpy('fromBase64').and.returnValue(
              new Uint8Array(),
            ),
            toBase64: jasmine.createSpy('toBase64').and.returnValue(''),
          },
        },
        {
          provide: EpubRewriteService,
          useValue: {
            isSupported: () => false,
          },
        },
        { provide: WebEpubCoverService, useValue: webEpubCover },
      ],
    });
    service = TestBed.inject(FileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('saveGeneratedEpub should persist internally on web and not trigger download', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const coverFile = new File([new Uint8Array([7, 8, 9])], 'cover.jpg', {
      type: 'image/jpeg',
    });

    spyOn<any>(service, 'getUniqueDocumentFilename').and.resolveTo('book.epub');
    const writePublicEpubSpy = spyOn<any>(service, 'writePublicEpub').and.resolveTo();
    const getUriSpy = spyOn<any>(service, 'getPublicEpubFileUriOrThrow').and.resolveTo(
      'app://library/book.epub',
    );
    const persistAssetsSpy = spyOn<any>(service, 'persistCoverAssetsFromFile').and.resolveTo({
      thumbPath: 'EPUBCoverChangerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });
    const cacheMetadataSpy = spyOn<any>(service, 'cacheResolvedCoverMetadata');

    const result = await service.saveGeneratedEpub({
      bytes,
      filename: 'book.epub',
      coverFileForThumb: coverFile,
    });

    expect(writePublicEpubSpy).toHaveBeenCalledWith('book.epub', bytes);
    expect(getUriSpy).toHaveBeenCalledWith('book.epub');
    expect(persistAssetsSpy).toHaveBeenCalledWith(coverFile, 'book.epub');
    expect(cacheMetadataSpy).toHaveBeenCalledWith('book.epub', undefined);
    expect(webEpubCover.triggerDownload).not.toHaveBeenCalled();
    expect(result).toEqual({
      path: 'EPUBCoverChanger/book.epub',
      uri: 'app://library/book.epub',
      filename: 'book.epub',
      thumbPath: 'EPUBCoverChangerThumbs/book.jpg',
      thumbFilename: 'book.jpg',
    });
  });
});
