import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY } from 'rxjs';
import { FileService } from '../../services/file.service';
import { CoversEventsService } from '../../services/covers-events.service';
import { PreviewEditingPageService } from '@sheldrapps/image-workflow';
import { CoversPage } from './covers.page';

describe('CoversPage', () => {
  let component: CoversPage;
  let fixture: ComponentFixture<CoversPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoversPage, TranslateModule.forRoot()],
      providers: [
        {
          provide: FileService,
          useValue: {
            listCovers: jasmine.createSpy('listCovers').and.resolveTo([]),
            listProjects: jasmine.createSpy('listProjects').and.resolveTo([]),
            hasProjectByFilename: jasmine
              .createSpy('hasProjectByFilename')
              .and.resolveTo(false),
            getOrBuildThumbDataUrlForFilename: jasmine
              .createSpy('getOrBuildThumbDataUrlForFilename')
              .and.resolveTo(undefined),
          },
        },
        { provide: CoversEventsService, useValue: { events$: EMPTY } },
        { provide: PreviewEditingPageService, useValue: {} },
      ],
    }).compileComponents();
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
