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
});
