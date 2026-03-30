import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type TimeDisplaySize = 'sm' | 'md' | 'lg';
type TimeDisplayTone = 'default' | 'muted' | 'accent';
type TimeDisplayAlign = 'left' | 'center' | 'right';

interface TimeDisplaySlot {
  kind: 'digit' | 'separator';
  value: string;
}

@Component({
  selector: 'sh-time-display, app-time-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-display.component.html',
  styleUrls: ['./time-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-label]': 'screenReaderLabel',
    'role': 'text',
  },
})
export class TimeDisplayComponent {
  private static readonly TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

  @Input() value: string | null = null;

  @Input() size: TimeDisplaySize = 'md';

  @Input() tone: TimeDisplayTone = 'default';

  @Input() align: TimeDisplayAlign = 'left';

  get slots(): TimeDisplaySlot[] {
    const parsed = this.parseTime(this.value);
    if (!parsed) {
      return [
        { kind: 'digit', value: '' },
        { kind: 'digit', value: '' },
        { kind: 'separator', value: ':' },
        { kind: 'digit', value: '' },
        { kind: 'digit', value: '' },
      ];
    }

    return [
      { kind: 'digit', value: parsed[0] },
      { kind: 'digit', value: parsed[1] },
      { kind: 'separator', value: ':' },
      { kind: 'digit', value: parsed[3] },
      { kind: 'digit', value: parsed[4] },
    ];
  }

  get screenReaderLabel(): string | null {
    return this.parseTime(this.value);
  }

  get rootClassMap(): Record<string, boolean> {
    return {
      'app-time-display': true,
      [`app-time-display--${this.size}`]: true,
      [`app-time-display--${this.tone}`]: true,
      [`app-time-display--${this.align}`]: true,
    };
  }

  private parseTime(value: string | null): string | null {
    const trimmed = value?.trim() ?? null;
    if (!trimmed) {
      return null;
    }

    const match = trimmed.match(TimeDisplayComponent.TIME_PATTERN);
    if (!match) {
      return null;
    }

    const hours = match[1];
    const minutes = match[2];
    return `${hours}:${minutes}`;
  }
}
