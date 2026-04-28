import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeDisplayComponent } from '../time-display/time-display.component';
import {
  THEME_ACCENT_BACKGROUND_FALLBACK,
  THEME_ACCENT_BORDER_FALLBACK,
  THEME_ACCENT_SHADOW_FALLBACK,
  resolveThemeAccentColor,
  withThemeAlpha,
} from '../../theme';

export type AgendaSlotType = 'empty' | 'event';
export type AgendaSlotHeightTier =
  | 'empty-sm'
  | 'empty-md'
  | 'event-sm'
  | 'event-md'
  | 'event-lg';

@Component({
  selector: 'sh-agenda-slot',
  standalone: true,
  imports: [CommonModule, TimeDisplayComponent],
  templateUrl: './agenda-slot.component.html',
  styleUrls: ['./agenda-slot.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaSlotComponent {
  @Input({ required: true }) startTime = '00:00';
  @Input({ required: true }) endTime = '00:00';
  @Input({ required: true }) type: AgendaSlotType = 'empty';
  @Input({ required: true }) heightTier: AgendaSlotHeightTier = 'empty-sm';

  @Input() title: string | null = null;
  @Input() hint: string | null = null;
  @Input() accentColor: string | null = null;
  @Input() showTopLabel = true;
  @Input() showBottomLabel = true;
  @Input() isCurrent = false;
  @Input() ariaLabel: string | null = null;
  @Input() interactive = false;

  @Output() slotClick = new EventEmitter<void>();

  get rootClassMap(): Record<string, boolean> {
    return {
      'agenda-slot': true,
      [`agenda-slot--${this.type}`]: true,
      [`agenda-slot--tier-${this.heightTier}`]: true,
      'agenda-slot--current': this.isCurrent,
    };
  }

  get resolvedAccentColor(): string {
    return resolveThemeAccentColor(this.accentColor, THEME_ACCENT_BORDER_FALLBACK);
  }

  get accentBackgroundColor(): string {
    return withThemeAlpha(this.accentColor, 0.14, THEME_ACCENT_BACKGROUND_FALLBACK);
  }

  get accentShadowColor(): string {
    return withThemeAlpha(this.accentColor, 0.22, THEME_ACCENT_SHADOW_FALLBACK);
  }

  onSlotActivate(): void {
    if (!this.interactive) {
      return;
    }

    this.slotClick.emit();
  }
}
