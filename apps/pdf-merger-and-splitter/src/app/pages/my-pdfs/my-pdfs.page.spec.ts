import { signal } from '@angular/core';

import { MyPdfsPage } from './my-pdfs.page';

describe('MyPdfsPage', () => {
  it('closes the library spinner through the reactive loading state', () => {
    const page = Object.assign(Object.create(MyPdfsPage.prototype), {
      loadingState: signal(true),
    }) as MyPdfsPage;

    page.loading = false;

    expect(page.loading).toBeFalse();
  });

  it('requires confirmation before deleting', async () => {
    const confirmDelete = jasmine.createSpy('confirmDelete').and.resolveTo(false);
    const deleteRecord = jasmine.createSpy('deleteRecord');
    const ctx = { confirmDelete, deleteRecord };

    await ((MyPdfsPage.prototype as unknown as { deleteRecord: Function }).deleteRecord).call(
      ctx,
      { fileName: 'book.pdf' },
    );

    expect(confirmDelete).toHaveBeenCalled();
    expect(deleteRecord).not.toHaveBeenCalled();
  });
});
