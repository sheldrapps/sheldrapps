import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  forwardRef,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { IonButton, IonDatetime, IonModal } from "@ionic/angular/standalone";

@Component({
  selector: "app-time-picker",
  standalone: true,
  imports: [CommonModule, IonModal, IonDatetime, IonButton],
  templateUrl: "./time-picker.component.html",
  styleUrl: "./time-picker.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
})
export class TimePickerComponent implements ControlValueAccessor {
  @Input() label = "";
  @Input() placeholder = "--:--";
  @Input() locale = "es-MX";
  @Input() disabled = false;
  @Input() cancelText = "Cancelar";
  @Input() doneText = "Listo";

  @Output() valueChange = new EventEmitter<string | null>();

  readonly sheetBreakpoints = [0, 0.44];
  readonly sheetInitialBreakpoint = 0.44;
  isOpen = false;

  private _value: string | null = null;
  draftValue: string | null = null;

  onTouched: () => void = () => {};
  onChanged: (value: string | null) => void = () => {};

  get value(): string | null {
    return this._value;
  }

  get displayValue(): string {
    return this._value || this.placeholder;
  }

  writeValue(value: string | null): void {
    this._value = value;
    this.draftValue = value;
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChanged = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  open(): void {
    if (this.disabled) return;
    this.draftValue = this.resolveDraftValue(this._value);
    this.isOpen = true;
    this.onTouched();
  }

  cancel(): void {
    this.draftValue = this._value;
    this.isOpen = false;
  }

  confirm(): void {
    this._value = this.resolveDraftValue(this.draftValue ?? this._value);
    this.onChanged(this._value);
    this.valueChange.emit(this._value);
    this.isOpen = false;
  }

  onModalDismiss(): void {
    this.isOpen = false;
  }

  onDatetimeChange(event: CustomEvent): void {
    const raw = event.detail.value;
    const normalized = this.normalizeTimeValue(raw);
    if (normalized) {
      this.draftValue = normalized;
    }
  }

  private normalizeTimeValue(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;

    // ion-datetime suele devolver ISO o HH:mm dependiendo del contexto.
    const hhmmMatch = value.match(/(\d{2}):(\d{2})/);
    if (!hhmmMatch) return null;

    const hours = hhmmMatch[1];
    const minutes = hhmmMatch[2];
    return `${hours}:${minutes}`;
  }

  private resolveDraftValue(value: unknown): string {
    return this.normalizeTimeValue(value) ?? this.getDefaultTime();
  }

  private getDefaultTime(): string {
    const now = new Date();
    const hours = `${now.getHours()}`.padStart(2, "0");
    const minutes = `${now.getMinutes()}`.padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}
