import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  forwardRef,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

/** Number of rows visible in each lane. Must be odd so center row is unambiguous. */
const VISIBLE_ROWS = 5;
/** Pixel height of every item row (also used for scroll math). */
const ITEM_H = 44;
/** Number of empty pad rows above and below items so first/last item can center. */
const PAD = Math.floor(VISIBLE_ROWS / 2);
const TIME_DISPLAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface TimeDisplaySlot {
  kind: "digit" | "separator";
  value: string;
}

@Component({
  selector: "app-time-picker",
  standalone: true,
  imports: [],
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
  host: {
    class: "time-picker-host",
  },
})
export class TimePickerComponent
  implements ControlValueAccessor, AfterViewInit, OnDestroy
{
  @Input() label = "";
  @Input() placeholder = "--:--";
  @Input() locale = "es-MX";
  @Input() disabled = false;
  @Input() cancelText = "Cancelar";
  @Input() doneText = "Listo";
  @Input() dialogAriaLabel = "";
  @Input() hoursAriaLabel = "";
  @Input() minutesAriaLabel = "";

  @Output() valueChange = new EventEmitter<string | null>();

  @ViewChild("hourTrack") private hourTrack!: ElementRef<HTMLElement>;
  @ViewChild("minuteTrack") private minuteTrack!: ElementRef<HTMLElement>;

  isOpen = false;

  /** Pad rows rendered above and below main items to allow first/last item to center. */
  protected readonly pads = Array.from({ length: PAD });
  /** Hour items 00-23 */
  protected readonly hours = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: String(i).padStart(2, "0"),
  }));
  /** Minute items 00-59 */
  protected readonly minutes = Array.from({ length: 60 }, (_, i) => ({
    value: i,
    label: String(i).padStart(2, "0"),
  }));

  /**
   * Visual center index, derived _only_ from scroll position.
   * Never set directly; always comes from indexFromScroll().
   */
  protected centerHour = 0;
  protected centerMinute = 0;

  private _value: string | null = null;
  private snapHourTimer?: ReturnType<typeof setTimeout>;
  private snapMinuteTimer?: ReturnType<typeof setTimeout>;

  onTouched: () => void = () => {};
  onChanged: (value: string | null) => void = () => {};

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    // ViewChildren available, but we only scroll after the overlay is open.
  }

  ngOnDestroy(): void {
    clearTimeout(this.snapHourTimer);
    clearTimeout(this.snapMinuteTimer);
  }

  // ─── ControlValueAccessor ────────────────────────────────────────────────

  get displayValue(): string {
    return this._value ?? this.placeholder;
  }

  get hasValue(): boolean {
    return this.timeDisplayValue !== null;
  }

  get timeDisplaySlots(): TimeDisplaySlot[] {
    const parsed = this.timeDisplayValue;
    if (!parsed) {
      return [
        { kind: "digit", value: "" },
        { kind: "digit", value: "" },
        { kind: "separator", value: ":" },
        { kind: "digit", value: "" },
        { kind: "digit", value: "" },
      ];
    }

    return [
      { kind: "digit", value: parsed[0] },
      { kind: "digit", value: parsed[1] },
      { kind: "separator", value: ":" },
      { kind: "digit", value: parsed[3] },
      { kind: "digit", value: parsed[4] },
    ];
  }

  get resolvedDialogAriaLabel(): string | null {
    const direct = this.normalizeLabel(this.dialogAriaLabel);
    if (direct) {
      return direct;
    }
    return this.normalizeLabel(this.label) ?? this.normalizeLabel(this.placeholder);
  }

  get resolvedHoursAriaLabel(): string | null {
    const direct = this.normalizeLabel(this.hoursAriaLabel);
    if (direct) {
      return direct;
    }
    return this.normalizeLabel(this.label) ?? this.normalizeLabel(this.placeholder);
  }

  get resolvedMinutesAriaLabel(): string | null {
    const direct = this.normalizeLabel(this.minutesAriaLabel);
    if (direct) {
      return direct;
    }
    return this.normalizeLabel(this.label) ?? this.normalizeLabel(this.placeholder);
  }

  writeValue(value: string | null): void {
    this._value = value;
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.onChanged = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // ─── Overlay lifecycle ───────────────────────────────────────────────────

  open(): void {
    if (this.disabled) return;
    const { h, m } = this.resolveInitialTime();
    // Pre-set center state so change detection sees correct values immediately.
    this.centerHour = h;
    this.centerMinute = m;
    this.isOpen = true;
    this.cdr.markForCheck();
    this.onTouched();

    // Wait two frames: first frame applies overlay CSS; second frame guarantees
    // the scroll containers have real pixel height from layout.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.scrollInstant(this.hourTrack?.nativeElement, h);
        this.scrollInstant(this.minuteTrack?.nativeElement, m);
        // After instant scroll the scroll event fires synchronously in some
        // engines; recompute center to keep state consistent.
        this.syncCenterFromScroll();
        this.cdr.markForCheck();
      });
    });
  }

  cancel(): void {
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  confirm(): void {
    const h = String(this.centerHour).padStart(2, "0");
    const m = String(this.centerMinute).padStart(2, "0");
    this._value = `${h}:${m}`;
    this.onChanged(this._value);
    this.valueChange.emit(this._value);
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains("tp-overlay")) {
      this.cancel();
    }
  }

  // ─── Scroll handlers ─────────────────────────────────────────────────────

  onHourScroll(): void {
    const idx = this.indexFromScroll(this.hourTrack.nativeElement);
    if (idx !== this.centerHour) {
      this.centerHour = idx;
      this.cdr.markForCheck();
    }
    clearTimeout(this.snapHourTimer);
    this.snapHourTimer = setTimeout(() => {
      const settled = this.indexFromScroll(this.hourTrack.nativeElement);
      this.centerHour = settled;
      this.scrollSnap(this.hourTrack.nativeElement, settled);
      this.cdr.markForCheck();
    }, 120);
  }

  onMinuteScroll(): void {
    const idx = this.indexFromScroll(this.minuteTrack.nativeElement);
    if (idx !== this.centerMinute) {
      this.centerMinute = idx;
      this.cdr.markForCheck();
    }
    clearTimeout(this.snapMinuteTimer);
    this.snapMinuteTimer = setTimeout(() => {
      const settled = this.indexFromScroll(this.minuteTrack.nativeElement);
      this.centerMinute = settled;
      this.scrollSnap(this.minuteTrack.nativeElement, settled);
      this.cdr.markForCheck();
    }, 120);
  }

  onHourKey(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" && this.centerHour < 23) {
      event.preventDefault();
      this.scrollInstant(this.hourTrack.nativeElement, this.centerHour + 1);
    } else if (event.key === "ArrowUp" && this.centerHour > 0) {
      event.preventDefault();
      this.scrollInstant(this.hourTrack.nativeElement, this.centerHour - 1);
    }
  }

  onMinuteKey(event: KeyboardEvent): void {
    if (event.key === "ArrowDown" && this.centerMinute < 59) {
      event.preventDefault();
      this.scrollInstant(this.minuteTrack.nativeElement, this.centerMinute + 1);
    } else if (event.key === "ArrowUp" && this.centerMinute > 0) {
      event.preventDefault();
      this.scrollInstant(this.minuteTrack.nativeElement, this.centerMinute - 1);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Convert scroll position to the item index closest to visual center.
   * Formula: scrollTop = idx × ITEM_H  (with 2-pad offest baked into layout)
   */
  private indexFromScroll(el: HTMLElement): number {
    const raw = Math.round(el.scrollTop / ITEM_H);
    const max =
      el === this.minuteTrack?.nativeElement
        ? this.minutes.length - 1
        : this.hours.length - 1;
    return Math.max(0, Math.min(max, raw));
  }

  private scrollInstant(el: HTMLElement | undefined, idx: number): void {
    el?.scrollTo({ top: idx * ITEM_H, behavior: "auto" });
  }

  private scrollSnap(el: HTMLElement, idx: number): void {
    el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
  }

  private syncCenterFromScroll(): void {
    if (this.hourTrack?.nativeElement) {
      this.centerHour = this.indexFromScroll(this.hourTrack.nativeElement);
    }
    if (this.minuteTrack?.nativeElement) {
      this.centerMinute = this.indexFromScroll(this.minuteTrack.nativeElement);
    }
  }

  private resolveInitialTime(): { h: number; m: number } {
    const normalizedValue = this.timeDisplayValue;
    if (normalizedValue) {
      const [hours, minutes] = normalizedValue.split(":");
      return { h: parseInt(hours, 10), m: parseInt(minutes, 10) };
    }
    const now = new Date();
    return { h: now.getHours(), m: now.getMinutes() };
  }

  private get timeDisplayValue(): string | null {
    const trimmed = this._value?.trim() ?? null;
    if (!trimmed) {
      return null;
    }

    const match = trimmed.match(TIME_DISPLAY_PATTERN);
    if (!match) {
      return null;
    }

    return `${match[1]}:${match[2]}`;
  }

  private normalizeLabel(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? null;
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }
}
