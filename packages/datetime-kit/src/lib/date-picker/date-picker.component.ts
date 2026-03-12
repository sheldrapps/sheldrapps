import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonButton, IonDatetime, IonModal } from '@ionic/angular/standalone';

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule, IonButton, IonDatetime, IonModal],
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '--';
  @Input() locale: string | null = null;
  @Input() disabled = false;
  @Input() cancelText = 'Cancel';
  @Input() doneText = 'Done';
  @Input() ariaLabel: string | null = null;
  @Input() min: string | null = null;
  @Input() max: string | null = null;

  @Input()
  set value(nextValue: string | null | undefined) {
    this.internalValue = this.normalizeValue(nextValue);
    this.draftValue = this.internalValue;
  }

  get value(): string {
    return this.internalValue;
  }

  @Output() readonly change = new EventEmitter<string>();
  @Output() readonly valueChange = new EventEmitter<string>();

  readonly sheetBreakpoints = [0, 0.56];
  readonly sheetInitialBreakpoint = 0.56;
  isOpen = false;

  draftValue = '';
  isDisabled = false;

  private internalValue = '';
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  get displayValue(): string {
    if (this.internalValue.length === 0) {
      return this.placeholder;
    }

    const parsed = this.parseDate(this.internalValue);
    if (!parsed) {
      return this.internalValue;
    }

    try {
      return new Intl.DateTimeFormat(this.resolveLocale(), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(parsed);
    } catch {
      return this.internalValue;
    }
  }

  get isPlaceholderVisible(): boolean {
    return this.internalValue.length === 0;
  }

  get datetimeValue(): string {
    return this.resolveDraftValue(this.draftValue || this.internalValue);
  }

  writeValue(value: string | null): void {
    this.internalValue = this.normalizeValue(value);
    this.draftValue = this.internalValue;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.disabled = isDisabled;
  }

  open(): void {
    if (this.isDisabled || this.disabled) {
      return;
    }

    this.draftValue = this.resolveDraftValue(this.internalValue);
    this.isOpen = true;
    this.onTouched();
  }

  cancel(): void {
    this.draftValue = this.internalValue;
    this.isOpen = false;
  }

  confirm(): void {
    const normalized = this.resolveDraftValue(this.draftValue || this.internalValue);
    this.internalValue = normalized;
    this.draftValue = normalized;
    this.onChange(normalized);
    this.change.emit(normalized);
    this.valueChange.emit(normalized);
    this.onTouched();
    this.isOpen = false;
  }

  onModalDismiss(): void {
    this.isOpen = false;
  }

  onDatetimeChange(event: CustomEvent<{ value?: string | string[] | null }>): void {
    const normalized = this.resolveDatetimeValue(event.detail.value);
    if (normalized.length === 0) {
      return;
    }

    this.draftValue = normalized;
  }

  private normalizeValue(value: string | null | undefined): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  private resolveDatetimeValue(value: string | string[] | null | undefined): string {
    if (Array.isArray(value)) {
      const first = value.find((candidate) => typeof candidate === 'string') ?? '';
      return first.trim();
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    return '';
  }

  private resolveDraftValue(value: string | null | undefined): string {
    const normalized = this.normalizeValue(value);
    if (normalized.length > 0) {
      return normalized;
    }

    return new Date().toISOString();
  }

  private parseDate(value: string): Date | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const localDate = new Date(`${trimmed}T12:00:00`);
      if (!Number.isNaN(localDate.getTime())) {
        return localDate;
      }
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private resolveLocale(): string {
    if (this.locale && this.locale.trim().length > 0) {
      return this.locale.trim();
    }

    try {
      const browserLocale = Intl.DateTimeFormat().resolvedOptions().locale;
      if (browserLocale) {
        return browserLocale;
      }
    } catch {
      // Uses fallback locale.
    }

    return 'en-US';
  }
}
