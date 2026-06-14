import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CoversPage } from './covers.page';

describe('CoversPage', () => {
  let component: CoversPage;
  let fixture: ComponentFixture<CoversPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CoversPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows loading before navigating to project edit flow', async () => {
    const promptProjectEditMode = jasmine
      .createSpy('promptProjectEditMode')
      .and.resolveTo('overwrite');
    const waitForLoadingIndicatorFrame = jasmine
      .createSpy('waitForLoadingIndicatorFrame')
      .and.resolveTo(undefined);
    const blurDeepActiveElement = jasmine.createSpy('blurDeepActiveElement');
    const navigateRoot = jasmine.createSpy('navigateRoot').and.resolveTo(true);
    const ctx = {
      loading: false,
      pageErrorKey: 'old',
      pageErrorParams: { stale: true },
      promptProjectEditMode,
      waitForLoadingIndicatorFrame,
      blurDeepActiveElement,
      navCtrl: { navigateRoot },
    };

    await (
      CoversPage as unknown as {
        prototype: {
          openProjectByFilename: (
            this: typeof ctx,
            filename: string | null,
          ) => Promise<void>;
        };
      }
    ).prototype.openProjectByFilename.call(ctx, 'book.epub');

    expect(promptProjectEditMode).toHaveBeenCalled();
    expect(ctx.loading).toBeTrue();
    expect(waitForLoadingIndicatorFrame).toHaveBeenCalled();
    expect(blurDeepActiveElement).toHaveBeenCalled();
    expect(navigateRoot).toHaveBeenCalledWith('/tabs/create', {
      queryParams: { project: 'book.epub', editMode: 'overwrite' },
    });
    expect(ctx.pageErrorKey).toBeNull();
    expect(ctx.pageErrorParams).toBeNull();
  });
});
