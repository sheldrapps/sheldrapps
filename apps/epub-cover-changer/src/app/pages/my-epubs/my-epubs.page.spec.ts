import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import {
  AlertController,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { MyEpubsPage } from './my-epubs.page';
import { FileService } from '../../services/file.service';
import { CoversEventsService } from '../../services/covers-events.service';
import { EpubRewriteError } from '../../services/epub-rewrite.service';
import { PreviewEditingPageService } from '@sheldrapps/image-workflow';
import { RecommendedAppsService } from '@sheldrapps/recommended-apps';

describe('MyEpubsPage', () => {
  let component: MyEpubsPage;
  let fixture: ComponentFixture<MyEpubsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyEpubsPage, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: FileService, useValue: {} },
        { provide: AlertController, useValue: {} },
        { provide: CoversEventsService, useValue: {} },
        { provide: ToastController, useValue: {} },
        { provide: ModalController, useValue: {} },
        { provide: PreviewEditingPageService, useValue: {} },
        { provide: RecommendedAppsService, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MyEpubsPage);
    component = fixture.componentInstance;
  });

  it('should render', () => {
    expect(component).toBeTruthy();
  });

  it('shows loading before navigating to project edit flow', async () => {
    const promptProjectEditMode = jasmine
      .createSpy('promptProjectEditMode')
      .and.resolveTo('copy');
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
      MyEpubsPage as unknown as {
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
    expect(navigate).toHaveBeenCalledWith(['/tabs/change'], {
      queryParams: { project: 'book.epub', editMode: 'copy' },
    });
    expect(ctx.pageErrorKey).toBeNull();
    expect(ctx.pageErrorParams).toBeNull();
  });

  it('routes metadata actions from the library and preview', () => {
    const editMetadataByFilename = jasmine.createSpy('editMetadataByFilename');
    const ctx = { editMetadataByFilename, previewFilename: 'book.epub' };

    (MyEpubsPage.prototype.onListAction as unknown as Function).call(ctx, {
      actionId: 'metadata',
      item: { filename: 'book.epub' },
    });
    (MyEpubsPage.prototype.onPreviewAction as unknown as Function).call(ctx, {
      actionId: 'metadata',
      region: 'footer',
    });

    expect(editMetadataByFilename).toHaveBeenCalledWith('book.epub');
    expect(editMetadataByFilename).toHaveBeenCalledWith('book.epub', true);
  });

  it('recommends EPUB Fixer when metadata cannot be read from a damaged archive', async () => {
    const archiveError = new EpubRewriteError('ZIP_ERROR', {
      stage: 'metadata_public_read',
    });
    const showMetadataArchiveFailure = jasmine
      .createSpy('showMetadataArchiveFailure')
      .and.resolveTo();
    const showErrorToast = jasmine.createSpy('showErrorToast').and.resolveTo();
    const ctx = {
      files: {
        readPublicationMetadata: jasmine
          .createSpy('readPublicationMetadata')
          .and.rejectWith(archiveError),
      },
      logInfo: jasmine.createSpy('logInfo'),
      errorDetails: jasmine.createSpy('errorDetails').and.returnValue({
        code: archiveError.code,
      }),
      isMetadataArchiveFailure: (
        MyEpubsPage.prototype as unknown as {
          isMetadataArchiveFailure: (error: unknown) => boolean;
        }
      ).isMetadataArchiveFailure,
      showMetadataArchiveFailure,
      showErrorToast,
    };

    await (
      MyEpubsPage.prototype as unknown as {
        editMetadataByFilename: Function;
      }
    ).editMetadataByFilename.call(ctx, 'book.epub');

    expect(showMetadataArchiveFailure).toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
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
