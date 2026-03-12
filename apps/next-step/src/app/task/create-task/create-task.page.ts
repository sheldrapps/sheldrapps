import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  DatePickerComponent,
  TimePickerComponent,
} from '@sheldrapps/datetime-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { startWith } from 'rxjs';
import {
  CategoryRepository,
  TaskCategory,
} from '../../database/repositories/category.repository';
import {
  CreateTaskInput,
  CreateTaskRecurrenceInput,
  NotificationTriggerMode,
  NotificationType,
  TaskMode,
  TaskRepository,
} from '../../database/repositories/task.repository';
import { NextStepSettings } from '../../settings/next-step-settings.schema';

type RecurrencePattern = 'daily' | 'selected_weekdays' | 'monthly' | 'yearly';
type WeekdayTimeControlName =
  | 'recurrenceDayTimeMon'
  | 'recurrenceDayTimeTue'
  | 'recurrenceDayTimeWed'
  | 'recurrenceDayTimeThu'
  | 'recurrenceDayTimeFri'
  | 'recurrenceDayTimeSat'
  | 'recurrenceDayTimeSun';

interface WeekdayOption {
  bit: number;
  dayOfWeek: number;
  labelKey: string;
  shortLabelKey: string;
  timeControlName: WeekdayTimeControlName;
}

interface NotificationLeadTimePreset {
  value: number;
  labelKey: string;
}

@Component({
  standalone: true,
  selector: 'app-create-task',
  templateUrl: './create-task.page.html',
  styleUrls: ['./create-task.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
    IonNote,
    DatePickerComponent,
    TimePickerComponent,
  ],
})
export class CreateTaskPage {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly taskRepository = inject(TaskRepository);
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly alertController = inject(AlertController);
  private readonly translate = inject(TranslateService);
  private readonly settings = inject(SettingsStore<NextStepSettings>);
  private readonly notificationOffsetsPreferenceKey =
    'create_task.notification_offsets';
  private readonly legacyNotificationLeadTimePreferenceKey =
    'create_task.notification_minutes_before';

  @ViewChild('descriptionInput', { read: IonTextarea })
  private descriptionInput?: IonTextarea;

