import { signal } from '@angular/core';
import { MyEpubsPage } from './my-epubs.page';

describe('MyEpubsPage', () => {
  it('treats an empty EPUB library as an empty state', async () => {
    const listRecords = jasmine.createSpy('listRecords').and.resolveTo([]);

    const ctx = Object.assign(Object.create(MyEpubsPage.prototype), {
      loadingState: signal(true),
      loading: true,
      items: [],
      pageErrorKey: 'stale-error',
      pageErrorParams: { reason: 'old' },
      isLoadInProgress: false,
      loadToken: 0,
      library: {
        listRecords,
      },
      zone: {
        run: <T>(fn: () => T) => fn(),
      },
      changeDetector: {
        detectChanges: jasmine.createSpy('detectChanges'),
        markForCheck: jasmine.createSpy('markForCheck'),
      },
    });

    await MyEpubsPage.prototype.load.call(ctx);

    expect(listRecords).toHaveBeenCalled();
    expect(ctx.items).toEqual([]);
    expect(ctx.pageErrorKey).toBeNull();
    expect(ctx.pageErrorParams).toBeNull();
    expect(ctx.loading).toBeFalse();
    expect(ctx.isLoadInProgress).toBeFalse();
  });

  it('opens the library preview as a tab page with a return route', async () => {
    const ctx = Object.assign(Object.create(MyEpubsPage.prototype), {
      items: [{ filename: 'book.epub', thumbDataUrl: 'data:image/png;base64,thumb' }],
      displayFilename: (filename: string) => filename.replace(/\.epub$/i, ''),
      pageErrorKey: 'stale-error',
      pageErrorParams: { reason: 'old' },
      library: {
        resolvePreviewAsset: jasmine.createSpy('resolvePreviewAsset').and.resolveTo({
          src: 'data:image/png;base64,cover',
          isDithered: false,
        }),
        getFileSizeBytes: jasmine.createSpy('getFileSizeBytes').and.resolveTo(2048),
      },
      previewPage: {
        open: jasmine.createSpy('open'),
      },
      router: {
        navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
      },
    });

    await MyEpubsPage.prototype.openPreview.call(ctx, 'book.epub');

    expect(ctx.previewPage.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        imageSrc: 'data:image/png;base64,cover',
        returnUrl: '/tabs/my-epubs',
      }),
    );
    expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/tabs/preview-editing');
  });

  it('renders thumbnails already registered in the library index immediately', async () => {
    const loadThumbs = jasmine.createSpy('loadThumbs');
    const ctx = Object.assign(Object.create(MyEpubsPage.prototype), {
      loadingState: signal(true),
      loading: true,
      items: [],
      pageErrorKey: null,
      pageErrorParams: null,
      isLoadInProgress: false,
      loadToken: 0,
      library: {
        listRecords: jasmine.createSpy('listRecords').and.resolveTo([
          {
            filename: 'book.epub',
            thumbnailUri: 'data:image/jpeg;base64,cover',
          },
        ]),
      },
      loadThumbs,
      zone: {
        run: <T>(fn: () => T) => fn(),
      },
      changeDetector: {
        detectChanges: jasmine.createSpy('detectChanges'),
        markForCheck: jasmine.createSpy('markForCheck'),
      },
    });

    await MyEpubsPage.prototype.load.call(ctx);

    expect(ctx.items).toEqual([
      {
        filename: 'book.epub',
        thumbDataUrl: 'data:image/jpeg;base64,cover',
      },
    ]);
    expect(loadThumbs).toHaveBeenCalled();
  });

  it('opens a fallback preview when the EPUB has no cover', async () => {
    const ctx = Object.assign(Object.create(MyEpubsPage.prototype), {
      items: [{ filename: 'book.epub' }],
      displayFilename: (filename: string) => filename.replace(/\.epub$/i, ''),
      pageErrorKey: 'stale-error',
      pageErrorParams: { reason: 'old' },
      library: {
        resolvePreviewAsset: jasmine.createSpy('resolvePreviewAsset').and.resolveTo({
          src: '',
          isDithered: false,
        }),
        getFileSizeBytes: jasmine.createSpy('getFileSizeBytes').and.resolveTo(2048),
      },
      previewPage: {
        open: jasmine.createSpy('open'),
      },
      router: {
        navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
      },
    });

    await MyEpubsPage.prototype.openPreview.call(ctx, 'book.epub');

    expect(ctx.previewPage.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        imageSrc: null,
        fallbackLabelKey: 'MY_EPUBS.PLACEHOLDER',
        returnUrl: '/tabs/my-epubs',
      }),
    );
    expect(ctx.router.navigateByUrl).toHaveBeenCalledWith('/tabs/preview-editing');
    expect(ctx.pageErrorKey).toBeNull();
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
