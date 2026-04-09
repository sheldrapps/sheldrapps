import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TimeDisplayComponent } from '@sheldrapps/ui-theme';
import { TodayPriorityBadgeComponent } from './today-priority-badge.component';

type PriorityCode = 'S' | 'A' | 'B' | 'C';
type SizeTier = 'sm' | 'md' | 'lg';

@Component({
  standalone: true,
  selector: 'app-today-standard-card',
  templateUrl: './today-standard-card.component.html',
  styleUrls: ['./today-standard-card.component.scss'],
  imports: [TimeDisplayComponent, TodayPriorityBadgeComponent],
})
export class TodayStandardCardComponent {
  @Input({ required: true }) title = '';
  @Input() durationLabel = '';
  @Input() timeLabel: string | null = null;
  @Input() color: string | null = null;
  @Input() priorityCode: PriorityCode | null = null;
  @Input() priorityLabel = '';
  @Input() sizeTier: SizeTier = 'md';
  @Input() completed = false;
  @Input() interactive = false;
  @Input() expanded = false;

  @Output() cardClick = new EventEmitter<void>();

  get borderColor(): string {
    if (!this.isHexColor(this.color)) {
      return 'rgba(var(--ion-color-step-350-rgb), 0.92)';
    }

    return this.completed ? this.withAlpha(this.color, 0.42) : this.color;
  }

  get backgroundColor(): string {
    if (!this.isHexColor(this.color)) {
      return 'rgba(var(--ion-color-step-50-rgb), 0.96)';
    }

    return this.completed ? this.withAlpha(this.color, 0.04) : this.withAlpha(this.color, 0.09);
  }

  get shadowColor(): string {
    if (!this.isHexColor(this.color)) {
      return 'rgba(var(--ion-color-step-250-rgb), 0.42)';
    }

    return this.completed ? this.withAlpha(this.color, 0.05) : this.withAlpha(this.color, 0.12);
  }

  private withAlpha(hexColor: string, alpha: number): string {
    const normalized = hexColor.trim();
    const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
    if (hex.length !== 6) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private isHexColor(value: string | null): value is string {
    if (!value) {
      return false;
    }

    return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
  }
}