  readonly createCategoryOptionValue = '__create_category__';
  readonly monthNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
  readonly weekdays: readonly WeekdayOption[] = [
    {
      bit: 1,
      dayOfWeek: 1,
      labelKey: 'CREATE_TASK.WEEKDAY_MON',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_MON',
      timeControlName: 'recurrenceDayTimeMon',
    },
    {
      bit: 2,
      dayOfWeek: 2,
      labelKey: 'CREATE_TASK.WEEKDAY_TUE',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_TUE',
      timeControlName: 'recurrenceDayTimeTue',
    },
    {
      bit: 4,
      dayOfWeek: 3,
      labelKey: 'CREATE_TASK.WEEKDAY_WED',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_WED',
      timeControlName: 'recurrenceDayTimeWed',
    },
    {
      bit: 8,
      dayOfWeek: 4,
      labelKey: 'CREATE_TASK.WEEKDAY_THU',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_THU',
      timeControlName: 'recurrenceDayTimeThu',
    },
    {
      bit: 16,
      dayOfWeek: 5,
      labelKey: 'CREATE_TASK.WEEKDAY_FRI',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_FRI',
      timeControlName: 'recurrenceDayTimeFri',
    },
    {
      bit: 32,
      dayOfWeek: 6,
      labelKey: 'CREATE_TASK.WEEKDAY_SAT',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_SAT',
      timeControlName: 'recurrenceDayTimeSat',
    },
    {
      bit: 64,
      dayOfWeek: 7,
      labelKey: 'CREATE_TASK.WEEKDAY_SUN',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_SUN',
      timeControlName: 'recurrenceDayTimeSun',
    },
  ] as const;
  readonly notificationLeadTimeDefaultPresets: readonly NotificationLeadTimePreset[] = [
    {
      value: 5,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_5M',
    },
    {
      value: 10,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_10M',
    },
    {
      value: 15,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_15M',
    },
    {
      value: 30,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_30M',
    },
    {
      value: 60,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1H',
    },
  ] as const;
  readonly notificationLeadTimeMonthlyPresets: readonly NotificationLeadTimePreset[] =
    [
      {
        value: 30,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_30M',
      },
      {
        value: 60,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1H',
      },
      {
        value: 720,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_12H',
      },
      {
        value: 1440,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1D',
      },
      {
        value: 4320,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_3D',
      },
      {
        value: 10080,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1W',
      },
    ] as const;
  readonly notificationLeadTimeYearlyPresets: readonly NotificationLeadTimePreset[] =
    [
      {
        value: 1440,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1D',
      },
      {
        value: 4320,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_3D',
      },
      {
        value: 10080,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1W',
      },
      {
        value: 20160,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_2W',
      },
      {
        value: 43200,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1MO',
      },
    ] as const;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    mode: this.fb.nonNullable.control<TaskMode>('check'),
    estimatedDurationMin: this.fb.control<number | null>(null),
    categoryId: this.fb.control<string | null>(null),
    recurrenceEnabled: this.fb.nonNullable.control(false),
    recurrencePattern:
      this.fb.nonNullable.control<RecurrencePattern>('daily'),
    recurrenceHasTime: this.fb.nonNullable.control(false),
    recurrenceSameTimeForSelectedDays: this.fb.nonNullable.control(true),
    recurrenceTime: this.fb.nonNullable.control(''),
    recurrenceStartsToday: this.fb.nonNullable.control(true),
    recurrenceStartDate: this.fb.nonNullable.control(
      this.addDays(new Date(), 1).toISOString()
    ),
    recurrenceHasEndDate: this.fb.nonNullable.control(false),
    recurrenceEndDate: this.fb.control<string | null>(null),
    recurrenceDayOfMonth: this.fb.control<number | null>(null),
    recurrenceYearMonth: this.fb.control<number | null>(null),
    recurrenceYearDay: this.fb.control<number | null>(null),
    recurrenceDayTimeMon: this.fb.nonNullable.control(''),
    recurrenceDayTimeTue: this.fb.nonNullable.control(''),
    recurrenceDayTimeWed: this.fb.nonNullable.control(''),
    recurrenceDayTimeThu: this.fb.nonNullable.control(''),
    recurrenceDayTimeFri: this.fb.nonNullable.control(''),
    recurrenceDayTimeSat: this.fb.nonNullable.control(''),
    recurrenceDayTimeSun: this.fb.nonNullable.control(''),
    notificationsEnabled: this.fb.nonNullable.control(false),
    notificationType: this.fb.nonNullable.control<NotificationType>('sound'),
    notificationTriggerMode:
      this.fb.nonNullable.control<NotificationTriggerMode>('at_time'),
    notificationOffsets: this.fb.nonNullable.control<number[]>([]),
  });

  categories: TaskCategory[] = [];
  selectedWeekdayMask = 0;
  titleTouched = false;
  descriptionTouched = false;
  submitAttempted = false;
  isSaving = false;
  saveFailed = false;
  private lastSelectedCategoryId: string | null = null;
  private isSettingsLoaded = false;
  private lastNotificationOffsets: number[] = [];

  constructor() {
    this.registerDynamicValidation();
    void this.loadCategories();
    void this.loadLastNotificationLeadTimePreference();
  }

  get titleRequiredError(): boolean {
    return (
      this.form.controls.title.hasError('required') &&
      (this.titleTouched || this.submitAttempted)
    );
  }

  get titleMaxError(): boolean {
    return (
      this.form.controls.title.hasError('maxlength') &&
      (this.titleTouched || this.submitAttempted)
    );
  }

  get isDurationTrackingEnabled(): boolean {
    return this.form.controls.mode.value === 'duration';
  }

  get recurrenceEnabled(): boolean {
    return this.form.controls.recurrenceEnabled.value;
  }

  get recurrencePattern(): RecurrencePattern {
    return this.form.controls.recurrencePattern.value;
  }

  get recurrenceHasTime(): boolean {
    return this.form.controls.recurrenceHasTime.value;
  }

  get recurrenceSameTimeForSelectedDays(): boolean {
    return this.form.controls.recurrenceSameTimeForSelectedDays.value;
  }

  get recurrenceStartsToday(): boolean {
    return this.form.controls.recurrenceStartsToday.value;
  }

  get notificationsEnabled(): boolean {
    return this.form.controls.notificationsEnabled.value;
  }

  get notificationTriggerMode(): NotificationTriggerMode {
    return this.form.controls.notificationTriggerMode.value;
  }

  get notificationLeadTimePresets(): readonly NotificationLeadTimePreset[] {
    const activePattern: RecurrencePattern = this.recurrenceEnabled
      ? this.recurrencePattern
      : 'daily';
    return this.getAllowedReminderOffsets(activePattern);
  }

  get activeLocale(): string {
    const currentLang = this.translate.currentLang?.trim();
    if (currentLang) {
      return currentLang;
    }

    const fallbackLang = this.translate.getDefaultLang()?.trim();
    if (fallbackLang) {
      return fallbackLang;
    }

    return 'en-US';
  }

  get selectedWeekdays(): WeekdayOption[] {
    return this.weekdays.filter((day) => this.isWeekdaySelected(day.bit));
  }

  get showSelectedWeekdayError(): boolean {
    return (
      this.submitAttempted &&
      this.recurrenceEnabled &&
      this.recurrencePattern === 'selected_weekdays' &&
      this.selectedWeekdayMask === 0
    );
  }

  get showCommonRecurrenceTimeError(): boolean {
    if (
      !this.recurrenceEnabled ||
      !this.recurrenceHasTime ||
      (this.recurrencePattern === 'selected_weekdays' &&
        !this.recurrenceSameTimeForSelectedDays)
    ) {
      return false;
    }

    return this.hasControlError(this.form.controls.recurrenceTime, 'required');
  }

  get saveDisabled(): boolean {
    return this.isSaving || this.form.invalid || this.showSelectedWeekdayError;
  }

  onTitleEnter(event: Event): void {
    event.preventDefault();
    void this.descriptionInput?.setFocus();
  }

  onTitleBlur(): void {
    this.titleTouched = true;
  }

  onDescriptionBlur(): void {
    this.descriptionTouched = true;
  }

  onDurationTrackingToggle(enabled: boolean): void {
    this.form.controls.mode.setValue(enabled ? 'duration' : 'check');
  }

  onCategoryChange(event: CustomEvent<{ value: string | null }>): void {
    const selectedValue = (event.detail.value ?? null) as string | null;
    if (selectedValue !== this.createCategoryOptionValue) {
      this.lastSelectedCategoryId = selectedValue;
      return;
    }

    this.form.controls.categoryId.setValue(this.lastSelectedCategoryId, {
      emitEvent: false,
    });
    void this.openCreateCategoryAlert();
  }

  isNotificationLeadTimeSelected(value: number): boolean {
    return this.form.controls.notificationOffsets.value.includes(value);
  }

  onNotificationLeadTimeSelect(value: number): void {
    const control = this.form.controls.notificationOffsets;
    const currentOffsets = control.value;
    const nextOffsets = currentOffsets.includes(value)
      ? currentOffsets.filter((offset) => offset !== value)
      : [...currentOffsets, value];
    control.setValue(this.sortOffsets(nextOffsets));
    control.markAsTouched();
    void this.persistNotificationOffsetsPreference(control.value);
  }

  isWeekdaySelected(bit: number): boolean {
    return (this.selectedWeekdayMask & bit) !== 0;
  }

  onWeekdayToggle(bit: number): void {
    if (this.isWeekdaySelected(bit)) {
      this.selectedWeekdayMask &= ~bit;
      this.clearWeekdayTime(bit);
    } else {
      this.selectedWeekdayMask |= bit;
    }

    this.applyRecurrenceStateRules();
  }

  showWeekdayTimeRequiredError(controlName: WeekdayTimeControlName): boolean {
    return this.hasControlError(this.form.controls[controlName], 'required');
  }

  async submit(): Promise<void> {
    this.submitAttempted = true;
    this.titleTouched = true;
    this.saveFailed = false;
    this.normalizeTimeControlsBeforeSubmit();

    if (this.form.invalid || this.showSelectedWeekdayError) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    try {
      await this.persistNotificationLeadTimeFromCurrentForm();
      await this.taskRepository.createTask(
        this.sanitizeCreateTaskPayload(this.buildCreateTaskInput())
      );
      await this.router.navigate(['/tabs/tasks']);
    } catch {
      this.saveFailed = true;
    } finally {
      this.isSaving = false;
    }
  }

  hasControlError(
    control: AbstractControl<unknown, unknown>,
    errorName: string
  ): boolean {
    return (
      control.hasError(errorName) && (control.touched || this.submitAttempted)
    );
  }

  private async loadCategories(): Promise<void> {
    try {
      const defaultNames = this.resolveDefaultCategoryNames();
      this.categories =
        await this.categoryRepository.ensureDefaultCategories(defaultNames);
    } catch {
      this.categories = [];
    }
  }

  private resolveDefaultCategoryNames(): string[] {
    const keys = [
      'CREATE_TASK.DEFAULT_CATEGORY_PERSONAL',
      'CREATE_TASK.DEFAULT_CATEGORY_WORK',
      'CREATE_TASK.DEFAULT_CATEGORY_HEALTH',
      'CREATE_TASK.DEFAULT_CATEGORY_STUDY',
      'CREATE_TASK.DEFAULT_CATEGORY_HOME',
    ] as const;

    return keys
      .map((key) => this.translate.instant(key))
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private registerDynamicValidation(): void {
    this.form.controls.mode.valueChanges
      .pipe(
        startWith(this.form.controls.mode.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((mode) => {
        this.applyModeValidation(mode);
      });

    this.form.controls.recurrenceEnabled.valueChanges
      .pipe(
        startWith(this.form.controls.recurrenceEnabled.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyRecurrenceStateRules();
        this.applyNotificationStateRules();
      });

    this.form.controls.recurrencePattern.valueChanges
      .pipe(
        startWith(this.form.controls.recurrencePattern.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyRecurrenceStateRules();
        this.applyNotificationStateRules();
      });

    this.form.controls.recurrenceHasTime.valueChanges
      .pipe(
        startWith(this.form.controls.recurrenceHasTime.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyRecurrenceStateRules();
      });

    this.form.controls.recurrenceSameTimeForSelectedDays.valueChanges
      .pipe(
        startWith(this.form.controls.recurrenceSameTimeForSelectedDays.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyRecurrenceStateRules();
      });

    this.form.controls.recurrenceStartsToday.valueChanges
      .pipe(
        startWith(this.form.controls.recurrenceStartsToday.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyRecurrenceStateRules();
      });

    this.form.controls.recurrenceHasEndDate.valueChanges
      .pipe(
        startWith(this.form.controls.recurrenceHasEndDate.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyRecurrenceStateRules();
      });

    this.form.controls.notificationsEnabled.valueChanges
      .pipe(
        startWith(this.form.controls.notificationsEnabled.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyNotificationStateRules();
      });

    this.form.controls.notificationTriggerMode.valueChanges
      .pipe(
        startWith(this.form.controls.notificationTriggerMode.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyNotificationStateRules();
      });
  }

  private applyModeValidation(mode: TaskMode): void {
    const estimatedDurationMin = this.form.controls.estimatedDurationMin;

    if (mode === 'duration') {
      estimatedDurationMin.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(1440),
      ]);
    } else {
      estimatedDurationMin.clearValidators();
      estimatedDurationMin.setValue(null, { emitEvent: false });
    }

    estimatedDurationMin.updateValueAndValidity({ emitEvent: false });
  }

  private applyRecurrenceStateRules(): void {
    const controls = this.form.controls;
    const recurrenceSubtreeControls: AbstractControl[] = [
      controls.recurrencePattern,
      controls.recurrenceHasTime,
      controls.recurrenceSameTimeForSelectedDays,
      controls.recurrenceTime,
      controls.recurrenceStartsToday,
      controls.recurrenceStartDate,
      controls.recurrenceHasEndDate,
      controls.recurrenceEndDate,
      controls.recurrenceDayOfMonth,
      controls.recurrenceYearMonth,
      controls.recurrenceYearDay,
      ...this.weekdays.map((day) => controls[day.timeControlName]),
    ];

    if (!controls.recurrenceEnabled.value) {
      this.resetRecurrenceBranchToDefaults();
      this.clearAllRecurrenceValidators();
      for (const control of recurrenceSubtreeControls) {
        this.setControlEnabled(control, false);
      }
      this.updateRecurrenceControlValidity();
      return;
    }

    this.setControlEnabled(controls.recurrencePattern, true);
    this.setControlEnabled(controls.recurrenceHasTime, true);
    this.setControlEnabled(controls.recurrenceStartsToday, true);
    this.setControlEnabled(controls.recurrenceHasEndDate, true);

    this.applyRecurrencePatternRules(controls.recurrencePattern.value);
    this.applyRecurrenceTimeRules();
    this.applyRecurrencePatternValidationRules();

    if (controls.recurrenceStartsToday.value) {
      this.setControlEnabled(controls.recurrenceStartDate, false);
    } else {
      this.setControlEnabled(controls.recurrenceStartDate, true);
      const trimmedStartDate = controls.recurrenceStartDate.value.trim();
      if (trimmedStartDate.length === 0) {
        controls.recurrenceStartDate.setValue(
          this.addDays(new Date(), 1).toISOString(),
          { emitEvent: false }
        );
        this.markControlsAsAutoReset(controls.recurrenceStartDate);
      }
    }

    if (controls.recurrenceHasEndDate.value) {
      this.setControlEnabled(controls.recurrenceEndDate, true);
      const endDateValue = controls.recurrenceEndDate.value?.trim() ?? '';
      if (endDateValue.length === 0) {
        controls.recurrenceEndDate.setValue(
          this.resolveDefaultRecurrenceEndDate(
            controls.recurrenceStartsToday.value,
            controls.recurrenceStartDate.value
          ),
          { emitEvent: false }
        );
        this.markControlsAsAutoReset(controls.recurrenceEndDate);
      }
    } else {
      if (controls.recurrenceEndDate.value !== null) {
        controls.recurrenceEndDate.setValue(null, { emitEvent: false });
        this.markControlsAsAutoReset(controls.recurrenceEndDate);
      }
      this.setControlEnabled(controls.recurrenceEndDate, false);
    }

    this.updateRecurrenceControlValidity();
  }

  private applyNotificationStateRules(): void {
    const controls = this.form.controls;
    const notificationOffsets = controls.notificationOffsets;
    notificationOffsets.clearValidators();

    if (!controls.notificationsEnabled.value) {
      controls.notificationType.setValue('sound', { emitEvent: false });
      controls.notificationTriggerMode.setValue('at_time', { emitEvent: false });
      notificationOffsets.setValue([], { emitEvent: false });
      this.markControlsAsAutoReset(
        controls.notificationType,
        controls.notificationTriggerMode,
        notificationOffsets
      );
      this.applyNotificationBranchEnabledState(false);
      notificationOffsets.updateValueAndValidity({ emitEvent: false });
      return;
    }

    this.applyNotificationBranchEnabledState(true);

    if (controls.notificationType.value === 'none') {
      controls.notificationType.setValue('sound', { emitEvent: false });
      this.markControlsAsAutoReset(controls.notificationType);
    }

    if (controls.notificationTriggerMode.value !== 'before') {
      notificationOffsets.setValue([], { emitEvent: false });
      this.markControlsAsAutoReset(notificationOffsets);
      this.setControlEnabled(notificationOffsets, false);
      notificationOffsets.setErrors(null);
      notificationOffsets.updateValueAndValidity({ emitEvent: false });
      return;
    }

    this.setControlEnabled(notificationOffsets, true);

    const allowedOffsets = this.notificationLeadTimePresets.map(
      (preset) => preset.value
    );
    const filteredOffsets = this.sanitizeOffsets(notificationOffsets.value).filter(
      (offset) => allowedOffsets.includes(offset)
    );
    if (filteredOffsets.length > 0) {
      if (filteredOffsets.length !== notificationOffsets.value.length) {
        notificationOffsets.setValue(filteredOffsets, { emitEvent: false });
      }
    } else {
      notificationOffsets.setValue(
        this.resolveDefaultReminderOffsets(
          this.getActiveReminderPattern(),
          allowedOffsets
        ),
        { emitEvent: false }
      );
      this.markControlsAsAutoReset(notificationOffsets);
    }

    notificationOffsets.setValidators([Validators.required]);
    notificationOffsets.updateValueAndValidity({ emitEvent: false });
  }

  private applyRecurrencePatternRules(pattern: RecurrencePattern): void {
    const controls = this.form.controls;

    if (pattern !== 'selected_weekdays') {
      this.selectedWeekdayMask = 0;
      this.clearAllWeekdayTimes();
    }

    switch (pattern) {
      case 'daily': {
        controls.recurrenceDayOfMonth.setValue(null, { emitEvent: false });
        controls.recurrenceYearMonth.setValue(null, { emitEvent: false });
        controls.recurrenceYearDay.setValue(null, { emitEvent: false });
        this.markControlsAsAutoReset(
          controls.recurrenceDayOfMonth,
          controls.recurrenceYearMonth,
          controls.recurrenceYearDay
        );
        this.setControlEnabled(controls.recurrenceDayOfMonth, false);
        this.setControlEnabled(controls.recurrenceYearMonth, false);
        this.setControlEnabled(controls.recurrenceYearDay, false);
        break;
      }
      case 'selected_weekdays': {
        controls.recurrenceDayOfMonth.setValue(null, { emitEvent: false });
        controls.recurrenceYearMonth.setValue(null, { emitEvent: false });
        controls.recurrenceYearDay.setValue(null, { emitEvent: false });
        this.markControlsAsAutoReset(
          controls.recurrenceDayOfMonth,
          controls.recurrenceYearMonth,
          controls.recurrenceYearDay
        );
        this.setControlEnabled(controls.recurrenceDayOfMonth, false);
        this.setControlEnabled(controls.recurrenceYearMonth, false);
        this.setControlEnabled(controls.recurrenceYearDay, false);
        break;
      }
      case 'monthly': {
        controls.recurrenceYearMonth.setValue(null, { emitEvent: false });
        controls.recurrenceYearDay.setValue(null, { emitEvent: false });
        this.markControlsAsAutoReset(
          controls.recurrenceYearMonth,
          controls.recurrenceYearDay
        );
        this.setControlEnabled(controls.recurrenceDayOfMonth, true);
        this.setControlEnabled(controls.recurrenceYearMonth, false);
        this.setControlEnabled(controls.recurrenceYearDay, false);
        break;
      }
      case 'yearly': {
        controls.recurrenceDayOfMonth.setValue(null, { emitEvent: false });
        this.markControlsAsAutoReset(controls.recurrenceDayOfMonth);
        this.setControlEnabled(controls.recurrenceDayOfMonth, false);
        this.setControlEnabled(controls.recurrenceYearMonth, true);
        this.setControlEnabled(controls.recurrenceYearDay, true);
        break;
      }
    }
  }

  private applyRecurrenceTimeRules(): void {
    const controls = this.form.controls;

    if (!controls.recurrenceHasTime.value) {
      controls.recurrenceTime.setValue('', { emitEvent: false });
      controls.recurrenceSameTimeForSelectedDays.setValue(true, {
        emitEvent: false,
      });
      this.clearAllWeekdayTimes();
      this.markControlsAsAutoReset(
        controls.recurrenceTime,
        controls.recurrenceSameTimeForSelectedDays,
        ...this.weekdays.map((day) => controls[day.timeControlName])
      );
      this.setControlEnabled(controls.recurrenceTime, false);
      this.setControlEnabled(controls.recurrenceSameTimeForSelectedDays, false);
      for (const day of this.weekdays) {
        this.setControlEnabled(controls[day.timeControlName], false);
      }
      return;
    }

    if (controls.recurrencePattern.value !== 'selected_weekdays') {
      controls.recurrenceSameTimeForSelectedDays.setValue(true, {
        emitEvent: false,
      });
      this.setControlEnabled(controls.recurrenceSameTimeForSelectedDays, false);
      this.setControlEnabled(controls.recurrenceTime, true);
      this.clearAllWeekdayTimes();
      this.markControlsAsAutoReset(
        ...this.weekdays.map((day) => controls[day.timeControlName])
      );
      for (const day of this.weekdays) {
        this.setControlEnabled(controls[day.timeControlName], false);
      }
      return;
    }

    this.setControlEnabled(controls.recurrenceSameTimeForSelectedDays, true);

    if (controls.recurrenceSameTimeForSelectedDays.value) {
      this.setControlEnabled(controls.recurrenceTime, true);
      this.clearAllWeekdayTimes();
      this.markControlsAsAutoReset(
        ...this.weekdays.map((day) => controls[day.timeControlName])
      );
      for (const day of this.weekdays) {
        this.setControlEnabled(controls[day.timeControlName], false);
      }
      return;
    }

    controls.recurrenceTime.setValue('', { emitEvent: false });
    this.markControlsAsAutoReset(controls.recurrenceTime);
    this.setControlEnabled(controls.recurrenceTime, false);
    for (const day of this.weekdays) {
      const dayControl = controls[day.timeControlName];
      if (this.isWeekdaySelected(day.bit)) {
        this.setControlEnabled(dayControl, true);
      } else {
        dayControl.setValue('', { emitEvent: false });
        this.markControlsAsAutoReset(dayControl);
        this.setControlEnabled(dayControl, false);
      }
    }
  }

  private applyRecurrencePatternValidationRules(): void {
    const controls = this.form.controls;
    this.clearAllRecurrenceValidators();

    if (controls.recurrencePattern.value === 'monthly') {
      controls.recurrenceDayOfMonth.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(31),
      ]);
    }

    if (controls.recurrencePattern.value === 'yearly') {
      controls.recurrenceYearMonth.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(12),
      ]);
      controls.recurrenceYearDay.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(31),
      ]);
    }

    if (controls.recurrenceHasTime.value) {
      if (
        controls.recurrencePattern.value === 'selected_weekdays' &&
        !controls.recurrenceSameTimeForSelectedDays.value
      ) {
        for (const day of this.selectedWeekdays) {
          controls[day.timeControlName].setValidators([Validators.required]);
        }
      } else {
        controls.recurrenceTime.setValidators([Validators.required]);
      }
    }

    if (!controls.recurrenceStartsToday.value) {
      controls.recurrenceStartDate.setValidators([Validators.required]);
    }

    if (controls.recurrenceHasEndDate.value) {
      controls.recurrenceEndDate.setValidators([Validators.required]);
    }
  }

  private clearAllRecurrenceValidators(): void {
    const controls = this.form.controls;
    controls.recurrenceTime.clearValidators();
    controls.recurrenceStartDate.clearValidators();
    controls.recurrenceEndDate.clearValidators();
    controls.recurrenceDayOfMonth.clearValidators();
    controls.recurrenceYearMonth.clearValidators();
    controls.recurrenceYearDay.clearValidators();
    for (const day of this.weekdays) {
      controls[day.timeControlName].clearValidators();
    }
  }

  private updateRecurrenceControlValidity(): void {
    const controls = this.form.controls;
    controls.recurrenceTime.updateValueAndValidity({ emitEvent: false });
    controls.recurrenceStartDate.updateValueAndValidity({ emitEvent: false });
    controls.recurrenceEndDate.updateValueAndValidity({ emitEvent: false });
    controls.recurrenceDayOfMonth.updateValueAndValidity({ emitEvent: false });
    controls.recurrenceYearMonth.updateValueAndValidity({ emitEvent: false });
    controls.recurrenceYearDay.updateValueAndValidity({ emitEvent: false });
    for (const day of this.weekdays) {
      controls[day.timeControlName].updateValueAndValidity({
        emitEvent: false,
      });
    }
  }

  private resetRecurrenceBranchToDefaults(): void {
    const controls = this.form.controls;
    controls.recurrencePattern.setValue('daily', { emitEvent: false });
    controls.recurrenceHasTime.setValue(false, { emitEvent: false });
    controls.recurrenceSameTimeForSelectedDays.setValue(true, {
      emitEvent: false,
    });
    controls.recurrenceTime.setValue('', { emitEvent: false });
    controls.recurrenceStartsToday.setValue(true, { emitEvent: false });
    controls.recurrenceStartDate.setValue(
      this.addDays(new Date(), 1).toISOString(),
      { emitEvent: false }
    );
    controls.recurrenceHasEndDate.setValue(false, { emitEvent: false });
    controls.recurrenceEndDate.setValue(null, { emitEvent: false });
    controls.recurrenceDayOfMonth.setValue(null, { emitEvent: false });
    controls.recurrenceYearMonth.setValue(null, { emitEvent: false });
    controls.recurrenceYearDay.setValue(null, { emitEvent: false });
    this.selectedWeekdayMask = 0;
    this.clearAllWeekdayTimes();
    this.markControlsAsAutoReset(
      controls.recurrencePattern,
      controls.recurrenceHasTime,
      controls.recurrenceSameTimeForSelectedDays,
      controls.recurrenceTime,
      controls.recurrenceStartsToday,
      controls.recurrenceStartDate,
      controls.recurrenceHasEndDate,
      controls.recurrenceEndDate,
      controls.recurrenceDayOfMonth,
      controls.recurrenceYearMonth,
      controls.recurrenceYearDay,
      ...this.weekdays.map((day) => controls[day.timeControlName])
    );
  }

  private applyNotificationBranchEnabledState(enabled: boolean): void {
    const controls = this.form.controls;
    this.setControlEnabled(controls.notificationType, enabled);
    this.setControlEnabled(controls.notificationTriggerMode, enabled);
    this.setControlEnabled(
      controls.notificationOffsets,
      enabled && controls.notificationTriggerMode.value === 'before'
    );
  }

  private buildCreateTaskInput(): CreateTaskInput {
    const values = this.form.getRawValue();

    return {
      title: values.title.trim(),
      description: values.description.trim() || null,
      mode: values.mode,
      estimatedDurationMin:
        values.mode === 'duration' ? values.estimatedDurationMin : null,
      categoryId: values.categoryId || null,
      recurrence: values.recurrenceEnabled
        ? this.buildRecurrenceInput(values)
        : undefined,
      notification: values.notificationsEnabled
        ? {
            notificationType: values.notificationType,
            triggerMode: values.notificationTriggerMode,
            notificationOffsets:
              values.notificationTriggerMode === 'before'
                ? values.notificationOffsets
                : null,
          }
        : undefined,
    };
  }

  private buildRecurrenceInput(
    values: ReturnType<CreateTaskPage['form']['getRawValue']>
  ): CreateTaskRecurrenceInput {
    const startDate = this.resolveStartDate(
      values.recurrenceStartsToday,
      values.recurrenceStartDate
    );
    const endDate = values.recurrenceHasEndDate ? values.recurrenceEndDate : null;
    const timezone = this.resolveTimezone();

    if (
      values.recurrencePattern === 'selected_weekdays' &&
      values.recurrenceHasTime &&
      !values.recurrenceSameTimeForSelectedDays
    ) {
      return {
        mode: 'weekly_schedule',
        weeklyDayTimes: this.selectedWeekdays.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          time: values[day.timeControlName],
        })),
        hasTime: true,
        sameTimeForSelectedDays: false,
        startsToday: values.recurrenceStartsToday,
        hasEndDate: values.recurrenceHasEndDate,
        startDate,
        endDate,
        timezone,
      };
    }

    return {
      mode: 'simple',
      simpleType: values.recurrencePattern,
      hasTime: values.recurrenceHasTime,
      sameTimeForSelectedDays:
        values.recurrencePattern === 'selected_weekdays'
          ? values.recurrenceSameTimeForSelectedDays
          : true,
      startsToday: values.recurrenceStartsToday,
      hasEndDate: values.recurrenceHasEndDate,
      daysOfWeekMask:
        values.recurrencePattern === 'selected_weekdays'
          ? this.selectedWeekdayMask
          : null,
      dayOfMonth:
        values.recurrencePattern === 'monthly'
          ? values.recurrenceDayOfMonth
          : values.recurrencePattern === 'yearly'
            ? values.recurrenceYearDay
            : null,
      monthOfYear:
        values.recurrencePattern === 'yearly'
          ? values.recurrenceYearMonth
          : null,
      timeOfDay: values.recurrenceHasTime ? values.recurrenceTime : null,
      startDate,
      endDate,
      timezone,
    };
  }

  private resolveStartDate(startsToday: boolean, selectedStartDate: string): string {
    if (startsToday) {
      return new Date().toISOString();
    }

    const trimmed = selectedStartDate.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }

    return this.addDays(new Date(), 1).toISOString();
  }

  private resolveDefaultRecurrenceEndDate(
    startsToday: boolean,
    selectedStartDate: string
  ): string {
    const baseDateValue = this.resolveStartDate(startsToday, selectedStartDate);
    const baseDate = this.parseDate(baseDateValue) ?? new Date();
    return this.addOneMonth(baseDate).toISOString();
  }

  private addOneMonth(date: Date): Date {
    const nextMonth = new Date(date.getTime());
    const dayOfMonth = nextMonth.getDate();
    nextMonth.setDate(1);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const maxDayInMonth = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth() + 1,
      0
    ).getDate();
    nextMonth.setDate(Math.min(dayOfMonth, maxDayInMonth));
    return nextMonth;
  }

  private addDays(date: Date, days: number): Date {
    const shiftedDate = new Date(date.getTime());
    shiftedDate.setDate(shiftedDate.getDate() + days);
    return shiftedDate;
  }

  private parseDate(value: string): Date | null {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate;
  }

  private setControlEnabled(
    control: AbstractControl<unknown, unknown>,
    enabled: boolean
  ): void {
    if (enabled && control.disabled) {
      control.enable({ emitEvent: false });
      return;
    }

    if (!enabled && control.enabled) {
      control.disable({ emitEvent: false });
    }
  }

  private markControlsAsAutoReset(
    ...controls: Array<AbstractControl<unknown, unknown>>
  ): void {
    for (const control of controls) {
      control.setErrors(null);
      control.markAsPristine();
      control.markAsUntouched();
    }
  }

  private clearAllWeekdayTimes(): void {
    for (const day of this.weekdays) {
      this.form.controls[day.timeControlName].setValue('', { emitEvent: false });
    }
  }

  private clearWeekdayTime(bit: number): void {
    const day = this.weekdays.find((item) => item.bit === bit);
    if (!day) {
      return;
    }

    this.form.controls[day.timeControlName].setValue('', { emitEvent: false });
  }

  private normalizeTimeControlsBeforeSubmit(): void {
    const timeControlNames: Array<WeekdayTimeControlName | 'recurrenceTime'> = [
      'recurrenceTime',
      ...this.weekdays.map((day) => day.timeControlName),
    ];

    for (const controlName of timeControlNames) {
      const control = this.form.controls[controlName];
      const trimmed = control.value.trim();
      if (!trimmed) {
        control.setValue('', { emitEvent: false });
        continue;
      }

      const formatted = this.normalizeTimeValue(trimmed);
      control.setValue(formatted ?? trimmed, { emitEvent: false });
    }
  }

  private getAllowedReminderOffsets(
    pattern: RecurrencePattern
  ): readonly NotificationLeadTimePreset[] {
    if (pattern === 'yearly') {
      return this.notificationLeadTimeYearlyPresets;
    }

    if (pattern === 'monthly') {
      return this.notificationLeadTimeMonthlyPresets;
    }

    return this.notificationLeadTimeDefaultPresets;
  }

  private getAllowedReminderValues(pattern: RecurrencePattern): number[] {
    return this.getAllowedReminderOffsets(pattern).map((preset) => preset.value);
  }

  private getActiveReminderPattern(): RecurrencePattern {
    return this.recurrenceEnabled ? this.recurrencePattern : 'daily';
  }

  private resolveReminderPatternFromRecurrence(
    recurrence?: CreateTaskRecurrenceInput
  ): RecurrencePattern {
    if (!recurrence || recurrence.mode !== 'simple') {
      return recurrence?.mode === 'weekly_schedule' ? 'selected_weekdays' : 'daily';
    }

    switch (recurrence.simpleType) {
      case 'selected_weekdays':
      case 'monthly':
      case 'yearly':
        return recurrence.simpleType;
      default:
        return 'daily';
    }
  }

  private resolveDefaultReminderOffset(pattern: RecurrencePattern): number {
    if (pattern === 'monthly') {
      return 1440;
    }

    if (pattern === 'yearly') {
      return 10080;
    }

    return 10;
  }

  private resolveDefaultReminderOffsets(
    pattern: RecurrencePattern,
    allowedOffsets: readonly number[]
  ): number[] {
    if (allowedOffsets.length === 0) {
      return [];
    }

    const validStoredOffsets = this.sanitizeOffsets(
      this.lastNotificationOffsets
    ).filter((offset) => allowedOffsets.includes(offset));
    if (validStoredOffsets.length > 0) {
      return [validStoredOffsets[0]];
    }

    const preferredDefault = this.resolveDefaultReminderOffset(pattern);
    if (allowedOffsets.includes(preferredDefault)) {
      return [preferredDefault];
    }

    return [allowedOffsets[0]];
  }

  private sanitizeCreateTaskPayload(input: CreateTaskInput): CreateTaskInput {
    const sanitized: CreateTaskInput = {
      ...input,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      categoryId: input.categoryId || null,
      estimatedDurationMin:
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
    };

    sanitized.recurrence = this.sanitizeRecurrenceInput(input.recurrence);
    sanitized.notification = this.sanitizeNotificationInput(
      input.notification,
      sanitized.recurrence
    );

    return sanitized;
  }

  private sanitizeRecurrenceInput(
    recurrence?: CreateTaskRecurrenceInput
  ): CreateTaskRecurrenceInput | undefined {
    if (!recurrence) {
      return undefined;
    }

    const startDate = this.resolveSafeIsoDate(
      recurrence.startDate,
      new Date().toISOString()
    );
    const rawEndDate = this.resolveSafeIsoDateOrNull(recurrence.endDate);
    const hasEndDate = recurrence.hasEndDate ?? rawEndDate !== null;
    const endDate = hasEndDate ? rawEndDate : null;
    const timezone = recurrence.timezone ?? null;
    const startsToday = recurrence.startsToday ?? this.isTodayDate(startDate);

    if (recurrence.mode === 'weekly_schedule') {
      const weeklyDayTimes = (recurrence.weeklyDayTimes ?? [])
        .map((slot) => ({
          dayOfWeek: Math.trunc(slot.dayOfWeek),
          time: this.normalizeTimeValue(slot.time) ?? '',
        }))
        .filter(
          (slot) =>
            slot.dayOfWeek >= 1 && slot.dayOfWeek <= 7 && slot.time.length > 0
        );

      return {
        mode: 'weekly_schedule',
        weeklyDayTimes,
        hasTime: true,
        sameTimeForSelectedDays: false,
        startsToday,
        hasEndDate,
        startDate,
        endDate,
        timezone,
      };
    }

    const simpleType = recurrence.simpleType ?? 'daily';
    const requestedHasTime =
      recurrence.hasTime ??
      (typeof recurrence.timeOfDay === 'string' &&
        recurrence.timeOfDay.trim().length > 0);
    const normalizedTime = requestedHasTime
      ? this.normalizeTimeValue(recurrence.timeOfDay ?? '')
      : null;
    const hasTime = requestedHasTime && normalizedTime !== null;
    const sanitizedSimple: CreateTaskRecurrenceInput = {
      mode: 'simple',
      simpleType,
      hasTime,
      sameTimeForSelectedDays:
        simpleType === 'selected_weekdays'
          ? recurrence.sameTimeForSelectedDays ?? true
          : true,
      startsToday,
      hasEndDate,
      startDate,
      endDate,
      timezone,
      daysOfWeekMask: null,
      dayOfMonth: null,
      monthOfYear: null,
      timeOfDay: hasTime ? normalizedTime : null,
    };

    if (simpleType === 'selected_weekdays') {
      const mask = recurrence.daysOfWeekMask ?? 0;
      sanitizedSimple.daysOfWeekMask = mask > 0 ? mask : null;
      return sanitizedSimple;
    }

    if (simpleType === 'monthly') {
      sanitizedSimple.dayOfMonth = this.sanitizeBoundedInteger(
        recurrence.dayOfMonth,
        1,
        31
      );
      return sanitizedSimple;
    }

    if (simpleType === 'yearly') {
      sanitizedSimple.dayOfMonth = this.sanitizeBoundedInteger(
        recurrence.dayOfMonth,
        1,
        31
      );
      sanitizedSimple.monthOfYear = this.sanitizeBoundedInteger(
        recurrence.monthOfYear,
        1,
        12
      );
      return sanitizedSimple;
    }

    return sanitizedSimple;
  }

  private sanitizeNotificationInput(
    notification: CreateTaskInput['notification'],
    recurrence?: CreateTaskRecurrenceInput
  ): CreateTaskInput['notification'] {
    if (!notification) {
      return undefined;
    }

    const notificationType: NotificationType =
      notification.notificationType === 'none'
        ? 'sound'
        : notification.notificationType;

    if (notification.triggerMode !== 'before') {
      return {
        ...notification,
        notificationType,
        triggerMode: notification.triggerMode,
        notificationOffsets: null,
      };
    }

    const reminderPattern = this.resolveReminderPatternFromRecurrence(recurrence);
    const allowedOffsets = this.getAllowedReminderValues(reminderPattern);
    const normalizedOffsets = this.sanitizeOffsets(
      notification.notificationOffsets ?? []
    ).filter((offset) => allowedOffsets.includes(offset));
    const resolvedOffsets =
      normalizedOffsets.length > 0
        ? normalizedOffsets
        : this.resolveDefaultReminderOffsets(reminderPattern, allowedOffsets);

    return {
      ...notification,
      notificationType,
      triggerMode: 'before',
      notificationOffsets: resolvedOffsets.length > 0 ? resolvedOffsets : null,
    };
  }

  private resolveSafeIsoDate(value: string, fallback: string): string {
    const parsed = this.parseDate(value);
    if (parsed) {
      return parsed.toISOString();
    }

    const fallbackDate = this.parseDate(fallback);
    if (fallbackDate) {
      return fallbackDate.toISOString();
    }

    return new Date().toISOString();
  }

  private isTodayDate(value: string): boolean {
    const parsed = this.parseDate(value);
    if (!parsed) {
      return false;
    }

    const now = new Date();
    return (
      parsed.getUTCFullYear() === now.getUTCFullYear() &&
      parsed.getUTCMonth() === now.getUTCMonth() &&
      parsed.getUTCDate() === now.getUTCDate()
    );
  }

  private resolveSafeIsoDateOrNull(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const parsed = this.parseDate(value);
    return parsed ? parsed.toISOString() : null;
  }

  private sanitizeBoundedInteger(
    value: number | null | undefined,
    min: number,
    max: number
  ): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    const rounded = Math.round(value);
    if (rounded < min || rounded > max) {
      return null;
    }

    return rounded;
  }

  private async loadLastNotificationLeadTimePreference(): Promise<void> {
    const loaded = await this.ensureSettingsLoaded();
    if (!loaded) {
      return;
    }

    const userPreferences = this.settings.get().userPreferences ?? {};
    const offsetsPreference = userPreferences[this.notificationOffsetsPreferenceKey];
    const legacyPreference =
      userPreferences[this.legacyNotificationLeadTimePreferenceKey];
    const normalizedOffsets = this.normalizeOffsetsPreference(
      offsetsPreference,
      legacyPreference
    );

    if (normalizedOffsets.length > 0) {
      this.lastNotificationOffsets = normalizedOffsets;
      this.applyNotificationStateRules();
    }
  }

  private async persistNotificationLeadTimeFromCurrentForm(): Promise<void> {
    const controls = this.form.controls;
    if (
      !controls.notificationsEnabled.value ||
      controls.notificationTriggerMode.value !== 'before'
    ) {
      return;
    }

    const offsets = this.sanitizeOffsets(controls.notificationOffsets.value);
    if (offsets.length === 0) {
      return;
    }

    await this.persistNotificationOffsetsPreference(offsets);
  }

  private async persistNotificationOffsetsPreference(
    values: readonly number[]
  ): Promise<void> {
    const normalizedValues = this.sanitizeOffsets(values);
    if (normalizedValues.length === 0) {
      return;
    }

    this.lastNotificationOffsets = normalizedValues;

    const loaded = await this.ensureSettingsLoaded();
    if (!loaded) {
      return;
    }

    try {
      const userPreferences = this.settings.get().userPreferences ?? {};
      await this.settings.set({
        userPreferences: {
          ...userPreferences,
          [this.notificationOffsetsPreferenceKey]: JSON.stringify(normalizedValues),
          [this.legacyNotificationLeadTimePreferenceKey]: null,
        },
      });
    } catch {
      // Keeps task creation flow working even if preference persistence fails.
    }
  }

  private async ensureSettingsLoaded(): Promise<boolean> {
    if (this.isSettingsLoaded) {
      return true;
    }

    try {
      await this.settings.load();
      this.isSettingsLoaded = true;
      return true;
    } catch {
      return false;
    }
  }

  private normalizeOffsetsPreference(
    offsetsPreference: unknown,
    legacyPreference: unknown
  ): number[] {
    const parsedOffsets = this.parseOffsetsPreference(offsetsPreference);
    if (parsedOffsets.length > 0) {
      return parsedOffsets;
    }

    if (typeof legacyPreference === 'number' && Number.isFinite(legacyPreference)) {
      return this.sanitizeOffsets([legacyPreference]);
    }

    return [];
  }

  private parseOffsetsPreference(value: unknown): number[] {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return this.sanitizeOffsets([value]);
    }

    if (typeof value !== 'string') {
      return [];
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return this.sanitizeOffsets(
        parsed.filter((candidate): candidate is number => typeof candidate === 'number')
      );
    } catch {
      const csvValues = trimmed
        .split(',')
        .map((segment) => Number.parseInt(segment.trim(), 10))
        .filter((candidate) => Number.isFinite(candidate));
      return this.sanitizeOffsets(csvValues);
    }
  }

  private sanitizeOffsets(values: readonly number[]): number[] {
    const uniqueValues = new Set<number>();
    for (const candidate of values) {
      if (!Number.isFinite(candidate)) {
        continue;
      }

      const normalized = Math.round(candidate);
      if (normalized > 0) {
        uniqueValues.add(normalized);
      }
    }

    return this.sortOffsets(Array.from(uniqueValues));
  }

  private sortOffsets(values: readonly number[]): number[] {
    return [...values].sort((a, b) => a - b);
  }

  private async openCreateCategoryAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant('CREATE_TASK.CATEGORY_CREATE_TITLE'),
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: this.translate.instant(
            'CREATE_TASK.CATEGORY_CREATE_PLACEHOLDER'
          ),
        },
      ],
      buttons: [
        {
          text: this.translate.instant('COMMON.CANCEL'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('COMMON.DONE'),
          role: 'confirm',
        },
      ],
    });

    await alert.present();
    const { role, data } = await alert.onDidDismiss<{
      values?: { name?: string };
    }>();
    if (role !== 'confirm') {
      return;
    }

    const categoryName = data?.values?.name?.trim() ?? '';
    if (!categoryName) {
      return;
    }

    try {
      const created = await this.categoryRepository.createCategory(categoryName);
      this.categories = await this.categoryRepository.listCategories();
      this.lastSelectedCategoryId = created.id;
      this.form.controls.categoryId.setValue(created.id, { emitEvent: false });
    } catch {
      // Keeps the previous selection when creation fails.
      this.form.controls.categoryId.setValue(this.lastSelectedCategoryId, {
        emitEvent: false,
      });
    }
  }

  private resolveTimezone(): string | null {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      return null;
    }
  }

  private normalizeTimeValue(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const hhmmMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
    if (hhmmMatch) {
      const hours = Number.parseInt(hhmmMatch[1], 10);
      const minutes = Number.parseInt(hhmmMatch[2], 10);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
      }
      return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;
    }

    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length === 0 || digitsOnly.length > 4) {
      return null;
    }

    let hours = 0;
    let minutes = 0;
    if (digitsOnly.length === 1) {
      hours = Number.parseInt(digitsOnly, 10);
      minutes = 0;
    } else if (digitsOnly.length === 2) {
      hours = Number.parseInt(digitsOnly, 10);
      minutes = 0;
    } else if (digitsOnly.length === 3) {
      hours = Number.parseInt(digitsOnly[0], 10);
      minutes = Number.parseInt(digitsOnly.slice(1), 10);
    } else {
      hours = Number.parseInt(digitsOnly.slice(0, 2), 10);
      minutes = Number.parseInt(digitsOnly.slice(2), 10);
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;
  }

}
