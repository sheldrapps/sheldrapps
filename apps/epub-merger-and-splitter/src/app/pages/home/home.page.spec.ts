import { HomePage } from './home.page';

describe('HomePage', () => {
  it('navigates to under construction', () => {
    const navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    const ctx = Object.assign(Object.create(HomePage.prototype), {
      router: {
        navigateByUrl,
      },
    });

    HomePage.prototype.openUnderConstruction.call(ctx);

    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/home/under-construction');
  });
});
