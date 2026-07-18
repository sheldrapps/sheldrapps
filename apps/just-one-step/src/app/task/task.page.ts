import { ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  LoadingStateComponent,
  THEME_ACCENT_BACKGROUND_FALLBACK,
  THEME_ACCENT_COLOR_FALLBACK,
  withThemeAlpha,
} from '@sheldrapps/ui-theme';
import { addIcons } from 'ionicons';
import {
  createOutline,
} from 'ionicons/icons';
import {
  NotificationType,
  PersistedTaskAggregate,
  TaskRepository,
} from '../database/repositories/task.repository';

interface DayVisual {
  dayOfWeek: number;
  shortLabel: string;
  fullLabel: string;
  active: boolean;
  time: string | null;
}

interface ValidityVisual {
  startLabel: string;
  endLabel: string;
  progressPercent: number | null;
}

type ReminderPattern = 'daily' | 'selected_weekdays' | 'monthly' | 'yearly';

interface NotificationLeadTimePreset {
  value: number;
  labelKey: string;
  displayLabel?: string;
}

interface TaskVisualViewModel {
  title: string;
  categoryLabel: string;
  priorityCode: string;
  priorityLabel: string;
  durationLabel: string | null;
  schedulePatternLabel: string;
  scheduleRuleLabel: string | null;
  scheduleTimeLabel: string;
  scheduleCells: DayVisual[];
  showPerDayTimes: boolean;
  reminderTypeLabel: string;
  reminderOffsets: NotificationLeadTimePreset[];
  reminderHasNotifications: boolean;
  validity: ValidityVisual;
}

