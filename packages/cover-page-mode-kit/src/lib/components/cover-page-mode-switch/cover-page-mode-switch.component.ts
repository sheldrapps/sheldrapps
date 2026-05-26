import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { IonToggle } from '@ionic/angular/standalone';
import { CoverPageMode } from '../../models/cover-page-mode.types';

@Component({
  selector: 'app-cover-page-mode-switch',
  standalone: true,
  imports: [CommonModule, IonToggle],
  templateUrl: './cover-page-mode-switch.component.html',
  styleUrls: ['./cover-page-mode-switch.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverPageModeSwitchComponent {
  @Input({ required: true }) leftLabel = '';
  @Input({ required: true }) rightLabel = '';
  @Input() title?: string;
  @Input() ariaLabel?: string;
  @Input() disabled = false;
  @Input() disableLeftSelection = false;
  @Input() disableRightSelection = false;
  @Input() value: CoverPageMode = 'replace';
  @Input() leftValue: CoverPageMode = 'replace';
  @Input() rightValue: CoverPageMode = 'insert';

  @Output() valueChange = new EventEmitter<CoverPageMode>();
  @Output() blockedSelection = new EventEmitter<CoverPageMode>();

  isSelected(mode: CoverPageMode): boolean {
    return this.value === mode;
  }

  get checked(): boolean {
    return this.value === this.rightValue;
  }

  onToggleChange(event: CustomEvent<{ checked: boolean }>): void {
    const nextMode = event.detail?.checked ? this.rightValue : this.leftValue;
    this.onSelect(nextMode);
  }

  onSelect(mode: CoverPageMode): void {
    if (this.disabled || this.value === mode) return;
    if (this.isBlocked(mode)) {
      this.blockedSelection.emit(mode);
      return;
    }
    this.valueChange.emit(mode);
  }

  isLeftBlocked(): boolean {
    return this.disabled || this.disableLeftSelection;
  }

  isRightBlocked(): boolean {
    return this.disabled || this.disableRightSelection;
  }

  private isBlocked(mode: CoverPageMode): boolean {
    if (mode === this.leftValue) return this.disableLeftSelection;
    if (mode === this.rightValue) return this.disableRightSelection;
    return false;
  }
}
