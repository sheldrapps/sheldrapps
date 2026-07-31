import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { Directory } from '@capacitor/filesystem';
import {
  EPUB_PUBLIC_FILESYSTEM,
  EpubRewriteService,
  type EpubPublicFilesystem,
  FileKitService,
  WEB_EPUB_COVER_SERVICE_TOKEN,
} from '@sheldrapps/file-kit';

import { EpubLibraryService } from './epub-library.service';

describe('EpubLibraryService', () => {
  let service: EpubLibraryService;
  let epubRewrite: jasmine.SpyObj<EpubRewriteService>;
  let fileKit: jasmine.SpyObj<FileKitService>;
  let filesystem: jasmine.SpyObj<EpubPublicFilesystem>;
  let publicFiles: Set<string>;

  beforeEach(() => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    publicFiles = new Set();
    filesystem = jasmine.createSpyObj<EpubPublicFilesystem>('Filesystem', [
      'mkdir',
      'readdir',
      'writeFile',
      'getUri',
      'deleteFile',
      'rename',
      'readFile',
      'stat',
    ]);
    filesystem.mkdir.and.resolveTo({} as never);
    filesystem.readdir.and.callFake(() =>
      Promise.resolve({ files: [...publicFiles] } as never),
    );
    filesystem.writeFile.and.callFake((options) => {
      if (
        options.directory === Directory.Documents &&
        options.path.startsWith('EPUBFixer/')
      ) {
        publicFiles.add(options.path.split('/').pop() as string);
      }
      return Promise.resolve({} as never);
    });
    filesystem.getUri.and.callFake((options) =>
      Promise.resolve({
        uri: `file:///storage/emulated/0/Documents/${options.path}`,
      } as never),
    );
    filesystem.deleteFile.and.resolveTo(undefined);
    filesystem.rename.and.resolveTo(undefined);
    filesystem.readFile.and.rejectWith(new Error('file missing'));
    filesystem.stat.and.rejectWith(new Error('file missing'));

    epubRewrite = jasmine.createSpyObj<EpubRewriteService>(
      'EpubRewriteService',
      [
        'isSupported',
        'ensurePublicExportFolder',
        'publishPublicDocument',
        'listPublicDocuments',
        'getPublicDocument',
        'deletePublicDocument',
        'scanFile',
        'extractCoverAssetFile',
      ],
    );
    fileKit = jasmine.createSpyObj<FileKitService>('FileKitService', [
      'fromBase64',
      'toBase64',
      'delete',
    ]);

    TestBed.configureTestingModule({
      providers: [
        EpubLibraryService,
        { provide: EpubRewriteService, useValue: epubRewrite },
        { provide: FileKitService, useValue: fileKit },
        { provide: EPUB_PUBLIC_FILESYSTEM, useValue: filesystem },
        { provide: WEB_EPUB_COVER_SERVICE_TOKEN, useValue: null },
      ],
    });

    service = TestBed.inject(EpubLibraryService);
  });

  it('reopens saved native epubs by uri without reading bytes first', async () => {
    epubRewrite.isSupported.and.returnValue(true);
    epubRewrite.getPublicDocument.and.resolveTo({
      uri: 'content://documents/EPUBFixer/book.epub',
      filename: 'book.epub',
      size: 123,
    });
    const readFileSpy = filesystem.readFile;
    filesystem.readFile.and.rejectWith(
      new Error('readFile should not be called for native project reopen'),
    );

    const loaded = await service.loadGeneratedEpubByFilename('book.epub');

    expect(loaded).not.toBeNull();
    expect(loaded?.uri).toBe('content://documents/EPUBFixer/book.epub');
    expect(loaded?.size).toBe(123);
    expect(loaded?.file.name).toBe('book.epub');
    expect(loaded?.file.type).toBe('application/epub+zip');
    expect(loaded?.file.size).toBe(0);
    expect(readFileSpy).not.toHaveBeenCalled();
    expect(epubRewrite.getPublicDocument).toHaveBeenCalledWith(
      'EPUBFixer',
      'book.epub',
    );
  });

  it('does not read a native EPUB into memory when its public uri is unavailable', async () => {
    epubRewrite.isSupported.and.returnValue(true);
    epubRewrite.getPublicDocument.and.rejectWith(new Error('uri unavailable'));
    const readFileSpy = filesystem.readFile;

    const loaded = await service.loadGeneratedEpubByFilename('book.epub');

    expect(loaded).toBeNull();
    expect(readFileSpy).not.toHaveBeenCalled();
  });

  it('streams the repaired EPUB into Documents and lists it through SAF', async () => {
    epubRewrite.isSupported.and.returnValue(true);
    epubRewrite.ensurePublicExportFolder.and.resolveTo('content://documents');
    epubRewrite.publishPublicDocument.and.resolveTo({
      uri: 'content://documents/EPUBFixer/repaired.epub',
      filename: 'repaired.epub',
      size: 3,
      copiedBytes: 3,
    });
    epubRewrite.listPublicDocuments.and.resolveTo([
      {
        name: 'repaired.epub',
        uri: 'content://documents/EPUBFixer/repaired.epub',
        size: 3,
      },
    ]);
    const fetchSpy = spyOn(window, 'fetch');

    await service.saveExportedEpub(
      'file:///data/user/0/com.sheldrapps.epubfixer/files/repaired.epub',
      'repaired.epub',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(epubRewrite.ensurePublicExportFolder).toHaveBeenCalledWith('EPUBFixer');
    expect(epubRewrite.publishPublicDocument).toHaveBeenCalledWith({
      folderName: 'EPUBFixer',
      sourcePath: 'file:///data/user/0/com.sheldrapps.epubfixer/files/repaired.epub',
      outputName: 'repaired.epub',
      mimeType: 'application/epub+zip',
    });
    expect(await service.listEpubs()).toEqual(['repaired.epub']);
    expect(epubRewrite.listPublicDocuments).toHaveBeenCalledWith(
      'EPUBFixer',
      '.epub',
    );
  });
});