const REMINDER_DEFAULT_PRESETS: readonly NotificationLeadTimePreset[] = [
  { value: 60, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1H' },
  { value: 30, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_30M' },
  { value: 15, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_15M' },
  { value: 10, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_10M' },
  { value: 5, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_5M' },
] as const;

const REMINDER_MONTHLY_PRESETS: readonly NotificationLeadTimePreset[] = [
  { value: 10080, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1W' },
  { value: 4320, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_3D' },
  { value: 1440, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1D' },
  { value: 720, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_12H' },
  { value: 60, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1H' },
  { value: 30, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_30M' },
] as const;

const REMINDER_YEARLY_PRESETS: readonly NotificationLeadTimePreset[] = [
  { value: 43200, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1MO' },
  { value: 20160, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_2W' },
  { value: 10080, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1W' },
  { value: 4320, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_3D' },
  { value: 1440, labelKey: 'CREATE_TASK.NOTIFICATION_LEAD_TIME_1D' },
] as const;

@Component({
  standalone: true,
  selector: 'app-task',
  templateUrl: './task.page.html',
  styleUrls: ['./task.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonNote,
    RouterLink,
    TranslateModule,
    LoadingStateComponent,
  ],
})
export class TaskPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskRepository = inject(TaskRepository);
  private readonly alertController = inject(AlertController);
  private readonly translate = inject(TranslateService);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly taskId = this.route.snapshot.paramMap.get('id') ?? 'unknown';

  task: PersistedTaskAggregate | null = null;
  isLoading = false;
  loadFailed = false;
  updateFailed = false;

  constructor() {
    addIcons({ createOutline });
  }

  get isSampleTask(): boolean {
    return this.taskId === 'sample-task';
  }

  get categoryColor(): string {
    return this.task?.categoryColor ?? THEME_ACCENT_COLOR_FALLBACK;
  }

  get taskSurfaceBorderColor(): string {
    return this.categoryColor;
  }

  get taskSurfaceBackgroundColor(): string {
    return this.withAlpha(this.categoryColor, 0.09);
  }

  get taskSurfaceShadowColor(): string {
    return this.withAlpha(this.categoryColor, 0.11);
  }

  get visualModel(): TaskVisualViewModel | null {
    if (!this.task) {
      return null;
    }

    return this.buildVisualViewModel(this.task);
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadTask();
  }

  async toggleArchived(): Promise<void> {
    if (!this.task || this.isSampleTask) {
      return;
    }

    this.updateFailed = false;
    try {
      if (this.task.isArchived) {
        await this.taskRepository.unarchiveTask(this.task.id);
      } else {
        await this.taskRepository.archiveTask(this.task.id);
      }
      await this.loadTask();
    } catch {
      this.updateFailed = true;
    }
  }

  async toggleActive(): Promise<void> {
    if (!this.task || this.isSampleTask) {
      return;
    }

    this.updateFailed = false;
    try {
      await this.taskRepository.setTaskActive(this.task.id, !this.task.isActive);
      await this.loadTask();
    } catch {
      this.updateFailed = true;
    }
  }

  async confirmDeleteTask(): Promise<void> {
    if (!this.task || this.isSampleTask) {
      return;
    }

    const alert = await this.alertController.create({
      header: `${this.translate.instant('COMMON.DELETE')}: ${this.task.title}`,
      buttons: [
        {
          text: this.translate.instant('COMMON.CANCEL'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('COMMON.DELETE'),
          role: 'confirm',
        },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') {
      return;
    }

    this.updateFailed = false;
    try {
      await this.taskRepository.deleteTask(this.task.id);
      await this.router.navigate(['/tabs/tasks']);
    } catch {
      this.updateFailed = true;
    }
  }

  private async loadTask(): Promise<void> {
    this.isLoading = true;
    this.loadFailed = false;

    if (this.isSampleTask) {
      this.task = this.buildSampleTaskAggregate();
      this.isLoading = false;
      await this.flushUi();
      return;
    }

    try {
      const task = await this.taskRepository.getTaskById(this.taskId);
      this.task = task;
      if (!task) {
        this.loadFailed = true;
      }
    } catch {
      this.task = null;
      this.loadFailed = true;
    } finally {
      this.isLoading = false;
      await this.flushUi();
    }
  }

  private runInZone<T>(fn: () => T): T {
    return NgZone.isInAngularZone() ? fn() : this.zone.run(fn);
  }

  private async flushUi(): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }
    this.runInZone(() => {
      this.changeDetector.markForCheck();
      this.changeDetector.detectChanges();
    });
  }

  private buildSampleTaskAggregate(): PersistedTaskAggregate {
    const nowIso = new Date().toISOString();
    return {
      id: 'sample-task',
      title: this.translate.instant('TASKS.SAMPLE_TASK'),
      description: this.translate.instant('CREATE_TASK.DESCRIPTION_PLACEHOLDER'),
      trackingMode: 'duration',
      priority: 'B',
      scheduleType: 'recurring',
      recurrenceType: 'selected_weekdays',
      durationMode: 'single',
      oneTimeDate: null,
      oneTimeTime: null,
      estimatedDurationMin: 45,
      categoryId: 'cat-health-sample',
      categoryName: this.translate.instant('CREATE_TASK.DEFAULT_CATEGORY_HEALTH'),
      categoryColor: '#10B981',
      isActive: true,
      isArchived: false,
      deletedAt: null,
      recurrenceEnabled: true,
      notificationsEnabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      recurrence: {
        pattern: 'selected_weekdays',
        hasTime: true,
        sameTimeForSelectedDays: false,
        commonTime: '07:30',
        startsToday: false,
        startDate: '2026-03-24T07:30:00.000Z',
        hasEndDate: true,
        endDate: '2026-12-31T07:30:00.000Z',
        dayOfMonth: 15,
        yearMonth: 11,
        yearDay: 15,
        commonDurationMin: 45,
        timezone: null,
        weekdays: [
          { dayOfWeek: 1, weekdayBit: 1, timeValue: '07:15', durationMin: null },
          { dayOfWeek: 2, weekdayBit: 2, timeValue: '07:20', durationMin: null },
          { dayOfWeek: 3, weekdayBit: 4, timeValue: '07:25', durationMin: null },
          { dayOfWeek: 4, weekdayBit: 8, timeValue: '07:30', durationMin: null },
          { dayOfWeek: 5, weekdayBit: 16, timeValue: '07:35', durationMin: null },
          { dayOfWeek: 6, weekdayBit: 32, timeValue: '08:30', durationMin: null },
          { dayOfWeek: 7, weekdayBit: 64, timeValue: '09:00', durationMin: null },
        ],
      },
      notification: {
        notificationType: 'sound',
        triggerMode: 'before',
        offsets: [5, 10, 15, 30, 60],
        soundName: null,
        ttsText: null,
        repeatIfMissed: false,
      },
    };
  }

  private buildVisualViewModel(task: PersistedTaskAggregate): TaskVisualViewModel {
    const rhythmTimes = this.collectRhythmTimes(task);
    const dayVisuals = this.buildDayVisuals(task);
    const scheduleCells = dayVisuals.filter((day) => day.active);
    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    const reminderOffsets = this.collectReminderOffsets(task);
    const showPerDayTimes =
      (recurrence?.pattern === 'selected_weekdays' || recurrence?.pattern === 'daily') &&
      recurrence.hasTime &&
      !recurrence.sameTimeForSelectedDays &&
      scheduleCells.length > 0;

    return {
      title: task.title,
      categoryLabel: task.categoryName ?? this.translate.instant('CREATE_TASK.CATEGORY_NONE'),
      priorityCode: task.priority,
      priorityLabel: this.translate.instant(`TASK.PRIORITY.${task.priority}`),
      durationLabel:
        task.trackingMode === 'duration' && task.estimatedDurationMin
          ? `${task.estimatedDurationMin} ${this.translate.instant('TASK_DETAIL.MINUTES_SHORT')}`
          : this.translate.instant('TASK_DETAIL.TYPE_CHECK'),
      schedulePatternLabel: this.buildSchedulePatternLabel(task),
      scheduleRuleLabel: this.buildScheduleRuleLabel(task, scheduleCells),
      scheduleTimeLabel: this.buildScheduleTimeLabel(task, rhythmTimes),
      scheduleCells,
      showPerDayTimes,
      reminderTypeLabel: this.resolveReminderTypeLabel(task),
      reminderOffsets,
      reminderHasNotifications: task.notificationsEnabled && !!task.notification,
      validity: this.buildValidityVisual(task),
    };
  }

  private collectRhythmTimes(task: PersistedTaskAggregate): string[] {
    const timeSet = new Set<string>();

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence || !recurrence.hasTime) {
      return [];
    }

    if (recurrence.commonTime) {
      timeSet.add(recurrence.commonTime);
    }

    for (const weekday of recurrence.weekdays) {
      if (weekday.timeValue) {
        timeSet.add(weekday.timeValue);
      }
    }

    return Array.from(timeSet).sort((a, b) => a.localeCompare(b));
  }

  private buildScheduleTimeLabel(
    task: PersistedTaskAggregate,
    times: string[]
  ): string {
    if (task.scheduleType === 'one_time') {
      return task.oneTimeTime ?? this.translate.instant('TASK_DETAIL.VALUE_NO_TIME');
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence || !recurrence.hasTime) {
      return this.translate.instant('TASK_DETAIL.VALUE_NO_TIME');
    }

    if (recurrence.commonTime) {
      return recurrence.commonTime;
    }

    if (times.length === 1) {
      return times[0];
    }

    return `${times[0]} - ${times[times.length - 1]}`;
  }

  private buildSchedulePatternLabel(task: PersistedTaskAggregate): string {
    if (task.scheduleType === 'one_time') {
      return this.translate.instant('TASK_DETAIL.VALUE_NO_RECURRENCE');
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence) {
      return this.translate.instant('TASK_DETAIL.VALUE_NO_RECURRENCE');
    }

    switch (recurrence.pattern) {
      case 'daily':
        return this.translate.instant('CREATE_TASK.REPEAT_PATTERN_DAILY');
      case 'monthly':
        return this.translate.instant('CREATE_TASK.REPEAT_PATTERN_MONTHLY');
      case 'yearly':
        return this.translate.instant('CREATE_TASK.REPEAT_PATTERN_YEARLY');
      case 'selected_weekdays': {
        return this.translate.instant('CREATE_TASK.REPEAT_PATTERN_SELECTED_WEEKDAYS');
      }
      default:
        return this.translate.instant('TASK_DETAIL.VALUE_SPECIFIC_DAYS');
    }
  }

  private buildScheduleRuleLabel(
    task: PersistedTaskAggregate,
    scheduleCells: DayVisual[]
  ): string | null {
    if (task.scheduleType === 'one_time') {
      return task.oneTimeDate ? this.formatDateShort(task.oneTimeDate) : null;
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence) {
      return null;
    }

    switch (recurrence.pattern) {
      case 'daily':
        return null;
      case 'monthly':
        if (recurrence.dayOfMonth) {
          return `${this.translate.instant('TASK_DETAIL.LABEL_DAY')} ${recurrence.dayOfMonth}`;
        }
        return this.translate.instant('TASK_DETAIL.VALUE_SPECIFIC_DAYS');
      case 'yearly':
        if (recurrence.yearMonth && recurrence.yearDay) {
          return this.formatYearlyRule(recurrence.yearMonth, recurrence.yearDay);
        }
        return this.translate.instant('TASK_DETAIL.VALUE_SPECIFIC_DAYS');
      case 'selected_weekdays': {
        const activeDays = scheduleCells.map((day) => day.dayOfWeek);
        if (activeDays.length === 7) {
          return null;
        }

        const isWeekdaysOnly =
          activeDays.length === 5 && activeDays.every((dayOfWeek, index) => dayOfWeek === index + 1);

        if (isWeekdaysOnly) {
          return this.translate.instant('TASK_DETAIL.VALUE_WEEKDAYS_SHORT');
        }

        if (scheduleCells.length > 0) {
          return scheduleCells.map((day) => day.shortLabel).join(', ');
        }

        return this.translate.instant('TASK_DETAIL.VALUE_SPECIFIC_DAYS');
      }
      default:
        return this.translate.instant('TASK_DETAIL.VALUE_SPECIFIC_DAYS');
    }
  }

  private buildDayVisuals(task: PersistedTaskAggregate): DayVisual[] {
    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;

    const weekdayMap = new Map<number, string | null>();
    if (recurrence && recurrence.hasTime) {
      for (const weekday of recurrence.weekdays) {
        weekdayMap.set(weekday.dayOfWeek, weekday.timeValue ?? recurrence.commonTime ?? null);
      }
    }

    const activeDays = new Set<number>();
    if (!recurrence) {
      // no recurrence -> no active day highlight
    } else if (recurrence.pattern === 'selected_weekdays') {
      for (const weekday of recurrence.weekdays) {
        activeDays.add(weekday.dayOfWeek);
      }
    } else if (recurrence.pattern === 'daily') {
      for (let day = 1; day <= 7; day += 1) {
        activeDays.add(day);
        if (!weekdayMap.has(day) && recurrence.hasTime && recurrence.commonTime) {
          weekdayMap.set(day, recurrence.commonTime);
        }
      }
    }

    const visuals: DayVisual[] = [];
    for (let day = 1; day <= 7; day += 1) {
      visuals.push({
        dayOfWeek: day,
        shortLabel: this.shortWeekdayLabel(day),
        fullLabel: this.longWeekdayLabel(day),
        active: activeDays.has(day),
        time: weekdayMap.get(day) ?? null,
      });
    }

    return visuals;
  }

  private resolveReminderTypeLabel(task: PersistedTaskAggregate): string {
    if (!task.notificationsEnabled || !task.notification) {
      return this.translate.instant('TASK_DETAIL.REMINDER_NONE');
    }

    return this.translate.instant(this.resolveNotificationTypeKey(task.notification.notificationType));
  }

  private collectReminderOffsets(task: PersistedTaskAggregate): NotificationLeadTimePreset[] {
    if (!task.notificationsEnabled || !task.notification || task.notification.triggerMode !== 'before') {
      return [];
    }

    const presetsByValue = new Map<number, NotificationLeadTimePreset>();
    for (const preset of this.getReminderPresetsForTask(task)) {
      presetsByValue.set(preset.value, preset);
    }

    return task.notification.offsets
      .slice()
      .sort((a, b) => b - a)
      .filter((offset) => presetsByValue.has(offset))
      .map((offset) => presetsByValue.get(offset) as NotificationLeadTimePreset);
  }

  private getReminderPresetsForTask(
    task: PersistedTaskAggregate
  ): readonly NotificationLeadTimePreset[] {
    const pattern = this.resolveReminderPattern(task);

    if (pattern === 'yearly') {
      return REMINDER_YEARLY_PRESETS;
    }

    if (pattern === 'monthly') {
      return REMINDER_MONTHLY_PRESETS;
    }

    return REMINDER_DEFAULT_PRESETS;
  }

  private resolveReminderPattern(task: PersistedTaskAggregate): ReminderPattern {
    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence) {
      return 'daily';
    }

    switch (recurrence.pattern) {
      case 'selected_weekdays':
      case 'monthly':
      case 'yearly':
        return recurrence.pattern;
      default:
        return 'daily';
    }
  }

  private buildValidityVisual(task: PersistedTaskAggregate): ValidityVisual {
    if (task.scheduleType === 'one_time') {
      const dateLabel = task.oneTimeDate
        ? this.formatDateShort(task.oneTimeDate)
        : this.translate.instant('TASK_DETAIL.VALUE_IMMEDIATE');
      return {
        startLabel: dateLabel,
        endLabel: dateLabel,
        progressPercent: null,
      };
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence) {
      return {
        startLabel: this.translate.instant('TASK_DETAIL.VALUE_IMMEDIATE'),
        endLabel: this.translate.instant('TASK_DETAIL.VALUE_NEVER'),
        progressPercent: null,
      };
    }

    const startDate = recurrence.startDate;
    const endDate = recurrence.hasEndDate ? recurrence.endDate : null;
    const startLabel = recurrence.startsToday
      ? this.translate.instant('TASK_DETAIL.VALUE_TODAY')
      : this.formatDateShort(startDate);
    const endLabel = recurrence.hasEndDate && endDate
      ? this.formatDateShort(endDate)
      : this.translate.instant('TASK_DETAIL.VALUE_NEVER');

    return {
      startLabel,
      endLabel,
      progressPercent: this.calculateProgressPercent(startDate, endDate),
    };
  }

  private calculateProgressPercent(startIso: string, endIso: string | null): number | null {
    if (!endIso) {
      return null;
    }

    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const now = Date.now();

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return null;
    }

    const raw = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  private resolveNotificationTypeKey(type: NotificationType): string {
    switch (type) {
      case 'tts':
        return 'CREATE_TASK.NOTIFICATION_TTS';
      case 'sound':
        return 'CREATE_TASK.NOTIFICATION_SOUND';
      case 'vibration':
        return 'CREATE_TASK.NOTIFICATION_VIBRATION';
      case 'popup':
        return 'CREATE_TASK.NOTIFICATION_POPUP';
      case 'fullscreen':
        return 'CREATE_TASK.NOTIFICATION_FULLSCREEN';
      case 'none':
      default:
        return 'CREATE_TASK.NOTIFICATION_NONE';
    }
  }

  private formatDateShort(value: string): string {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    const locale = this.translate.currentLang || this.translate.getDefaultLang() || 'en-US';
    return parsedDate.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private longWeekdayLabel(dayOfWeek: number): string {
    switch (dayOfWeek) {
      case 1:
        return this.translate.instant('CREATE_TASK.WEEKDAY_MON');
      case 2:
        return this.translate.instant('CREATE_TASK.WEEKDAY_TUE');
      case 3:
        return this.translate.instant('CREATE_TASK.WEEKDAY_WED');
      case 4:
        return this.translate.instant('CREATE_TASK.WEEKDAY_THU');
      case 5:
        return this.translate.instant('CREATE_TASK.WEEKDAY_FRI');
      case 6:
        return this.translate.instant('CREATE_TASK.WEEKDAY_SAT');
      case 7:
        return this.translate.instant('CREATE_TASK.WEEKDAY_SUN');
      default:
        return this.translate.instant('CREATE_TASK.WEEKDAY_MON');
    }
  }

  private shortWeekdayLabel(dayOfWeek: number): string {
    const locale = this.translate.currentLang || this.translate.getDefaultLang() || 'en-US';
    const monday = new Date(Date.UTC(2026, 2, 2));
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + (dayOfWeek - 1));
    const value = date.toLocaleDateString(locale, { weekday: 'short' });
    return value.replace('.', '');
  }

  private formatYearlyRule(month: number, day: number): string {
    const locale = this.translate.currentLang || this.translate.getDefaultLang() || 'en-US';
    const date = new Date(Date.UTC(2026, month - 1, day));
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  }

  timeDigits(time: string | null): { h: string; m: string } {
    if (time) {
      const sep = time.indexOf(':');
      if (sep > 0) {
        return { h: time.slice(0, sep), m: time.slice(sep + 1) };
      }
    }

    return { h: '--', m: '--' };
  }

  private withAlpha(hexColor: string, alpha: number): string {
    return withThemeAlpha(hexColor, alpha, THEME_ACCENT_BACKGROUND_FALLBACK);
  }
}
