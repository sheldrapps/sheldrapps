import { signal } from '@angular/core';

import { MyEpubsPage } from './my-epubs.page';
import { EPUB_EMPTY_COVER_DATA_URL } from '../../services/epub-library.service';

describe('MyEpubsPage', () => {
  beforeEach(() => {
    Object.assign(MyEpubsPage.prototype, {
      loadingState: signal(true),
    });
  });

  it('treats an empty EPUB library as an empty state', async () => {
    const listEpubs = jasmine.createSpy('listEpubs').and.resolveTo([]);

    const ctx = Object.assign(Object.create(MyEpubsPage.prototype), {
      loading: true,
      items: [],
      pageErrorKey: 'stale-error',
      pageErrorParams: { reason: 'old' },
      isLoadInProgress: false,
      loadToken: 0,
      library: {
        listEpubs,
      },
    });

    await MyEpubsPage.prototype.load.call(ctx);

    expect(listEpubs).toHaveBeenCalled();
    expect(ctx.items).toEqual([]);
    expect(ctx.pageErrorKey).toBeNull();
    expect(ctx.pageErrorParams).toBeNull();
    expect(ctx.loading).toBeFalse();
    expect(ctx.isLoadInProgress).toBeFalse();
  });

  it('routes metadata actions from the library and preview', async () => {
    const editMetadataByFilename = jasmine.createSpy('editMetadataByFilename');
    const listContext = { editMetadataByFilename };

    (MyEpubsPage.prototype.onListAction as unknown as Function).call(listContext, {
      actionId: 'metadata',
      item: { filename: 'book.epub' },
    });

    const previewContext = Object.assign(Object.create(MyEpubsPage.prototype), {
      items: [{ filename: 'book.epub', thumbDataUrl: 'data:image/png;base64,thumb' }],
      displayFilename: (filename: string) => filename.replace(/\.epub$/i, ''),
      pageErrorKey: null,
      pageErrorParams: null,
      previewFilename: null,
      library: {
        resolvePreviewAsset: jasmine.createSpy('resolvePreviewAsset').and.resolveTo({
          src: 'data:image/png;base64,cover',
          isDithered: false,
        }),
        getFileSizeBytes: jasmine.createSpy('getFileSizeBytes').and.resolveTo(2048),
      },
      previewPage: { open: jasmine.createSpy('open') },
      router: { navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true) },
      editMetadataByFilename,
    });

    await MyEpubsPage.prototype.openPreview.call(previewContext, 'book.epub');

    const previewConfig = (previewContext.previewPage.open as jasmine.Spy).calls.mostRecent()
      .args[0] as {
      footerActions: Array<{ id: string }>;
      actionHandler: (actionId: string) => void;
    };
    expect(previewConfig.footerActions).toContain(jasmine.objectContaining({ id: 'metadata' }));
    previewConfig.actionHandler('metadata');

    expect(editMetadataByFilename).toHaveBeenCalledWith('book.epub');
    expect(editMetadataByFilename).toHaveBeenCalledWith('book.epub', true);
  });

  it('opens a preview with the EPUB placeholder when the file has no cover', async () => {
    const open = jasmine.createSpy('open');
    const previewContext = Object.assign(Object.create(MyEpubsPage.prototype), {
      items: [{ filename: 'book.epub' }],
      displayFilename: (filename: string) => filename.replace(/\.epub$/i, ''),
      pageErrorKey: null,
      pageErrorParams: null,
      previewFilename: null,
      library: {
        resolvePreviewAsset: jasmine.createSpy('resolvePreviewAsset').and.resolveTo({
          src: EPUB_EMPTY_COVER_DATA_URL,
          isDithered: false,
        }),
        getFileSizeBytes: jasmine.createSpy('getFileSizeBytes').and.resolveTo(null),
      },
      previewPage: { open },
      router: { navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true) },
    });

    await MyEpubsPage.prototype.openPreview.call(previewContext, 'book.epub');

    expect(open).toHaveBeenCalledWith(
      jasmine.objectContaining({ imageSrc: EPUB_EMPTY_COVER_DATA_URL }),
    );
    expect(previewContext.pageErrorKey).toBeNull();
  });

  it('requires confirmation before deleting from the list', async () => {
    const confirmDelete = jasmine.createSpy('confirmDelete').and.resolveTo(false);
    const deleteByFilename = jasmine.createSpy('deleteByFilename');
    const ctx = { confirmDelete, deleteByFilename };

    await ((MyEpubsPage.prototype as unknown as { deleteFromList: Function }).deleteFromList).call(
      ctx,
      'book.epub',
    );

    expect(confirmDelete).toHaveBeenCalled();
    expect(deleteByFilename).not.toHaveBeenCalled();
  });
});
