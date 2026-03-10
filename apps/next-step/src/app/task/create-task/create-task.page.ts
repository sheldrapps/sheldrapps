import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { startWith } from 'rxjs';
import {
  CategoryRepository,
  TaskCategory,
} from '../../database/repositories/category.repository';
import {
  CreateTaskInput,
  NotificationTriggerMode,
  NotificationType,
  RecurrenceType,
  TaskMode,
  TaskRepository,
} from '../../database/repositories/task.repository';

interface WeekdayOption {
  bit: number;
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
    IonListHeader,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSegment,
    IonSegmentButton,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonDatetime,
    IonButton,
    IonCheckbox,
    IonNote,
  ],
})
export class CreateTaskPage {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly taskRepository = inject(TaskRepository);
  private readonly categoryRepository = inject(CategoryRepository);

  readonly weekdays: readonly WeekdayOption[] = [
    { bit: 1, labelKey: 'CREATE_TASK.WEEKDAY_MON' },
    { bit: 2, labelKey: 'CREATE_TASK.WEEKDAY_TUE' },
    { bit: 4, labelKey: 'CREATE_TASK.WEEKDAY_WED' },
    { bit: 8, labelKey: 'CREATE_TASK.WEEKDAY_THU' },
    { bit: 16, labelKey: 'CREATE_TASK.WEEKDAY_FRI' },
    { bit: 32, labelKey: 'CREATE_TASK.WEEKDAY_SAT' },
    { bit: 64, labelKey: 'CREATE_TASK.WEEKDAY_SUN' },
  ] as const;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    mode: this.fb.nonNullable.control<TaskMode>('check'),
    estimatedDurationMin: this.fb.control<number | null>(null),
    categoryId: this.fb.control<string | null>(null),
    recurrenceEnabled: this.fb.nonNullable.control(false),
    recurrenceType: this.fb.nonNullable.control<RecurrenceType>('none'),
    recurrenceStartDate: this.fb.nonNullable.control(new Date().toISOString()),
    recurrenceEndDate: this.fb.control<string | null>(null),
    recurrenceIntervalValue: this.fb.control<number | null>(null),
    recurrenceDayOfMonth: this.fb.control<number | null>(null),
    recurrenceMonthOfYear: this.fb.control<number | null>(null),
    notificationsEnabled: this.fb.nonNullable.control(false),
    notificationType: this.fb.nonNullable.control<NotificationType>('none'),
    notificationTriggerMode:
      this.fb.nonNullable.control<NotificationTriggerMode>('at_time'),
    notificationMinutesBefore: this.fb.control<number | null>(null),
  });

  categories: TaskCategory[] = [];
  selectedWeekdayMask = 0;
  submitAttempted = false;
  isSaving = false;
  saveFailed = false;

  constructor() {
    this.registerDynamicValidation();
    void this.loadCategories();
  }

  get isDurationMode(): boolean {
    return this.form.controls.mode.value === 'duration';
  }

  get recurrenceEnabled(): boolean {
    return this.form.controls.recurrenceEnabled.value;
  }

  get recurrenceType(): RecurrenceType {
    return this.form.controls.recurrenceType.value;
  }

  get notificationsEnabled(): boolean {
    return this.form.controls.notificationsEnabled.value;
  }

  get notificationTriggerMode(): NotificationTriggerMode {
    return this.form.controls.notificationTriggerMode.value;
  }

  get showWeeklyDayError(): boolean {
    return (
      this.submitAttempted &&
      this.recurrenceEnabled &&
      this.recurrenceType === 'weekly' &&
      this.selectedWeekdayMask === 0
    );
  }

  get saveDisabled(): boolean {
    return this.isSaving || this.form.invalid || this.showWeeklyDayError;
  }

  isWeekdaySelected(bit: number): boolean {
    return (this.selectedWeekdayMask & bit) !== 0;
  }

  onWeekdayToggle(bit: number, checked: boolean): void {
    if (checked) {
      this.selectedWeekdayMask |= bit;
      return;
    }

    this.selectedWeekdayMask &= ~bit;
  }

  async submit(): Promise<void> {
    this.submitAttempted = true;
    this.saveFailed = false;

    if (this.form.invalid || this.showWeeklyDayError) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    try {
      await this.taskRepository.createTask(this.buildCreateTaskInput());
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
      this.categories = await this.categoryRepository.listCategories();
    } catch {
      this.categories = [];
    }
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
        this.applyRecurrenceValidation();
      });

    this.form.controls.recurrenceType.valueChanges
      .pipe(
        startWith(this.form.controls.recurrenceType.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyRecurrenceValidation();
      });

    this.form.controls.notificationsEnabled.valueChanges
      .pipe(
        startWith(this.form.controls.notificationsEnabled.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyNotificationValidation();
      });

    this.form.controls.notificationTriggerMode.valueChanges
      .pipe(
        startWith(this.form.controls.notificationTriggerMode.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.applyNotificationValidation();
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

  private applyRecurrenceValidation(): void {
    const recurrenceStartDate = this.form.controls.recurrenceStartDate;
    const recurrenceIntervalValue = this.form.controls.recurrenceIntervalValue;
    const recurrenceDayOfMonth = this.form.controls.recurrenceDayOfMonth;
    const recurrenceMonthOfYear = this.form.controls.recurrenceMonthOfYear;

    recurrenceStartDate.clearValidators();
    recurrenceIntervalValue.clearValidators();
    recurrenceDayOfMonth.clearValidators();
    recurrenceMonthOfYear.clearValidators();

    if (this.form.controls.recurrenceEnabled.value) {
      recurrenceStartDate.setValidators([Validators.required]);

      if (this.recurrenceType === 'interval') {
        recurrenceIntervalValue.setValidators([
          Validators.required,
          Validators.min(1),
        ]);
      }

      if (this.recurrenceType === 'monthly' || this.recurrenceType === 'yearly') {
        recurrenceDayOfMonth.setValidators([
          Validators.required,
          Validators.min(1),
          Validators.max(31),
        ]);
      }

      if (this.recurrenceType === 'yearly') {
        recurrenceMonthOfYear.setValidators([
          Validators.required,
          Validators.min(1),
          Validators.max(12),
        ]);
      }
    } else {
      this.selectedWeekdayMask = 0;
    }

    recurrenceStartDate.updateValueAndValidity({ emitEvent: false });
    recurrenceIntervalValue.updateValueAndValidity({ emitEvent: false });
    recurrenceDayOfMonth.updateValueAndValidity({ emitEvent: false });
    recurrenceMonthOfYear.updateValueAndValidity({ emitEvent: false });
  }

  private applyNotificationValidation(): void {
    const notificationMinutesBefore = this.form.controls.notificationMinutesBefore;
    notificationMinutesBefore.clearValidators();

    if (
      this.form.controls.notificationsEnabled.value &&
      this.form.controls.notificationTriggerMode.value === 'before'
    ) {
      notificationMinutesBefore.setValidators([
        Validators.required,
        Validators.min(1),
      ]);
    }

    if (!this.form.controls.notificationsEnabled.value) {
      notificationMinutesBefore.setValue(null, { emitEvent: false });
    }

    notificationMinutesBefore.updateValueAndValidity({ emitEvent: false });
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
        ? {
            type: values.recurrenceType,
            intervalValue:
              values.recurrenceType === 'interval'
                ? values.recurrenceIntervalValue
                : null,
            daysOfWeekMask:
              values.recurrenceType === 'weekly'
                ? this.selectedWeekdayMask
                : null,
            dayOfMonth:
              values.recurrenceType === 'monthly' ||
              values.recurrenceType === 'yearly'
                ? values.recurrenceDayOfMonth
                : null,
            monthOfYear:
              values.recurrenceType === 'yearly'
                ? values.recurrenceMonthOfYear
                : null,
            startDate: values.recurrenceStartDate,
            endDate: values.recurrenceEndDate || null,
            timezone: this.resolveTimezone(),
          }
        : undefined,
      notification: values.notificationsEnabled
        ? {
            notificationType: values.notificationType,
            triggerMode: values.notificationTriggerMode,
            minutesBefore:
              values.notificationTriggerMode === 'before'
                ? values.notificationMinutesBefore
                : null,
          }
        : undefined,
    };
  }

  private resolveTimezone(): string | null {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      return null;
    }
  }
}
