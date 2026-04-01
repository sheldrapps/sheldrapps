import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
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
  IonPopover,
  IonSegment,
  IonSegmentButton,
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
import {
  addDays as addCalendarDays,
  formatCalendarDate,
  getDeviceTimezone,
  getToday,
  parseCalendarDate,
  toCalendarDate,
} from '../../shared/calendar';
import { startWith } from 'rxjs';
import {
  CategoryRepository,
  TaskCategory,
} from '../../database/repositories/category.repository';
import {
  CategoryNameValidationException,
  CategoryNameValidationError,
  CategoryNameValidationResult,
  validateCategoryName,
} from '../../database/repositories/category-name.validation';
import {
  CreateTaskInput,
  CreateTaskRecurrenceInput,
  NotificationTriggerMode,
  NotificationType,
  PersistedTaskAggregate,
  TaskPriority,
  TaskDurationMode,
  TaskMode,
  TaskScheduleType,
  TaskRepository,
} from '../../database/repositories/task.repository';
import { JustOneStepSettings } from '../../settings/just-one-step-settings.schema';

type RecurrencePattern = 'daily' | 'selected_weekdays' | 'monthly' | 'yearly';
type CategoryMode = 'existing' | 'custom';
type TaskFormScreenMode = 'create' | 'edit';
type WeekdayTimeControlName =
  | 'recurrenceDayTimeMon'
  | 'recurrenceDayTimeTue'
  | 'recurrenceDayTimeWed'
  | 'recurrenceDayTimeThu'
  | 'recurrenceDayTimeFri'
  | 'recurrenceDayTimeSat'
  | 'recurrenceDayTimeSun';
type WeekdayDurationControlName =
  | 'recurrenceDayDurationMon'
  | 'recurrenceDayDurationTue'
  | 'recurrenceDayDurationWed'
  | 'recurrenceDayDurationThu'
  | 'recurrenceDayDurationFri'
  | 'recurrenceDayDurationSat'
  | 'recurrenceDayDurationSun';

interface WeekdayOption {
  bit: number;
  dayOfWeek: number;
  labelKey: string;
  shortLabelKey: string;
  timeControlName: WeekdayTimeControlName;
  durationControlName: WeekdayDurationControlName;
}

interface NotificationLeadTimePreset {
  value: number;
  labelKey: string;
}

interface CategorySelectionState {
  mode: CategoryMode;
  categoryId: string | null;
  customCategoryName: string;
  lastSelectedCategoryId: string | null;
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
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
    IonNote,
    IonPopover,
    DatePickerComponent,
    TimePickerComponent,
  ],
})
export class CreateTaskPage {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskRepository = inject(TaskRepository);
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly alertController = inject(AlertController);
  private readonly translate = inject(TranslateService);
  private readonly settings = inject(SettingsStore<JustOneStepSettings>);
  private readonly notificationOffsetsPreferenceKey =
    'create_task.notification_offsets';
  private readonly legacyNotificationLeadTimePreferenceKey =
    'create_task.notification_minutes_before';

  @ViewChild('descriptionInput', { read: IonTextarea })
  private descriptionInput?: IonTextarea;

