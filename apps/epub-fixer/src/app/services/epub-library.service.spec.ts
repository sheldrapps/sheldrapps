import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import {
  EpubRewriteService,
  FileKitService,
  WEB_EPUB_COVER_SERVICE_TOKEN,
} from '@sheldrapps/file-kit';

import { EpubLibraryService } from './epub-library.service';

describe('EpubLibraryService', () => {
  let service: EpubLibraryService;
  let epubRewrite: jasmine.SpyObj<EpubRewriteService>;
  let fileKit: jasmine.SpyObj<FileKitService>;

  beforeEach(() => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);

    epubRewrite = jasmine.createSpyObj<EpubRewriteService>(
      'EpubRewriteService',
      ['isSupported'],
    );
    fileKit = jasmine.createSpyObj<FileKitService>('FileKitService', [
      'fromBase64',
      'toBase64',
    ]);

    TestBed.configureTestingModule({
      providers: [
        EpubLibraryService,
        { provide: EpubRewriteService, useValue: epubRewrite },
        { provide: FileKitService, useValue: fileKit },
        { provide: WEB_EPUB_COVER_SERVICE_TOKEN, useValue: null },
      ],
    });

    service = TestBed.inject(EpubLibraryService);
  });

  it('reopens saved native epubs by uri without reading bytes first', async () => {
    epubRewrite.isSupported.and.returnValue(true);
    const statSpy = spyOn(Filesystem, 'stat').and.resolveTo({
      size: 123,
    } as never);
    const readFileSpy = spyOn(Filesystem, 'readFile').and.rejectWith(
      new Error('readFile should not be called for native project reopen'),
    );

    const loaded = await service.loadGeneratedEpubByFilename('book.epub');

    expect(loaded).not.toBeNull();
    expect(loaded?.uri).toBe(
      'file:///storage/emulated/0/Documents/EPUBFixer/book.epub',
    );
    expect(loaded?.size).toBe(123);
    expect(loaded?.file.name).toBe('book.epub');
    expect(loaded?.file.type).toBe('application/epub+zip');
    expect(loaded?.file.size).toBe(0);
    expect(readFileSpy).not.toHaveBeenCalled();
    expect(statSpy).toHaveBeenCalled();
  });

  it('falls back to reading bytes when the native uri path is unavailable', async () => {
    epubRewrite.isSupported.and.returnValue(true);
    spyOn(Filesystem, 'stat').and.rejectWith(new Error('missing'));
    const readFileSpy = spyOn(Filesystem, 'readFile').and.resolveTo({
      data: 'AQID',
    } as never);
    fileKit.fromBase64.and.returnValue(new Uint8Array([1, 2, 3]));

    const loaded = await service.loadGeneratedEpubByFilename('book.epub');

    expect(loaded).not.toBeNull();
    expect(loaded?.uri).toBeNull();
    expect(loaded?.size).toBe(3);
    expect(loaded?.file.name).toBe('book.epub');
    expect(loaded?.file.size).toBe(3);
    expect(readFileSpy).toHaveBeenCalled();
    expect(fileKit.fromBase64).toHaveBeenCalledWith('AQID');
  });
});
