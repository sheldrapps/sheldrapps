import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ModalController } from '@ionic/angular/standalone';
import { PUBLIC_FILESYSTEM, providePdfFileKit } from '@sheldrapps/file-kit/pdf';
import { MyPdfsPage } from './my-pdfs.page';

describe('MyPdfsPage', () => {
  let component: MyPdfsPage;
  let fixture: ComponentFixture<MyPdfsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyPdfsPage, TranslateModule.forRoot()],
      providers: [
        ...providePdfFileKit({
          enableWebDevAdapters: false,
          filesystemAdapter: {
            writeBytes: async () => ({
              uri: 'memory://file',
              filename: 'file',
              mimeType: 'application/octet-stream',
              size: 0,
            }),
            readBytes: async () => new Uint8Array(),
            delete: async () => undefined,
            exists: async () => false,
            getUri: async () => 'memory://file',
          },
          shareAdapter: {
            share: async () => false,
          },
        }),
        { provide: ModalController, useValue: {} },
        { provide: PUBLIC_FILESYSTEM, useValue: {} },
      ],
    }).compileComponents();
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

  it('requires confirmation before deleting', async () => {
    const confirmDelete = jasmine.createSpy('confirmDelete').and.resolveTo(false);
    const deleteByFilename = jasmine.createSpy('deleteByFilename');
    const ctx = { confirmDelete, deleteByFilename };

    await ((MyPdfsPage.prototype as unknown as { deleteFromList: Function }).deleteFromList).call(
      ctx,
      { fileName: 'book.pdf' },
    );

    expect(confirmDelete).toHaveBeenCalled();
    expect(deleteByFilename).not.toHaveBeenCalled();
  });
});
