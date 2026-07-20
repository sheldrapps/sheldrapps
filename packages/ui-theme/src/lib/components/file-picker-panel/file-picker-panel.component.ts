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
  IonIcon,
  IonItem,
  IonLabel,
  IonReorder,
  IonReorderGroup,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircle,
  documentOutline,
  reorderTwoOutline,
  trashOutline,
} from 'ionicons/icons';

export interface FilePickerPanelItem {
  id: string;
  title: string;
  subtitle?: string | null;
  ariaLabel?: string | null;
}

export interface FilePickerPanelReorderEvent {
  from: number;
  to: number;
}

export interface FilePickerPanelRemoveEvent {
  id: string;
  index: number;
}

@Component({
  selector: 'sh-file-picker-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonItem,
    IonLabel,
    IonIcon,
    IonReorder,
    IonReorderGroup,
  ],
  templateUrl: './file-picker-panel.component.html',
  styleUrls: ['./file-picker-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePickerPanelComponent {
  @Input({ required: true }) title = '';
  @Input() itemsTitle: string | null = null;
  @Input() actionLabel: string | null = null;
  @Input() actionSubline: string | null = null;
  @Input() actionPlaceholder: string | null = null;
  @Input() actionAriaLabel: string | null = null;
  @Input() removeActionAriaLabel: string | null = null;
  @Input() items: readonly FilePickerPanelItem[] = [];
  @Input() disabled = false;
  @Input() invalid = false;
  @Input() selected = false;
  @Input() reorderEnabled = false;
  @Input() removeEnabled = false;

  @Output() actionSelected = new EventEmitter<void>();
  @Output() itemsReordered = new EventEmitter<FilePickerPanelReorderEvent>();
  @Output() itemRemoved = new EventEmitter<FilePickerPanelRemoveEvent>();

  constructor() {
    addIcons({
      alertCircleOutline,
      checkmarkCircle,
      documentOutline,
      reorderTwoOutline,
      trashOutline,
    });
  }

  hasItems(): boolean {
    return this.items.length > 0;
  }

  canReorder(): boolean {
    return this.reorderEnabled && this.items.length > 1;
  }

  trackByItemId = (_: number, item: FilePickerPanelItem) => item.id;

  onActionSelected(): void {
    if (this.disabled) {
      return;
    }

    this.actionSelected.emit();
  }

  onItemsReordered(
    event: CustomEvent<{ from: number; to: number; complete: () => void }>,
  ): void {
    event.detail.complete();
    this.itemsReordered.emit({
      from: event.detail.from,
      to: event.detail.to,
    });
  }

  onItemRemoved(event: Event, item: FilePickerPanelItem, index: number): void {
    event.stopPropagation();

    if (this.disabled || !this.removeEnabled) {
      return;
    }

    this.itemRemoved.emit({
      id: item.id,
      index,
    });
  }

  itemAriaLabel(item: FilePickerPanelItem, index: number): string {
    return item.ariaLabel ?? `${index + 1}. ${item.title}`;
  }
}
