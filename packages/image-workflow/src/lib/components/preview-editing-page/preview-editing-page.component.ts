import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  computed,
  inject,
} from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { EReaderPreviewFrameComponent } from '../e-reader-preview-frame/e-reader-preview-frame.component';
import { PreviewEditingPageService } from './preview-editing-page.service';
import { ImageWorkflowI18nService } from '../../e-reader-preview/i18n/image-workflow-i18n.service';
import { ScrollableButtonBarComponent } from '@sheldrapps/ui-theme';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-preview-editing-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    EReaderPreviewFrameComponent,
    ScrollableButtonBarComponent,
  ],
  templateUrl: './preview-editing-page.component.html',
  styleUrls: ['./preview-editing-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewEditingPageComponent implements OnDestroy {
  private readonly previewPage = inject(PreviewEditingPageService);
  private readonly imageWorkflowI18n = inject(ImageWorkflowI18nService);
  private readonly translate = inject(TranslateService);
  readonly state = this.previewPage.state;

  @HostListener('window:resize')
  onViewportResize(): void {}

  get maxFrameWidth(): number {
    if (typeof window === 'undefined') {
      return 520;
    }
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    return Math.max(1, Math.min(520, Math.floor(viewportWidth * 0.92)));
  }

  get maxFrameHeight(): number {
    if (typeof window === 'undefined') {
      return 520;
    }
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    return Math.max(1, Math.floor(viewportHeight * 0.72));
  }

  readonly footerActions = computed(() =>
    (this.state()?.footerActions ?? [])
      .filter((action) => !action.hidden)
      .map((action) => ({
        id: action.id,
        label: this.translate.instant(action.labelKey),
        icon: action.icon,
      })),
  );

  onFooterAction(actionId: string): void {
    this.state()?.actionHandler?.(actionId);
  }

  ngOnDestroy(): void {
    this.previewPage.clear();
  }

}
