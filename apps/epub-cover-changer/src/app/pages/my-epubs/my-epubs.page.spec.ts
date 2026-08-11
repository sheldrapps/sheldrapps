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
import { PreviewEditingPageService } from '@sheldrapps/image-workflow';

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
});
