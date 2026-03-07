import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

export type PreviewActionRegion = 'header' | 'footer' | 'unavailable';

export interface PreviewAction {
  id: string;
  labelKey?: string;
  icon?: string;
  layout?: 'text' | 'icon' | 'icon-text' | 'app-icon-text';
  fill?: 'clear' | 'outline' | 'solid' | 'default';
  size?: 'small' | 'default' | 'large';
  cssClass?: string;
  disabled?: boolean;
  hidden?: boolean;
  ariaLabelKey?: string;
}

export interface PreviewUnavailableConfig {
  visible: boolean;
  textKey: string;
  action?: PreviewAction;
}

export interface PreviewActionClickEvent {
  actionId: string;
  region: PreviewActionRegion;
  nativeEvent?: Event;
}

@Component({
  selector: 'sh-cover-preview-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './cover-preview-modal.component.html',
  styleUrls: ['./cover-preview-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverPreviewModalComponent {
  @Input() isOpen = false;
  @Input() titleKey = 'COVERS.PREVIEW_TITLE';
  @Input() imageDataUrl: string | null = null;
  @Input() imageAlt = 'cover preview';
  @Input() loading = false;
  @Input() gettingCover = false;
  @Input() gettingCoverTextKey = 'COVERS.GETTING_COVER';
  @Input() loadingTextKey = 'COVERS.LOADING_PREVIEW';
  @Input() headerActions: PreviewAction[] = [];
  @Input() footerActions: PreviewAction[] = [];
  @Input() unavailableConfig: PreviewUnavailableConfig | null = null;

  @Output() dismissed = new EventEmitter<void>();
  @Output() actionClick = new EventEmitter<PreviewActionClickEvent>();

  onDidDismiss(): void {
    this.dismissed.emit();
  }

  onHeaderActionClick(action: PreviewAction, ev: Event): void {
    this.emitAction('header', action, ev);
  }

  onFooterActionClick(action: PreviewAction, ev: Event): void {
    this.emitAction('footer', action, ev);
  }

  onUnavailableActionClick(action: PreviewAction, ev: Event): void {
    this.emitAction('unavailable', action, ev);
  }

  visibleActions(actions: PreviewAction[]): PreviewAction[] {
    return actions.filter((action) => !action.hidden);
  }

  visibleUnavailableAction(): PreviewAction | null {
    const action = this.unavailableConfig?.action ?? null;
    if (!action || action.hidden) return null;
    return action;
  }

  private emitAction(
    region: PreviewActionRegion,
    action: PreviewAction,
    ev: Event,
  ): void {
    ev.stopPropagation();
    if (action.disabled) return;
    this.actionClick.emit({
      actionId: action.id,
      region,
      nativeEvent: ev,
    });
  }
}
