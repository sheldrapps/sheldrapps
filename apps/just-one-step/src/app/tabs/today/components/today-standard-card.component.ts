import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  THEME_ACCENT_BACKGROUND_FALLBACK,
  THEME_ACCENT_BORDER_FALLBACK,
  THEME_ACCENT_SHADOW_FALLBACK,
  TimeDisplayComponent,
  withThemeAlpha,
} from '@sheldrapps/ui-theme';
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
      return THEME_ACCENT_BORDER_FALLBACK;
    }

    return this.completed ? this.withAlpha(this.color, 0.42) : this.color;
  }

  get backgroundColor(): string {
    if (!this.isHexColor(this.color)) {
      return THEME_ACCENT_BACKGROUND_FALLBACK;
    }

    return this.completed ? this.withAlpha(this.color, 0.04) : this.withAlpha(this.color, 0.09);
  }

  get shadowColor(): string {
    if (!this.isHexColor(this.color)) {
      return THEME_ACCENT_SHADOW_FALLBACK;
    }

    return this.completed ? this.withAlpha(this.color, 0.05) : this.withAlpha(this.color, 0.12);
  }

  private withAlpha(hexColor: string, alpha: number): string {
    return withThemeAlpha(hexColor, alpha, THEME_ACCENT_BACKGROUND_FALLBACK);
  }

  private isHexColor(value: string | null): value is string {
    if (!value) {
      return false;
    }

    return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
  }
}
