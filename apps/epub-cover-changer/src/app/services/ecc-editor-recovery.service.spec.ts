import { TestBed } from '@angular/core/testing';
import { FileKitService } from '@sheldrapps/file-kit';
import {
  ECC_RECOVERY_STORAGE,
  EccEditorRecoveryService,
} from './ecc-editor-recovery.service';
import { RECOVERY_STORE_CONFIG } from '@sheldrapps/lifecycle-kit';

describe('EccEditorRecoveryService', () => {
  let service: EccEditorRecoveryService;
  let storedValue: string | null = null;
  let dataFiles: Record<string, Uint8Array> = {};
  let setSpy: jasmine.Spy;
  let getSpy: jasmine.Spy;

  beforeEach(() => {
    storedValue = null;
    dataFiles = {};
    const storage = {
      set: async ({ value }: { key: string; value: string }) => {
        storedValue = value;
      },
      get: async () => ({ value: storedValue }),
      remove: async () => {
        storedValue = null;
      },
    };
    setSpy = spyOn(storage, 'set').and.callThrough();
    getSpy = spyOn(storage, 'get').and.callThrough();

    TestBed.configureTestingModule({
      providers: [
        EccEditorRecoveryService,
        {
          provide: FileKitService,
          useValue: {
            writeBytes: jasmine
              .createSpy('writeBytes')
              .and.callFake(async ({ path, bytes }) => {
                dataFiles[path] = new Uint8Array(bytes);
                return { path };
              }),
            readBytes: jasmine
              .createSpy('readBytes')
              .and.callFake(async ({ path }) => {
                const bytes = dataFiles[path];
                if (!bytes) throw new Error('missing');
                return bytes;
              }),
            delete: jasmine
              .createSpy('delete')
              .and.callFake(async ({ path }) => {
                delete dataFiles[path];
              }),
          },
        },
        { provide: ECC_RECOVERY_STORAGE, useValue: storage },
        {
          provide: RECOVERY_STORE_CONFIG,
          useValue: {
            appId: 'ecc',
            schemaVersion: 1,
            folder: 'EPUBCoverChangerRecovery',
          },
        },
      ],
    });
    service = TestBed.inject(EccEditorRecoveryService);
  });

  it('persists references and editor parameters without embedding EPUB bytes', async () => {
    const original = new File(['ORIGINAL_IMAGE'], 'cover.png', {
      type: 'image/png',
      lastModified: 100,
    });
    const working = new File(['WORKING_IMAGE'], 'edited.png', {
      type: 'image/png',
      lastModified: 200,
    });
    const cropState = { zoom: 1.25, rotation: 90 } as never;

    await service.save(
      {
        workflowStep: 3,
        lastEditorSourceMode: 'image',
        selectedFormatId: 'epub',
        exportQualityMode: 'best',
        cropState,
        sourceEpub: {
          selectedName: 'book.epub',
          workingPath: 'EPUBCoverChangerWork/book.epub',
          workingNativePath: '/data/book.epub',
          workingName: 'book_work.epub',
          sourceUri: 'content://provider/book',
          sourceUriPermissionPersisted: true,
        },
        output: { wasAutoSaved: false },
      },
      { originalImage: original, workingImage: working },
    );

    expect(setSpy).toHaveBeenCalled();
    expect(storedValue).not.toContain('ORIGINAL_IMAGE');
    expect(storedValue).not.toContain('WORKING_IMAGE');
    expect(storedValue).toContain('content://provider/book');
    expect(dataFiles['EPUBCoverChangerRecovery/original.png']).toBeDefined();
    expect(dataFiles['EPUBCoverChangerRecovery/working.png']).toBeDefined();

    const loaded = await service.load();
    expect(loaded?.snapshot.workflowStep).toBe(3);
    expect(loaded?.snapshot.cropState).toEqual(cropState);
    expect(loaded?.snapshot.sourceEpub?.workingPath).toBe(
      'EPUBCoverChangerWork/book.epub',
    );
    expect(loaded?.snapshot.sourceEpub?.sourceUriPermissionPersisted).toBeTrue();
    expect(loaded?.assets.originalImage?.name).toBe('cover.png');
    expect(loaded?.assets.workingImage?.name).toBe('edited.png');
    expect(getSpy).toHaveBeenCalled();
  });

  it('clears the recovery record and its controlled image assets', async () => {
    dataFiles['EPUBCoverChangerRecovery/original.png'] = new Uint8Array([1]);
    dataFiles['EPUBCoverChangerRecovery/working.png'] = new Uint8Array([2]);

    await service.clear();

    expect(storedValue).toBeNull();
    expect(dataFiles['EPUBCoverChangerRecovery/original.png']).toBeUndefined();
    expect(dataFiles['EPUBCoverChangerRecovery/working.png']).toBeUndefined();
  });
});
