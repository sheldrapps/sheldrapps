import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeDisplayComponent } from '../time-display/time-display.component';

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
    return this.accentColor?.trim() || '#64748B';
  }

  get accentBackgroundColor(): string {
    return this.withAlpha(this.resolvedAccentColor, 0.14);
  }

  get accentShadowColor(): string {
    return this.withAlpha(this.resolvedAccentColor, 0.22);
  }

  onSlotActivate(): void {
    if (!this.interactive) {
      return;
    }

    this.slotClick.emit();
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
    if ([red, green, blue].some((value) => Number.isNaN(value))) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
