import { MyEpubsPage } from './my-epubs.page';

describe('MyEpubsPage', () => {
  it('treats an empty EPUB library as an empty state', async () => {
    const listRecords = jasmine.createSpy('listRecords').and.resolveTo([]);

    const ctx = Object.assign(Object.create(MyEpubsPage.prototype), {
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
});