  readonly createCategoryOptionValue = '__create_category__';
  readonly monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
  readonly weekdays: readonly WeekdayOption[] = [
    {
      bit: 1,
      dayOfWeek: 1,
      labelKey: 'CREATE_TASK.WEEKDAY_MON',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_MON',
      timeControlName: 'recurrenceDayTimeMon',
      durationControlName: 'recurrenceDayDurationMon',
    },
    {
      bit: 2,
      dayOfWeek: 2,
      labelKey: 'CREATE_TASK.WEEKDAY_TUE',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_TUE',
      timeControlName: 'recurrenceDayTimeTue',
      durationControlName: 'recurrenceDayDurationTue',
    },
    {
      bit: 4,
      dayOfWeek: 3,
      labelKey: 'CREATE_TASK.WEEKDAY_WED',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_WED',
      timeControlName: 'recurrenceDayTimeWed',
      durationControlName: 'recurrenceDayDurationWed',
    },
    {
      bit: 8,
      dayOfWeek: 4,
      labelKey: 'CREATE_TASK.WEEKDAY_THU',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_THU',
      timeControlName: 'recurrenceDayTimeThu',
      durationControlName: 'recurrenceDayDurationThu',
    },
    {
      bit: 16,
      dayOfWeek: 5,
      labelKey: 'CREATE_TASK.WEEKDAY_FRI',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_FRI',
      timeControlName: 'recurrenceDayTimeFri',
      durationControlName: 'recurrenceDayDurationFri',
    },
    {
      bit: 32,
      dayOfWeek: 6,
      labelKey: 'CREATE_TASK.WEEKDAY_SAT',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_SAT',
      timeControlName: 'recurrenceDayTimeSat',
      durationControlName: 'recurrenceDayDurationSat',
    },
    {
      bit: 64,
      dayOfWeek: 7,
      labelKey: 'CREATE_TASK.WEEKDAY_SUN',
      shortLabelKey: 'CREATE_TASK.WEEKDAY_SHORT_SUN',
      timeControlName: 'recurrenceDayTimeSun',
      durationControlName: 'recurrenceDayDurationSun',
    },
  ] as const;
  readonly notificationLeadTimeDefaultPresets: readonly NotificationLeadTimePreset[] = [
    {
      value: 60,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1H',
    },
    {
      value: 30,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_30M',
    },
    {
      value: 15,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_15M',
    },
    {
      value: 10,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_10M',
    },
    {
      value: 5,
      labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_5M',
    },
  ] as const;
  readonly notificationLeadTimeMonthlyPresets: readonly NotificationLeadTimePreset[] =
    [
      {
        value: 10080,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1W',
      },
      {
        value: 4320,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_3D',
      },
      {
        value: 1440,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1D',
      },
      {
        value: 720,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_12H',
      },
      {
        value: 60,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1H',
      },
      {
        value: 30,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_30M',
      },
    ] as const;
  readonly notificationLeadTimeYearlyPresets: readonly NotificationLeadTimePreset[] =
    [
      {
        value: 43200,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1MO',
      },
      {
        value: 20160,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_2W',
      },
      {
        value: 10080,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1W',
      },
      {
        value: 4320,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_3D',
      },
      {
        value: 1440,
        labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1D',
      },
    ] as const;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    mode: this.fb.nonNullable.control<TaskMode>('check'),
    priority: this.fb.nonNullable.control<TaskPriority>('B'),
    estimatedDurationMin: this.fb.control<number | null>(null),
    categoryMode: this.fb.nonNullable.control<CategoryMode>('existing'),
    categoryId: this.fb.control<string | null>(null),
    customCategoryName: this.fb.nonNullable.control(''),
    oneTimeDate: this.fb.nonNullable.control(this.resolveTodayIso()),
    oneTimeHasTime: this.fb.nonNullable.control(false),
    oneTimeTime: this.fb.nonNullable.control(''),
    recurrenceEnabled: this.fb.nonNullable.control(false),
    recurrencePattern:
      this.fb.nonNullable.control<RecurrencePattern>('daily'),
    recurrenceHasTime: this.fb.nonNullable.control(false),
    recurrenceSameTimeForSelectedDays: this.fb.nonNullable.control(true),
    recurrenceDurationMode:
      this.fb.nonNullable.control<TaskDurationMode>('single'),
    recurrenceTime: this.fb.nonNullable.control(''),
    recurrenceStartsToday: this.fb.nonNullable.control(true),
    recurrenceStartDate: this.fb.nonNullable.control(
      this.resolveTomorrowIso()
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
    recurrenceDayDurationMon: this.fb.control<number | null>(null),
    recurrenceDayDurationTue: this.fb.control<number | null>(null),
    recurrenceDayDurationWed: this.fb.control<number | null>(null),
    recurrenceDayDurationThu: this.fb.control<number | null>(null),
    recurrenceDayDurationFri: this.fb.control<number | null>(null),
    recurrenceDayDurationSat: this.fb.control<number | null>(null),
    recurrenceDayDurationSun: this.fb.control<number | null>(null),
    notificationsEnabled: this.fb.nonNullable.control(false),
    notificationType: this.fb.nonNullable.control<NotificationType>('sound'),
    notificationTriggerMode:
      this.fb.nonNullable.control<NotificationTriggerMode>('at_time'),
    notificationOffsets: this.fb.nonNullable.control<number[]>([]),
  });
  private readonly initialFormValue = this.form.getRawValue();

  categories: TaskCategory[] = [];
  selectedWeekdayMask = 0;
  titleTouched = false;
  descriptionTouched = false;
  customCategoryTouched = false;
  submitAttempted = false;
  isSaving = false;
  saveFailed = false;
  isTaskLoading = false;
  loadFailed = false;
  screenMode: TaskFormScreenMode = 'create';
  editingTaskId: string | null = null;
  priorityHintTier: TaskPriority | null = null;
  priorityHintAnchorEvent: Event | null = null;
  private lastSelectedCategoryId: string | null = null;
  private isSettingsLoaded = false;
  private lastNotificationOffsets: number[] = [];
  private priorityLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private priorityHintHideTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly priorityLongPressDelayMs = 420;
  private readonly priorityHintVisibleMs = 2500;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearPriorityGestureTimers();
    });
    this.registerScreenMode();
    this.registerDynamicValidation();
    this.registerAgendaPrefill();
    void this.loadCategories();
    void this.loadLastNotificationLeadTimePreference();
  }

  get isEditMode(): boolean {
    return this.screenMode === 'edit';
  }

  get pageTitleKey(): string {
    return this.isEditMode ? 'TASK_DETAIL.EDIT' : 'CREATE_TASK.TITLE';
  }

  get submitLabelKey(): string {
    return this.isEditMode ? 'CATEGORY_FORM.UPDATE_ACTION' : 'CREATE_TASK.SUBMIT';
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

  get oneTimeHasTime(): boolean {
    return this.form.controls.oneTimeHasTime.value;
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

  get recurrenceDurationMode(): TaskDurationMode {
    return this.form.controls.recurrenceDurationMode.value;
  }

  get recurrenceUsesPerDayDuration(): boolean {
    return (
      this.isDurationTrackingEnabled &&
      this.recurrenceEnabled &&
      this.recurrencePattern === 'selected_weekdays' &&
      this.recurrenceDurationMode === 'per_occurrence'
    );
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

  get yearlyMonthOptions(): Array<{ value: number; label: string }> {
    return Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      const monthDate = new Date(Date.UTC(2026, index, 1, 12, 0, 0, 0));
      const monthLabel = new Intl.DateTimeFormat(this.activeLocale, {
        month: 'long',
      }).format(monthDate);
      return {
        value: monthNumber,
        label: this.capitalizeLabel(monthLabel),
      };
    });
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
    return (
      this.isSaving ||
      this.form.invalid ||
      this.showSelectedWeekdayError ||
      this.hasCustomCategoryValidationError
    );
  }

  get isCustomCategoryMode(): boolean {
    return this.form.controls.categoryMode.value === 'custom';
  }

  get normalizedCustomCategoryName(): string {
    return this.customCategoryValidation.normalizedName;
  }

  get customCategoryValidationError(): CategoryNameValidationError | null {
    return this.customCategoryValidation.error;
  }

  get showCategoryRequiredError(): boolean {
    return (
      !this.isCustomCategoryMode &&
      this.hasControlError(this.form.controls.categoryId, 'required')
    );
  }

  get showCustomCategoryNameRequiredError(): boolean {
    if (!this.isCustomCategoryMode) {
      return false;
    }

    return (
      this.customCategoryValidationError === 'empty' &&
      (this.customCategoryTouched || this.submitAttempted)
    );
  }

  get showCustomCategoryNameDuplicateError(): boolean {
    if (!this.isCustomCategoryMode) {
      return false;
    }

    return (
      this.customCategoryValidationError === 'duplicate' &&
      (this.customCategoryTouched || this.submitAttempted)
    );
  }

  get showCustomCategoryNameTooLongError(): boolean {
    if (!this.isCustomCategoryMode) {
      return false;
    }

    return (
      this.customCategoryValidationError === 'too_long' &&
      (this.customCategoryTouched || this.submitAttempted)
    );
  }

  get hasCustomCategoryValidationError(): boolean {
    return this.isCustomCategoryMode && this.customCategoryValidationError !== null;
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

  onCustomCategoryNameBlur(): void {
    this.customCategoryTouched = true;
  }

  onDurationTrackingToggle(enabled: boolean): void {
    this.form.controls.mode.setValue(enabled ? 'duration' : 'check');
  }

  onPriorityLongPressStart(priority: TaskPriority, anchorEvent: Event): void {
    this.clearPriorityLongPressTimer();
    this.priorityLongPressTimer = setTimeout(() => {
      this.priorityLongPressTimer = null;
      this.priorityHintAnchorEvent = anchorEvent;
      this.priorityHintTier = priority;
      this.schedulePriorityHintHide();
    }, this.priorityLongPressDelayMs);
  }

  onPriorityLongPressEnd(): void {
    this.clearPriorityLongPressTimer();
  }

  onPriorityHintDismissed(): void {
    this.priorityHintTier = null;
    this.priorityHintAnchorEvent = null;
    this.clearPriorityHintHideTimer();
  }

  get recurrenceDayOfMonthValue(): number {
    const value = this.form.controls.recurrenceDayOfMonth.value;
    if (typeof value === 'number' && value >= 1 && value <= 31) {
      return value;
    }

    return 1;
  }

  onAdjustRecurrenceDayOfMonth(delta: number): void {
    const control = this.form.controls.recurrenceDayOfMonth;
    const nextValue = Math.max(1, Math.min(31, this.recurrenceDayOfMonthValue + delta));
    control.setValue(nextValue);
    control.markAsTouched();
  }

  onCategoryChange(event: CustomEvent<{ value: string | null }>): void {
    const selectedValue = (event.detail.value ?? null) as string | null;
    if (selectedValue !== this.createCategoryOptionValue) {
      this.setExistingCategorySelection(selectedValue);
      return;
    }

    const previousSelection = this.captureCategorySelectionState();
    const fallbackCategoryId =
      previousSelection.mode === 'existing'
        ? previousSelection.categoryId
        : previousSelection.lastSelectedCategoryId;
    this.form.controls.categoryId.setValue(fallbackCategoryId, {
      emitEvent: false,
    });
    void this.openCreateCategoryAlert(previousSelection);
  }

  isNotificationLeadTimeSelected(value: number): boolean {
    return this.form.controls.notificationOffsets.value.includes(value);
  }

  onNotificationLeadTimeSelect(value: number): void {
    const control = this.form.controls.notificationOffsets;
    const allowedOffsets = this.getAllowedReminderValues(this.getActiveReminderPattern());
    if (!allowedOffsets.includes(value)) {
      return;
    }

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

  showWeekdayDurationRequiredError(controlName: WeekdayDurationControlName): boolean {
    return this.hasControlError(this.form.controls[controlName], 'required');
  }

  async submit(): Promise<void> {
    this.submitAttempted = true;
    this.titleTouched = true;
    this.customCategoryTouched = this.customCategoryTouched || this.isCustomCategoryMode;
    this.saveFailed = false;
    this.normalizeTimeControlsBeforeSubmit();

    if (
      this.form.invalid ||
      this.showSelectedWeekdayError ||
      this.hasCustomCategoryValidationError
    ) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    try {
      await this.persistNotificationLeadTimeFromCurrentForm();
      const payload = this.sanitizeCreateTaskPayload(this.buildCreateTaskInput());
      const categoryMode = this.form.controls.categoryMode.value;

      if (this.isEditMode && this.editingTaskId) {
        if (categoryMode === 'custom') {
          const createdCategory = await this.categoryRepository.createCategory(
            this.normalizedCustomCategoryName
          );
          payload.categoryId = createdCategory.id;
        }

        await this.taskRepository.updateTask(this.editingTaskId, payload);
        await this.router.navigate(['/tasks/view', this.editingTaskId]);
      } else {
        if (categoryMode === 'custom') {
          await this.taskRepository.createTaskWithCustomCategory(
            payload,
            this.normalizedCustomCategoryName
          );
        } else {
          await this.taskRepository.createTask(payload);
        }

        await this.router.navigate(['/tabs/tasks']);
      }
    } catch (error: unknown) {
      if (error instanceof CategoryNameValidationException) {
        if (error.code === 'duplicate') {
          await this.loadCategories();
        }
        this.customCategoryTouched = true;
      } else {
        this.saveFailed = true;
      }
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
      this.ensureExistingCategorySelection();
      this.applyCategoryValidation();
    } catch {
      this.categories = [];
      this.applyCategoryValidation();
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
    this.form.controls.categoryMode.valueChanges
      .pipe(
        startWith(this.form.controls.categoryMode.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyCategoryValidation();
      });

    this.form.controls.mode.valueChanges
      .pipe(
        startWith(this.form.controls.mode.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((mode) => {
        this.applyModeValidation(mode);
        this.applyRecurrenceStateRules();
      });

    this.form.controls.recurrenceEnabled.valueChanges
      .pipe(
        startWith(this.form.controls.recurrenceEnabled.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyOneTimeStateRules();
        this.applyRecurrenceStateRules();
        this.applyNotificationStateRules();
      });

    this.form.controls.oneTimeHasTime.valueChanges
      .pipe(
        startWith(this.form.controls.oneTimeHasTime.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyOneTimeStateRules();
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

    this.form.controls.recurrenceDurationMode.valueChanges
      .pipe(
        startWith(this.form.controls.recurrenceDurationMode.value),
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

  private registerAgendaPrefill(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.applyAgendaPrefill(params);
      });
  }

  private registerScreenMode(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const taskId = params.get('taskId')?.trim() ?? null;
        if (!taskId) {
          const wasEditing = this.screenMode === 'edit' || this.editingTaskId !== null;
          this.screenMode = 'create';
          this.editingTaskId = null;
          this.isTaskLoading = false;
          this.loadFailed = false;
          if (wasEditing) {
            this.selectedWeekdayMask = 0;
            this.form.reset(this.initialFormValue, { emitEvent: false });
            this.applyCategoryValidation();
            this.applyModeValidation(this.form.controls.mode.value);
            this.applyOneTimeStateRules();
            this.applyRecurrenceStateRules();
            this.applyNotificationStateRules();
          }
          return;
        }

        this.screenMode = 'edit';
        this.editingTaskId = taskId;
        void this.loadTaskForEdit(taskId);
      });
  }

  private async loadTaskForEdit(taskId: string): Promise<void> {
    this.isTaskLoading = true;
    this.loadFailed = false;
    this.saveFailed = false;

    try {
      const aggregate = await this.taskRepository.getTaskAggregate(taskId);
      if (!aggregate) {
        this.loadFailed = true;
        return;
      }

      this.applyTaskAggregateToForm(aggregate);
    } catch {
      this.loadFailed = true;
    } finally {
      this.isTaskLoading = false;
    }
  }

  private applyTaskAggregateToForm(task: PersistedTaskAggregate): void {
    const mapped = this.buildFormValueFromTaskAggregate(task);
    this.selectedWeekdayMask = mapped.selectedWeekdayMask;
    this.form.reset(mapped.value, { emitEvent: false });
    this.submitAttempted = false;
    this.titleTouched = false;
    this.descriptionTouched = false;
    this.customCategoryTouched = false;
    this.lastSelectedCategoryId = mapped.value.categoryId;

    this.applyCategoryValidation();
    this.applyModeValidation(this.form.controls.mode.value);
    this.applyOneTimeStateRules();
    this.applyRecurrenceStateRules();
    this.applyNotificationStateRules();
  }

  private buildFormValueFromTaskAggregate(task: PersistedTaskAggregate): {
    value: ReturnType<CreateTaskPage['form']['getRawValue']>;
    selectedWeekdayMask: number;
  } {
    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    const notification = task.notificationsEnabled ? task.notification : undefined;
    const isRecurring = task.scheduleType !== 'one_time' && Boolean(task.recurrenceEnabled && recurrence);

    let selectedWeekdayMask = 0;
    const perDayTimes: Record<WeekdayTimeControlName, string> = {
      recurrenceDayTimeMon: '',
      recurrenceDayTimeTue: '',
      recurrenceDayTimeWed: '',
      recurrenceDayTimeThu: '',
      recurrenceDayTimeFri: '',
      recurrenceDayTimeSat: '',
      recurrenceDayTimeSun: '',
    };
    const perDayDurations: Record<WeekdayDurationControlName, number | null> = {
      recurrenceDayDurationMon: null,
      recurrenceDayDurationTue: null,
      recurrenceDayDurationWed: null,
      recurrenceDayDurationThu: null,
      recurrenceDayDurationFri: null,
      recurrenceDayDurationSat: null,
      recurrenceDayDurationSun: null,
    };

    if (recurrence?.pattern === 'selected_weekdays') {
      for (const day of recurrence.weekdays) {
        selectedWeekdayMask |= day.weekdayBit;
        const weekdayOption = this.weekdays.find((item) => item.dayOfWeek === day.dayOfWeek);
        if (!weekdayOption) {
          continue;
        }

        perDayTimes[weekdayOption.timeControlName] =
          recurrence.hasTime && !recurrence.sameTimeForSelectedDays
            ? day.timeValue ?? ''
            : '';
        perDayDurations[weekdayOption.durationControlName] =
          typeof day.durationMin === 'number' ? day.durationMin : null;
      }
    }

    const value: ReturnType<CreateTaskPage['form']['getRawValue']> = {
      title: task.title,
      description: task.description ?? '',
      mode: task.trackingMode,
      priority: task.priority,
      estimatedDurationMin:
        task.trackingMode === 'duration' ? task.estimatedDurationMin : null,
      categoryMode: 'existing',
      categoryId: task.categoryId,
      customCategoryName: '',
      oneTimeDate: task.oneTimeDate ?? this.resolveTodayIso(),
      oneTimeHasTime: Boolean(task.oneTimeTime),
      oneTimeTime: task.oneTimeTime ?? '',
      recurrenceEnabled: isRecurring,
      recurrencePattern: recurrence?.pattern ?? 'daily',
      recurrenceHasTime: Boolean(recurrence?.hasTime),
      recurrenceSameTimeForSelectedDays:
        recurrence?.pattern === 'selected_weekdays'
          ? recurrence.sameTimeForSelectedDays
          : true,
      recurrenceDurationMode:
        recurrence?.pattern === 'selected_weekdays' &&
        recurrence?.weekdays.some(
          (weekday) => typeof weekday.durationMin === 'number' && weekday.durationMin > 0
        )
          ? 'per_occurrence'
          : 'single',
      recurrenceTime:
        recurrence?.hasTime && recurrence.sameTimeForSelectedDays
          ? recurrence.commonTime ?? ''
          : recurrence?.hasTime && recurrence?.pattern !== 'selected_weekdays'
            ? recurrence.commonTime ?? ''
            : '',
      recurrenceStartsToday: recurrence?.startsToday ?? true,
      recurrenceStartDate: recurrence?.startDate ?? this.resolveTomorrowIso(),
      recurrenceHasEndDate: recurrence?.hasEndDate ?? false,
      recurrenceEndDate: recurrence?.hasEndDate ? recurrence.endDate : null,
      recurrenceDayOfMonth: recurrence?.pattern === 'monthly' ? recurrence.dayOfMonth : null,
      recurrenceYearMonth: recurrence?.pattern === 'yearly' ? recurrence.yearMonth : null,
      recurrenceYearDay: recurrence?.pattern === 'yearly' ? recurrence.yearDay : null,
      recurrenceDayTimeMon: perDayTimes.recurrenceDayTimeMon,
      recurrenceDayTimeTue: perDayTimes.recurrenceDayTimeTue,
      recurrenceDayTimeWed: perDayTimes.recurrenceDayTimeWed,
      recurrenceDayTimeThu: perDayTimes.recurrenceDayTimeThu,
      recurrenceDayTimeFri: perDayTimes.recurrenceDayTimeFri,
      recurrenceDayTimeSat: perDayTimes.recurrenceDayTimeSat,
      recurrenceDayTimeSun: perDayTimes.recurrenceDayTimeSun,
      recurrenceDayDurationMon: perDayDurations.recurrenceDayDurationMon,
      recurrenceDayDurationTue: perDayDurations.recurrenceDayDurationTue,
      recurrenceDayDurationWed: perDayDurations.recurrenceDayDurationWed,
      recurrenceDayDurationThu: perDayDurations.recurrenceDayDurationThu,
      recurrenceDayDurationFri: perDayDurations.recurrenceDayDurationFri,
      recurrenceDayDurationSat: perDayDurations.recurrenceDayDurationSat,
      recurrenceDayDurationSun: perDayDurations.recurrenceDayDurationSun,
      notificationsEnabled: Boolean(task.notificationsEnabled && notification),
      notificationType: notification?.notificationType ?? 'sound',
      notificationTriggerMode: notification?.triggerMode ?? 'at_time',
      notificationOffsets:
        notification?.triggerMode === 'before' ? [...notification.offsets] : [],
    };

    return { value, selectedWeekdayMask };
  }

  private applyCategoryValidation(): void {
    const categoryIdControl = this.form.controls.categoryId;
    const isCustomMode = this.form.controls.categoryMode.value === 'custom';
    if (isCustomMode) {
      categoryIdControl.clearValidators();
      categoryIdControl.updateValueAndValidity({ emitEvent: false });
      return;
    }

    this.ensureExistingCategorySelection();
    categoryIdControl.setValidators([Validators.required]);
    categoryIdControl.updateValueAndValidity({ emitEvent: false });
  }

  private ensureExistingCategorySelection(): void {
    if (this.form.controls.categoryMode.value === 'custom') {
      return;
    }

    if (this.categories.length === 0) {
      this.form.controls.categoryId.setValue(null, { emitEvent: false });
      return;
    }

    const currentCategoryId = this.form.controls.categoryId.value;
    const hasCurrentCategory =
      typeof currentCategoryId === 'string' &&
      this.categories.some((category) => category.id === currentCategoryId);
    if (hasCurrentCategory) {
      return;
    }

    const fallbackCategoryId = this.categories[0].id;
    this.form.controls.categoryId.setValue(fallbackCategoryId, { emitEvent: false });
    this.lastSelectedCategoryId = fallbackCategoryId;
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
      this.form.controls.recurrenceDurationMode.setValue('single', { emitEvent: false });
    }

    estimatedDurationMin.updateValueAndValidity({ emitEvent: false });
  }

  private applyOneTimeStateRules(): void {
    const controls = this.form.controls;
    const oneTimeDate = controls.oneTimeDate;
    const oneTimeHasTime = controls.oneTimeHasTime;
    const oneTimeTime = controls.oneTimeTime;
    const isOneTime = !controls.recurrenceEnabled.value;

    oneTimeDate.clearValidators();
    oneTimeTime.clearValidators();

    this.setControlEnabled(oneTimeDate, isOneTime);
    this.setControlEnabled(oneTimeHasTime, isOneTime);

    if (!isOneTime) {
      oneTimeDate.updateValueAndValidity({ emitEvent: false });
      oneTimeTime.setValue('', { emitEvent: false });
      this.markControlsAsAutoReset(oneTimeTime);
      this.setControlEnabled(oneTimeTime, false);
      oneTimeTime.updateValueAndValidity({ emitEvent: false });
      return;
    }

    oneTimeDate.setValidators([Validators.required]);

    if (oneTimeHasTime.value) {
      this.setControlEnabled(oneTimeTime, true);
      oneTimeTime.setValidators([Validators.required]);
    } else {
      oneTimeTime.setValue('', { emitEvent: false });
      this.markControlsAsAutoReset(oneTimeTime);
      this.setControlEnabled(oneTimeTime, false);
    }

    oneTimeDate.updateValueAndValidity({ emitEvent: false });
    oneTimeTime.updateValueAndValidity({ emitEvent: false });
  }

  private applyAgendaPrefill(params: ParamMap): void {
    if (this.isEditMode) {
      return;
    }

    const dateParam = params.get('date')?.trim() ?? '';
    const startTime = this.normalizeTimeValue(params.get('startTime') ?? '');
    const suggestedDuration = this.parseAgendaDuration(params.get('suggestedDuration'));
    const startDateIso = this.resolveAgendaPrefillDate(dateParam);

    if (!startDateIso && !startTime && suggestedDuration === null) {
      return;
    }

    const controls = this.form.controls;
    const resolvedStartDate = startDateIso ?? controls.oneTimeDate.value;
    const hasTime = startTime !== null;

    controls.mode.setValue(suggestedDuration !== null ? 'duration' : controls.mode.value, {
      emitEvent: false,
    });
    if (suggestedDuration !== null) {
      controls.estimatedDurationMin.setValue(suggestedDuration, { emitEvent: false });
    }

    controls.recurrenceEnabled.setValue(false, { emitEvent: false });
    controls.oneTimeDate.setValue(resolvedStartDate, { emitEvent: false });
    controls.oneTimeHasTime.setValue(hasTime, { emitEvent: false });
    controls.oneTimeTime.setValue(startTime ?? '', { emitEvent: false });

    this.applyModeValidation(controls.mode.value);
    this.applyOneTimeStateRules();
    this.applyRecurrenceStateRules();
  }

  private applyRecurrenceStateRules(): void {
    const controls = this.form.controls;
    const recurrenceSubtreeControls: AbstractControl[] = [
      controls.recurrencePattern,
      controls.recurrenceHasTime,
      controls.recurrenceSameTimeForSelectedDays,
      controls.recurrenceDurationMode,
      controls.recurrenceTime,
      controls.recurrenceStartsToday,
      controls.recurrenceStartDate,
      controls.recurrenceHasEndDate,
      controls.recurrenceEndDate,
      controls.recurrenceDayOfMonth,
      controls.recurrenceYearMonth,
      controls.recurrenceYearDay,
      ...this.weekdays.map((day) => controls[day.timeControlName]),
      ...this.weekdays.map((day) => controls[day.durationControlName]),
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
    this.setControlEnabled(controls.recurrenceDurationMode, this.isDurationTrackingEnabled);
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
          this.resolveTomorrowIso(),
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
    const hasTimedSchedule = controls.recurrenceEnabled.value
      ? controls.recurrenceHasTime.value
      : controls.oneTimeHasTime.value;

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

    if (!hasTimedSchedule) {
      controls.notificationTriggerMode.setValue('manual_only', { emitEvent: false });
      this.markControlsAsAutoReset(controls.notificationTriggerMode);
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

    const reminderPattern = this.getActiveReminderPattern();
    const nextOffsets = this.resolveAllowedSelectedNotificationOffsets(
      reminderPattern,
      notificationOffsets.value,
      true
    );
    if (!this.areSameNumericArray(nextOffsets, notificationOffsets.value)) {
      notificationOffsets.setValue(nextOffsets, { emitEvent: false });
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
      controls.recurrenceDurationMode.setValue('single', { emitEvent: false });
      for (const day of this.weekdays) {
        controls[day.durationControlName].setValue(null, { emitEvent: false });
      }
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
        if (controls.recurrenceDayOfMonth.value === null) {
          controls.recurrenceDayOfMonth.setValue(1, { emitEvent: false });
          this.markControlsAsAutoReset(controls.recurrenceDayOfMonth);
        }
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
    const resetPerDayDurations = (): void => {
      for (const day of this.weekdays) {
        const durationControl = controls[day.durationControlName];
        durationControl.setValue(null, { emitEvent: false });
        this.markControlsAsAutoReset(durationControl);
        this.setControlEnabled(durationControl, false);
      }
    };
    const enablePerDayDurationsIfNeeded = (): void => {
      const usesPerDayDuration =
        this.isDurationTrackingEnabled &&
        controls.recurrenceDurationMode.value === 'per_occurrence' &&
        controls.recurrencePattern.value === 'selected_weekdays' &&
        controls.recurrenceHasTime.value &&
        !controls.recurrenceSameTimeForSelectedDays.value;

      if (!usesPerDayDuration) {
        resetPerDayDurations();
        return;
      }

      for (const day of this.weekdays) {
        const durationControl = controls[day.durationControlName];
        if (this.isWeekdaySelected(day.bit)) {
          this.setControlEnabled(durationControl, true);
        } else {
          durationControl.setValue(null, { emitEvent: false });
          this.markControlsAsAutoReset(durationControl);
          this.setControlEnabled(durationControl, false);
        }
      }
    };

    if (!controls.recurrenceHasTime.value) {
      controls.recurrenceTime.setValue('', { emitEvent: false });
      controls.recurrenceSameTimeForSelectedDays.setValue(true, {
        emitEvent: false,
      });
      controls.recurrenceDurationMode.setValue('single', { emitEvent: false });
      this.clearAllWeekdayTimes();
      this.markControlsAsAutoReset(
        controls.recurrenceTime,
        controls.recurrenceSameTimeForSelectedDays,
        controls.recurrenceDurationMode,
        ...this.weekdays.map((day) => controls[day.timeControlName])
      );
      this.setControlEnabled(controls.recurrenceTime, false);
      this.setControlEnabled(controls.recurrenceSameTimeForSelectedDays, false);
      for (const day of this.weekdays) {
        this.setControlEnabled(controls[day.timeControlName], false);
      }
      resetPerDayDurations();
      return;
    }

    if (controls.recurrencePattern.value !== 'selected_weekdays') {
      controls.recurrenceSameTimeForSelectedDays.setValue(true, {
        emitEvent: false,
      });
      controls.recurrenceDurationMode.setValue('single', { emitEvent: false });
      this.setControlEnabled(controls.recurrenceSameTimeForSelectedDays, false);
      this.setControlEnabled(controls.recurrenceDurationMode, false);
      this.setControlEnabled(controls.recurrenceTime, true);
      this.clearAllWeekdayTimes();
      this.markControlsAsAutoReset(
        controls.recurrenceDurationMode,
        ...this.weekdays.map((day) => controls[day.timeControlName])
      );
      for (const day of this.weekdays) {
        this.setControlEnabled(controls[day.timeControlName], false);
      }
      resetPerDayDurations();
      return;
    }

    this.setControlEnabled(controls.recurrenceSameTimeForSelectedDays, true);
    this.setControlEnabled(
      controls.recurrenceDurationMode,
      this.isDurationTrackingEnabled
    );

    if (controls.recurrenceSameTimeForSelectedDays.value) {
      this.setControlEnabled(controls.recurrenceTime, true);
      controls.recurrenceDurationMode.setValue('single', { emitEvent: false });
      this.clearAllWeekdayTimes();
      this.markControlsAsAutoReset(
        controls.recurrenceDurationMode,
        ...this.weekdays.map((day) => controls[day.timeControlName])
      );
      for (const day of this.weekdays) {
        this.setControlEnabled(controls[day.timeControlName], false);
      }
      resetPerDayDurations();
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

    enablePerDayDurationsIfNeeded();
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

    if (
      this.isDurationTrackingEnabled &&
      controls.recurrencePattern.value === 'selected_weekdays' &&
      controls.recurrenceHasTime.value &&
      !controls.recurrenceSameTimeForSelectedDays.value &&
      controls.recurrenceDurationMode.value === 'per_occurrence'
    ) {
      for (const day of this.selectedWeekdays) {
        controls[day.durationControlName].setValidators([
          Validators.required,
          Validators.min(1),
          Validators.max(1440),
        ]);
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
      controls[day.durationControlName].clearValidators();
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
      controls[day.durationControlName].updateValueAndValidity({
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
    controls.recurrenceDurationMode.setValue('single', { emitEvent: false });
    controls.recurrenceTime.setValue('', { emitEvent: false });
    controls.recurrenceStartsToday.setValue(true, { emitEvent: false });
    controls.recurrenceStartDate.setValue(
      this.resolveTomorrowIso(),
      { emitEvent: false }
    );
    controls.recurrenceHasEndDate.setValue(false, { emitEvent: false });
    controls.recurrenceEndDate.setValue(null, { emitEvent: false });
    controls.recurrenceDayOfMonth.setValue(null, { emitEvent: false });
    controls.recurrenceYearMonth.setValue(null, { emitEvent: false });
    controls.recurrenceYearDay.setValue(null, { emitEvent: false });
    this.selectedWeekdayMask = 0;
    this.clearAllWeekdayTimes();
    for (const day of this.weekdays) {
      controls[day.durationControlName].setValue(null, { emitEvent: false });
    }
    this.markControlsAsAutoReset(
      controls.recurrencePattern,
      controls.recurrenceHasTime,
      controls.recurrenceSameTimeForSelectedDays,
      controls.recurrenceDurationMode,
      controls.recurrenceTime,
      controls.recurrenceStartsToday,
      controls.recurrenceStartDate,
      controls.recurrenceHasEndDate,
      controls.recurrenceEndDate,
      controls.recurrenceDayOfMonth,
      controls.recurrenceYearMonth,
      controls.recurrenceYearDay,
      ...this.weekdays.flatMap((day) => [
        controls[day.timeControlName],
        controls[day.durationControlName],
      ])
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
    const categoryId =
      values.categoryMode === 'existing' ? values.categoryId || null : null;
    const scheduleType: TaskScheduleType = values.recurrenceEnabled
      ? 'recurring'
      : 'one_time';
    const hasTimedSchedule = values.recurrenceEnabled
      ? values.recurrenceHasTime
      : values.oneTimeHasTime;

    return {
      title: values.title.trim(),
      description: values.description.trim() || null,
      mode: values.mode,
      priority: values.priority,
      scheduleType,
      durationMode:
        values.mode === 'duration' && values.recurrenceEnabled
          ? values.recurrenceDurationMode
          : 'single',
      oneTimeDate: values.recurrenceEnabled ? null : values.oneTimeDate,
      oneTimeTime:
        !values.recurrenceEnabled && values.oneTimeHasTime
          ? values.oneTimeTime
          : null,
      estimatedDurationMin:
        values.mode === 'duration' ? values.estimatedDurationMin : null,
      categoryId,
      recurrence: values.recurrenceEnabled
        ? this.buildRecurrenceInput(values)
        : undefined,
      notification: values.notificationsEnabled
        ? {
            notificationType: values.notificationType,
            triggerMode: hasTimedSchedule
              ? values.notificationTriggerMode
              : 'manual_only',
            notificationOffsets:
              hasTimedSchedule && values.notificationTriggerMode === 'before'
                ? values.notificationOffsets
                : null,
          }
        : undefined,
    };
  }

  private buildRecurrenceInput(
    values: ReturnType<CreateTaskPage['form']['getRawValue']>
  ): CreateTaskRecurrenceInput {
    const timezone = this.resolveTimezone();
    const startDate = this.resolveStartDate(
      values.recurrenceStartsToday,
      values.recurrenceStartDate,
      timezone
    );
    const endDate = values.recurrenceHasEndDate ? values.recurrenceEndDate : null;

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
          durationMin:
            values.mode === 'duration' && values.recurrenceDurationMode === 'per_occurrence'
              ? values[day.durationControlName]
              : null,
        })),
        hasTime: true,
        sameTimeForSelectedDays: false,
        commonDurationMin:
          values.mode === 'duration' ? values.estimatedDurationMin : null,
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
      commonDurationMin:
        values.mode === 'duration' ? values.estimatedDurationMin : null,
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

  private resolveStartDate(
    startsToday: boolean,
    selectedStartDate: string,
    timezone: string
  ): string {
    if (startsToday) {
      return this.resolveTodayIsoForTimezone(timezone);
    }

    const trimmed = selectedStartDate.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }

    return this.resolveTomorrowIsoForTimezone(timezone);
  }

  private resolveDefaultRecurrenceEndDate(
    startsToday: boolean,
    selectedStartDate: string
  ): string {
    const baseDateValue = this.resolveStartDate(
      startsToday,
      selectedStartDate,
      this.resolveTimezone()
    );
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

  private parseAgendaDuration(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1440) {
      return null;
    }

    return parsed;
  }

  private resolveAgendaPrefillDate(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const simpleDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (simpleDateMatch) {
      const year = Number.parseInt(simpleDateMatch[1], 10);
      const month = Number.parseInt(simpleDateMatch[2], 10) - 1;
      const day = Number.parseInt(simpleDateMatch[3], 10);
      const candidate = new Date(year, month, day, 12, 0, 0, 0);
      if (
        candidate.getFullYear() === year &&
        candidate.getMonth() === month &&
        candidate.getDate() === day
      ) {
        return this.calendarDateToIsoNoon(`${simpleDateMatch[1]}-${simpleDateMatch[2]}-${simpleDateMatch[3]}`);
      }
    }

    const parsed = this.parseDate(trimmed);
    return parsed ? parsed.toISOString() : null;
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
    const timeControlNames: Array<WeekdayTimeControlName | 'recurrenceTime' | 'oneTimeTime'> = [
      'oneTimeTime',
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

  private schedulePriorityHintHide(): void {
    this.clearPriorityHintHideTimer();
    this.priorityHintHideTimer = setTimeout(() => {
      this.priorityHintHideTimer = null;
      this.onPriorityHintDismissed();
    }, this.priorityHintVisibleMs);
  }

  private clearPriorityLongPressTimer(): void {
    if (this.priorityLongPressTimer !== null) {
      clearTimeout(this.priorityLongPressTimer);
      this.priorityLongPressTimer = null;
    }
  }

  private clearPriorityHintHideTimer(): void {
    if (this.priorityHintHideTimer !== null) {
      clearTimeout(this.priorityHintHideTimer);
      this.priorityHintHideTimer = null;
    }
  }

  private clearPriorityGestureTimers(): void {
    this.clearPriorityLongPressTimer();
    this.clearPriorityHintHideTimer();
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

  private resolveAllowedSelectedNotificationOffsets(
    pattern: RecurrencePattern,
    candidateOffsets: readonly number[],
    fallbackToDefault: boolean
  ): number[] {
    const allowedOffsets = this.getAllowedReminderValues(pattern);
    const allowedOffsetSet = new Set(allowedOffsets);
    const selectedOffsets = this.sanitizeOffsets(candidateOffsets).filter((offset) =>
      allowedOffsetSet.has(offset)
    );

    if (selectedOffsets.length > 0 || !fallbackToDefault) {
      return selectedOffsets;
    }

    return this.resolveDefaultReminderOffsets(pattern, allowedOffsets);
  }

  private areSameNumericArray(
    left: readonly number[],
    right: readonly number[]
  ): boolean {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }

    return true;
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
    const deviceTimezone = this.resolveTimezone();
    const scheduleType: TaskScheduleType =
      input.scheduleType === 'recurring' ? 'recurring' : 'one_time';
    const durationMode: TaskDurationMode =
      input.durationMode === 'per_occurrence' ? 'per_occurrence' : 'single';
    const oneTimeTime =
      scheduleType === 'one_time'
        ? this.normalizeTimeValue(input.oneTimeTime ?? '')
        : null;
    const oneTimeDate =
      scheduleType === 'one_time'
        ? this.resolveSafeIsoDate(
            input.oneTimeDate ?? '',
            this.resolveTodayIsoForTimezone(deviceTimezone),
            deviceTimezone
          )
        : null;
    const recurrence =
      scheduleType === 'recurring'
        ? this.sanitizeRecurrenceInput(input.recurrence)
        : undefined;
    const hasTimedSchedule =
      (scheduleType === 'one_time' && oneTimeTime !== null) ||
      (scheduleType === 'recurring' && Boolean(recurrence?.hasTime));

    const sanitized: CreateTaskInput = {
      ...input,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      priority: this.normalizeTaskPriority(input.priority),
      scheduleType,
      durationMode,
      oneTimeDate,
      oneTimeTime,
      categoryId: input.categoryId || null,
      estimatedDurationMin:
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
      recurrence,
    };

    sanitized.notification = this.sanitizeNotificationInput(
      input.notification,
      sanitized.recurrence,
      hasTimedSchedule
    );

    return sanitized;
  }

  private normalizeTaskPriority(value: unknown): TaskPriority {
    if (value === 'S' || value === 'A' || value === 'B' || value === 'C') {
      return value;
    }

    return 'B';
  }

  private sanitizeRecurrenceInput(
    recurrence?: CreateTaskRecurrenceInput
  ): CreateTaskRecurrenceInput | undefined {
    if (!recurrence) {
      return undefined;
    }

    const timezone = recurrence.timezone ?? this.resolveTimezone();
    const startDate = this.resolveSafeIsoDate(
      recurrence.startDate,
      this.resolveTodayIsoForTimezone(timezone),
      timezone
    );
    const rawEndDate = this.resolveSafeIsoDateOrNull(recurrence.endDate, timezone);
    const hasEndDate = recurrence.hasEndDate ?? rawEndDate !== null;
    const endDate = hasEndDate ? rawEndDate : null;
    const startsToday = recurrence.startsToday ?? this.isTodayDate(startDate, timezone);

    if (recurrence.mode === 'weekly_schedule') {
      const weeklyDayTimes = (recurrence.weeklyDayTimes ?? [])
        .map((slot) => ({
          dayOfWeek: Math.trunc(slot.dayOfWeek),
          time: this.normalizeTimeValue(slot.time) ?? '',
          durationMin: this.sanitizeBoundedInteger(slot.durationMin, 1, 1440),
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
        commonDurationMin: this.sanitizeBoundedInteger(
          recurrence.commonDurationMin,
          1,
          1440
        ),
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
      commonDurationMin: this.sanitizeBoundedInteger(
        recurrence.commonDurationMin,
        1,
        1440
      ),
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
    recurrence?: CreateTaskRecurrenceInput,
    hasTimedSchedule = true
  ): CreateTaskInput['notification'] {
    if (!notification) {
      return undefined;
    }

    const notificationType: NotificationType =
      notification.notificationType === 'none'
        ? 'sound'
        : notification.notificationType;
    const triggerMode: NotificationTriggerMode = hasTimedSchedule
      ? notification.triggerMode
      : 'manual_only';

    if (triggerMode !== 'before') {
      return {
        ...notification,
        notificationType,
        triggerMode,
        notificationOffsets: null,
      };
    }

    const reminderPattern = this.resolveReminderPatternFromRecurrence(recurrence);
    const resolvedOffsets = this.resolveAllowedSelectedNotificationOffsets(
      reminderPattern,
      notification.notificationOffsets ?? [],
      true
    );

    return {
      ...notification,
      notificationType,
      triggerMode: 'before',
      notificationOffsets: resolvedOffsets.length > 0 ? resolvedOffsets : null,
    };
  }

  private resolveSafeIsoDate(
    value: string,
    fallback: string,
    timezone = this.resolveTimezone()
  ): string {
    const resolvedDate = this.resolveCalendarDateKey(value, timezone);
    if (resolvedDate) {
      return this.calendarDateToIsoNoon(resolvedDate);
    }

    const fallbackDate = this.resolveCalendarDateKey(fallback, timezone);
    if (fallbackDate) {
      return this.calendarDateToIsoNoon(fallbackDate);
    }

    return this.resolveTodayIsoForTimezone(timezone);
  }

  private isTodayDate(value: string, timezone: string): boolean {
    const localDate = this.resolveCalendarDateKey(value, timezone);
    if (!localDate) {
      return false;
    }

    const today = formatCalendarDate(getToday(timezone));
    return localDate === today;
  }

  private resolveSafeIsoDateOrNull(
    value: string | null | undefined,
    timezone = this.resolveTimezone()
  ): string | null {
    if (!value) {
      return null;
    }

    const resolvedDate = this.resolveCalendarDateKey(value, timezone);
    return resolvedDate ? this.calendarDateToIsoNoon(resolvedDate) : null;
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
    return [...values].sort((a, b) => b - a);
  }

  private async openCreateCategoryAlert(
    previousSelection: CategorySelectionState
  ): Promise<void> {
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
      this.restoreCategorySelectionState(previousSelection);
      return;
    }

    const categoryName = data?.values?.name ?? '';
    const validation = this.resolveCustomCategoryValidation(categoryName);
    if (validation.error === 'empty') {
      this.restoreCategorySelectionState(previousSelection);
      return;
    }

    this.setCustomCategorySelection(validation.normalizedName);
    if (validation.error) {
      this.customCategoryTouched = true;
      return;
    }

    this.customCategoryTouched = false;
  }

  private captureCategorySelectionState(): CategorySelectionState {
    return {
      mode: this.form.controls.categoryMode.value,
      categoryId: this.form.controls.categoryId.value,
      customCategoryName: this.form.controls.customCategoryName.value,
      lastSelectedCategoryId: this.lastSelectedCategoryId,
    };
  }

  private restoreCategorySelectionState(state: CategorySelectionState): void {
    this.form.controls.categoryMode.setValue(state.mode, { emitEvent: false });
    this.form.controls.categoryId.setValue(state.categoryId, { emitEvent: false });
    this.form.controls.customCategoryName.setValue(state.customCategoryName, {
      emitEvent: false,
    });
    this.lastSelectedCategoryId = state.lastSelectedCategoryId;
    this.applyCategoryValidation();
  }

  private setExistingCategorySelection(categoryId: string | null): void {
    const normalizedCategoryId =
      typeof categoryId === 'string' && categoryId.trim().length > 0
        ? categoryId
        : this.categories[0]?.id ?? null;
    this.form.controls.categoryMode.setValue('existing', { emitEvent: false });
    this.form.controls.categoryId.setValue(normalizedCategoryId, { emitEvent: false });
    this.form.controls.customCategoryName.setValue('', { emitEvent: false });
    this.lastSelectedCategoryId = normalizedCategoryId;
    this.customCategoryTouched = false;
    this.applyCategoryValidation();
  }

  private setCustomCategorySelection(name: string): void {
    this.form.controls.categoryMode.setValue('custom', { emitEvent: false });
    this.form.controls.categoryId.setValue(null, { emitEvent: false });
    this.form.controls.customCategoryName.setValue(name, { emitEvent: false });
    this.applyCategoryValidation();
  }

  private resolveCustomCategoryValidation(
    candidateName: string
  ): CategoryNameValidationResult {
    return validateCategoryName(
      candidateName,
      this.categories.map((category) => category.name)
    );
  }

  private get customCategoryValidation(): CategoryNameValidationResult {
    return this.resolveCustomCategoryValidation(
      this.form.controls.customCategoryName.value
    );
  }

  private resolveTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? getDeviceTimezone();
    } catch {
      return getDeviceTimezone();
    }
  }

  private resolveTodayIso(): string {
    return this.resolveTodayIsoForTimezone(this.resolveTimezone());
  }

  private resolveTomorrowIso(): string {
    return this.resolveTomorrowIsoForTimezone(this.resolveTimezone());
  }

  private resolveTodayIsoForTimezone(timezone: string): string {
    const today = formatCalendarDate(getToday(timezone));
    return this.calendarDateToIsoNoon(today);
  }

  private resolveTomorrowIsoForTimezone(timezone: string): string {
    const today = formatCalendarDate(getToday(timezone));
    const tomorrow = formatCalendarDate(addCalendarDays(today, 1));
    return this.calendarDateToIsoNoon(tomorrow);
  }

  private resolveCalendarDateKey(
    value: string | null | undefined,
    timezone: string
  ): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return formatCalendarDate(parseCalendarDate(trimmed));
    } catch {
      const parsed = this.parseDate(trimmed);
      if (!parsed) {
        return null;
      }

      try {
        return formatCalendarDate(toCalendarDate(parsed, timezone));
      } catch {
        return null;
      }
    }
  }

  private calendarDateToIsoNoon(value: string): string {
    const parsed = parseCalendarDate(value);
    return new Date(
      Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0)
    ).toISOString();
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

  private capitalizeLabel(value: string): string {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return normalized;
    }

    return `${normalized.charAt(0).toLocaleUpperCase(this.activeLocale)}${normalized.slice(1)}`;
  }

}
