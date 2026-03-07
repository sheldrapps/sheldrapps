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
  IonCard,
  IonCol,
  IonGrid,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSpinner,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

export interface CoverListItem {
  filename: string;
  thumbDataUrl?: string;
}

export interface CoverListAction {
  id: string;
  labelKey: string;
  icon?: string;
  hidden?: boolean | ((item: CoverListItem) => boolean);
  disabled?: boolean | ((item: CoverListItem) => boolean);
}

export interface CoverListActionEvent {
  actionId: string;
  item: CoverListItem;
}

@Component({
  selector: 'sh-cover-list-content',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonButton,
    IonCard,
    IonCol,
    IonGrid,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonRefresher,
    IonRefresherContent,
    IonRow,
    IonSpinner,
  ],
  templateUrl: './cover-list-content.component.html',
  styleUrls: ['./cover-list-content.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverListContentComponent {
  @Input() items: CoverListItem[] = [];
  @Input() loading = false;
  @Input() pageErrorKey: string | null = null;
  @Input() pageErrorParams: Record<string, any> | null = null;
  @Input() emptyKey = 'COVERS.EMPTY';
  @Input() placeholderKey = 'COVERS.PLACEHOLDER';
  @Input() showFileName = false;
  @Input() filenameFormatter: ((filename: string) => string) | null = null;
  @Input() thumbAlt = 'cover';
  @Input() actions: CoverListAction[] = [];
  @Input() actionResolver: ((item: CoverListItem) => CoverListAction[]) | null =
    null;

  @Output() refreshRequested = new EventEmitter<CustomEvent>();
  @Output() itemClick = new EventEmitter<CoverListItem>();
  @Output() actionClick = new EventEmitter<CoverListActionEvent>();

  openPopover = false;
  popoverEvent: Event | null = null;
  activeItem: CoverListItem | null = null;
  activeActions: CoverListAction[] = [];

  private pressTimer: any = null;
  private readonly LONG_PRESS_MS = 420;
  private readonly SCROLL_END_DELAY_MS = 160;

  private longPressFired = false;
  private moved = false;
  private scrollDuringPress = false;
  private startX = 0;
  private startY = 0;
  private readonly MOVE_TOLERANCE_X_PX = 10;
  private readonly MOVE_TOLERANCE_Y_PX = 6;
  private isScrolling = false;
  private scrollEndTimer: any = null;

  onRefresh(ev: CustomEvent) {
    this.refreshRequested.emit(ev);
  }

  onHostScrollStart(): void {
    this.isScrolling = true;
    this.scrollDuringPress = true;
    this.cancelPress();

    if (this.scrollEndTimer) {
      clearTimeout(this.scrollEndTimer);
      this.scrollEndTimer = null;
    }
  }

  onHostScrollEnd(): void {
    if (this.scrollEndTimer) clearTimeout(this.scrollEndTimer);
    this.scrollEndTimer = setTimeout(() => {
      this.isScrolling = false;
      this.scrollEndTimer = null;
    }, this.SCROLL_END_DELAY_MS);
  }

  onCardPressStart(ev: PointerEvent, item: CoverListItem): void {
    if (this.isFromDots(ev)) return;
    if (this.isScrolling) return;
    this.clearPress();

    this.longPressFired = false;
    this.moved = false;
    this.scrollDuringPress = false;
    this.startX = ev.clientX;
    this.startY = ev.clientY;

    this.pressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.openMenu(ev, item);
    }, this.LONG_PRESS_MS);
  }

  onCardPressMove(ev: PointerEvent): void {
    if (this.isScrolling) {
      this.cancelPress();
      return;
    }
    if (!this.pressTimer) return;

    const dx = Math.abs(ev.clientX - this.startX);
    const dy = Math.abs(ev.clientY - this.startY);

    if (dy > this.MOVE_TOLERANCE_Y_PX || dx > this.MOVE_TOLERANCE_X_PX) {
      this.moved = true;
      this.clearPress();
    }
  }

  onCardPressEnd(ev: PointerEvent, item: CoverListItem): void {
    if (this.isFromDots(ev)) return;
    if (this.isScrolling || this.scrollDuringPress) {
      this.cancelPress();
      return;
    }
    const isTap = !!this.pressTimer && !this.longPressFired && !this.moved;
    this.clearPress();

    if (isTap) {
      this.itemClick.emit(item);
    }
  }

  onCardPressCancel(): void {
    this.cancelPress();
  }

  onDotsClick(ev: Event, item: CoverListItem): void {
    ev.stopPropagation();
    this.openMenu(ev, item);
  }

  onPopoverDismiss(): void {
    this.openPopover = false;
    this.popoverEvent = null;
    this.activeItem = null;
    this.activeActions = [];
  }

  onActionSelect(action: CoverListAction): void {
    const item = this.activeItem;
    if (!item) return;
    if (this.isActionDisabled(action)) return;
    this.actionClick.emit({
      actionId: action.id,
      item,
    });
    this.onPopoverDismiss();
  }

  displayFilename(item: CoverListItem): string {
    if (!this.filenameFormatter) return item.filename;
    return this.filenameFormatter(item.filename);
  }

  isActionDisabled(action: CoverListAction): boolean {
    const item = this.activeItem;
    if (!item) return true;
    return this.resolveRule(action.disabled, item);
  }

  trackByFilename = (_: number, item: CoverListItem) => item.filename;

  private openMenu(ev: Event, item: CoverListItem): void {
    this.activeItem = item;
    this.activeActions = this.resolveActions(item);
    this.popoverEvent = ev;
    this.openPopover = true;
  }

  private resolveActions(item: CoverListItem): CoverListAction[] {
    const source = this.actionResolver ? this.actionResolver(item) : this.actions;
    return source.filter((action) => !this.resolveRule(action.hidden, item));
  }

  private resolveRule(
    rule: boolean | ((item: CoverListItem) => boolean) | undefined,
    item: CoverListItem,
  ): boolean {
    if (typeof rule === 'function') {
      return rule(item);
    }
    return !!rule;
  }

  private clearPress(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  private cancelPress(): void {
    this.clearPress();
    this.moved = true;
    this.longPressFired = false;
  }

  private isFromDots(ev: Event): boolean {
    const t = ev.target as HTMLElement | null;
    return !!t?.closest?.('.dots');
  }
}
