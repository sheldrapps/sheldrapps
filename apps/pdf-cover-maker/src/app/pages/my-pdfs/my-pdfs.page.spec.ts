import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyPdfsPage } from './my-pdfs.page';

describe('MyPdfsPage', () => {
  let component: MyPdfsPage;
  let fixture: ComponentFixture<MyPdfsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MyPdfsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render', () => {
    expect(component).toBeTruthy();
  });

  it('shows loading before navigating to project edit flow', async () => {
    const promptProjectEditMode = jasmine
      .createSpy('promptProjectEditMode')
      .and.resolveTo('overwrite');
    const waitForLoadingIndicatorFrame = jasmine
      .createSpy('waitForLoadingIndicatorFrame')
      .and.resolveTo(undefined);
    const navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    const ctx = {
      loading: false,
      pageErrorKey: 'old',
      pageErrorParams: { stale: true },
      promptProjectEditMode,
      waitForLoadingIndicatorFrame,
      router: { navigate },
    };

    await (
      MyPdfsPage as unknown as {
        prototype: {
          openProjectByFilename: (
            this: typeof ctx,
            filename: string | null,
          ) => Promise<void>;
        };
      }
    ).prototype.openProjectByFilename.call(ctx, 'book.pdf');

    expect(promptProjectEditMode).toHaveBeenCalled();
    expect(ctx.loading).toBeTrue();
    expect(waitForLoadingIndicatorFrame).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/tabs/change'], {
      queryParams: { project: 'book.pdf', editMode: 'overwrite' },
    });
    expect(ctx.pageErrorKey).toBeNull();
    expect(ctx.pageErrorParams).toBeNull();
  });
});
