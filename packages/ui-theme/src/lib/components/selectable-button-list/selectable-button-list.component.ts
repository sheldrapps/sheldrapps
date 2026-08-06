import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
} from '@angular/core';
import { IonIcon, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmark, chevronForwardOutline, radioButtonOn } from 'ionicons/icons';
import { ProBadgeComponent } from '../pro-badge/pro-badge.component';

export interface SelectableButtonListItem {
  value: string;
  kind?: 'action' | 'static';
  title?: string;
  titleKey?: string;
  subline?: string;
  sublineKey?: string;
  leadingIconName?: string;
  leadingIconSrc?: string;
  leadingIconSvg?: 'pro-badge';
  leadingIconClass?: string | readonly string[];
  trailingIconName?: string;
  trailingIconSrc?: string;
  trailingIconClass?: string | readonly string[];
  selectedIconName?: string;
  selectedIconSrc?: string;
  selectedIconClass?: string | readonly string[];
  disabled?: boolean;
  ariaLabel?: string;
  ariaLabelKey?: string;
}

export type SelectableButtonListSelectionMode = 'single' | 'multiple';

@Component({
  selector: 'sh-selectable-button-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, IonItem, IonLabel, IonIcon, ProBadgeComponent],
  templateUrl: './selectable-button-list.component.html',
  styleUrls: ['./selectable-button-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectableButtonListComponent {
  @Input({ required: true }) items: readonly SelectableButtonListItem[] = [];
  @Input({ required: true }) value: string | null = null;
  @Input() values: readonly string[] = [];
  @Input() selectionMode: SelectableButtonListSelectionMode = 'single';
  @Input() ariaLabel: string | null = null;
  @Input() showSelectedIcon = true;
  @Input() selectedIconName = 'checkmark';
  @Input() selectedIconSrc: string | null = null;
  @Input() selectedIconClass: string | readonly string[] | null = null;
  @Input() expandedValue: string | null = null;
  @ContentChild(TemplateRef) expandedContentTemplate: TemplateRef<unknown> | undefined;
  @Output() valueChange = new EventEmitter<string>();
  @Output() valuesChange = new EventEmitter<readonly string[]>();

  constructor() {
    addIcons({
      checkmark,
      chevronForwardOutline,
      radioButtonOn,
    });
  }

  trackByValue = (_: number, item: SelectableButtonListItem) => item.value;

  onSelect(item: SelectableButtonListItem): void {
    if (item.disabled || item.kind === 'static') {
      return;
    }

    if (this.selectionMode === 'multiple') {
      const next = new Set(this.values);
      if (next.has(item.value)) next.delete(item.value);
      else next.add(item.value);
      this.valuesChange.emit([...next]);
      return;
    }

    if (item.value === this.value) return;

    this.valueChange.emit(item.value);
  }

  isStaticItem(item: SelectableButtonListItem): boolean {
    return item.kind === 'static';
  }

  isInteractiveItem(item: SelectableButtonListItem): boolean {
    return !item.disabled && !this.isStaticItem(item);
  }

  isSelected(item: SelectableButtonListItem): boolean {
    return this.selectionMode === 'multiple'
      ? this.values.includes(item.value)
      : item.value === this.value;
  }

  itemTitle(item: SelectableButtonListItem): string {
    return item.title ?? item.value;
  }

  itemSubline(item: SelectableButtonListItem): string | null {
    return item.subline ?? null;
  }

  hasSubline(item: SelectableButtonListItem): boolean {
    return !!(item.sublineKey || item.subline);
  }

  itemAriaLabel(item: SelectableButtonListItem): string | null {
    return item.ariaLabel ?? item.title ?? item.value;
  }

  isSimpleLanguageRow(item: SelectableButtonListItem): boolean {
    return !item.subline &&
      !item.sublineKey &&
      !item.leadingIconName &&
      !item.leadingIconSrc &&
      !item.leadingIconSvg &&
      !item.trailingIconName &&
      !item.trailingIconSrc &&
      !item.trailingIconClass &&
      !item.selectedIconName &&
      !item.selectedIconSrc &&
      !item.selectedIconClass;
  }

  hasLeadingIcon(item: SelectableButtonListItem): boolean {
    return !!(
      item.leadingIconName ||
      item.leadingIconSrc ||
      item.leadingIconSvg ||
      item.leadingIconClass
    );
  }

  hasTrailingIcon(item: SelectableButtonListItem): boolean {
    return !!(
      item.trailingIconName ||
      item.trailingIconSrc ||
      item.trailingIconClass
    );
  }

  hasItemSelectedIcon(item: SelectableButtonListItem): boolean {
    return !!(
      item.selectedIconName ||
      item.selectedIconSrc ||
      item.selectedIconClass
    );
  }

  hasDefaultSelectedIcon(): boolean {
    return !!(
      this.selectedIconName ||
      this.selectedIconSrc ||
      this.selectedIconClass
    );
  }

  isExpandedItem(item: SelectableButtonListItem): boolean {
    return this.isSelected(item) &&
      this.expandedValue === item.value &&
      !!this.expandedContentTemplate;
  }
}
