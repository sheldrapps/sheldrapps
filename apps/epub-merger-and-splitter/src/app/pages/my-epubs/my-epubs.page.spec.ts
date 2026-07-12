import { MyEpubsPage } from './my-epubs.page';

describe('MyEpubsPage', () => {
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
});
