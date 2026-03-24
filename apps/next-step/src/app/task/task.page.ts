import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  archiveOutline,
  createOutline,
  pauseOutline,
  playOutline,
  trashOutline,
} from 'ionicons/icons';
import {
  PersistedTaskAggregate,
  SimpleRecurrenceType,
  TaskRepository,
} from '../database/repositories/task.repository';

@Component({
  standalone: true,
  selector: 'app-task',
  templateUrl: './task.page.html',
  styleUrls: ['./task.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonButton,
    IonIcon,
    IonNote,
    RouterLink,
    TranslateModule,
  ],
})
export class TaskPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskRepository = inject(TaskRepository);
  private readonly alertController = inject(AlertController);
  private readonly translate = inject(TranslateService);

  readonly taskId = this.route.snapshot.paramMap.get('id') ?? 'unknown';

  task: PersistedTaskAggregate | null = null;
  isLoading = false;
  loadFailed = false;
  updateFailed = false;

  constructor() {
    addIcons({ createOutline, archiveOutline, pauseOutline, playOutline, trashOutline });
  }

  get isSampleTask(): boolean {
    return this.taskId === 'sample-task';
  }

  get categoryColor(): string {
    return this.task?.categoryColor ?? '#64748B';
  }

  get taskSurfaceBorderStyle(): string {
    return `2px solid ${this.categoryColor}`;
  }

  get taskSurfaceBackgroundStyle(): string {
    return this.withAlpha(this.categoryColor, 0.11);
  }

  get taskSurfaceShadowStyle(): string {
    return `0 0 0 1px ${this.withAlpha(this.categoryColor, 0.12)}`;
  }

  get trackingModeKey(): string {
    if (!this.task) {
      return 'CREATE_TASK.MODE_CHECK';
    }
    return this.task.trackingMode === 'duration'
      ? 'CREATE_TASK.MODE_DURATION'
      : 'CREATE_TASK.MODE_CHECK';
  }

  get recurrencePatternKey(): string {
    const pattern = this.task?.recurrence?.pattern;
    return this.resolveRecurrencePatternKey(pattern ?? 'daily');
  }

  get notificationTypeKey(): string {
    const type = this.task?.notification?.notificationType;
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
      default:
        return 'CREATE_TASK.NOTIFICATION_SOUND';
    }
  }

  get notificationTriggerModeKey(): string {
    const mode = this.task?.notification?.triggerMode;
    if (mode === 'before') {
      return 'CREATE_TASK.TRIGGER_BEFORE';
    }
    if (mode === 'manual_only') {
      return 'CREATE_TASK.TRIGGER_NO_AUTOMATIC';
    }
    return 'CREATE_TASK.TRIGGER_AT_TIME';
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

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return parsedDate.toLocaleString();
  }

  booleanGlyph(value: boolean): string {
    return value ? '\u2713' : '\u2717';
  }

  weekdayLabelKey(dayOfWeek: number): string {
    switch (dayOfWeek) {
      case 1:
        return 'CREATE_TASK.WEEKDAY_MON';
      case 2:
        return 'CREATE_TASK.WEEKDAY_TUE';
      case 3:
        return 'CREATE_TASK.WEEKDAY_WED';
      case 4:
        return 'CREATE_TASK.WEEKDAY_THU';
      case 5:
        return 'CREATE_TASK.WEEKDAY_FRI';
      case 6:
        return 'CREATE_TASK.WEEKDAY_SAT';
      case 7:
        return 'CREATE_TASK.WEEKDAY_SUN';
      default:
        return 'CREATE_TASK.WEEKDAY_MON';
    }
  }

  private async loadTask(): Promise<void> {
    this.isLoading = true;
    this.loadFailed = false;

    if (this.isSampleTask) {
      this.task = this.buildSampleTaskAggregate();
      this.isLoading = false;
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
    }
  }

  private buildSampleTaskAggregate(): PersistedTaskAggregate {
    const nowIso = new Date().toISOString();
    return {
      id: 'sample-task',
      title: this.translate.instant('TASKS.SAMPLE_TASK'),
      description: this.translate.instant('CREATE_TASK.DESCRIPTION_PLACEHOLDER'),
      trackingMode: 'duration',
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
        timezone: null,
        weekdays: [
          { dayOfWeek: 1, weekdayBit: 1, timeValue: '07:15' },
          { dayOfWeek: 2, weekdayBit: 2, timeValue: '07:20' },
          { dayOfWeek: 3, weekdayBit: 4, timeValue: '07:25' },
          { dayOfWeek: 4, weekdayBit: 8, timeValue: '07:30' },
          { dayOfWeek: 5, weekdayBit: 16, timeValue: '07:35' },
          { dayOfWeek: 6, weekdayBit: 32, timeValue: '08:30' },
          { dayOfWeek: 7, weekdayBit: 64, timeValue: '09:00' },
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

  private resolveRecurrencePatternKey(pattern: SimpleRecurrenceType): string {
    switch (pattern) {
      case 'selected_weekdays':
        return 'CREATE_TASK.REPEAT_PATTERN_SELECTED_WEEKDAYS';
      case 'monthly':
        return 'CREATE_TASK.REPEAT_PATTERN_MONTHLY';
      case 'yearly':
        return 'CREATE_TASK.REPEAT_PATTERN_YEARLY';
      case 'daily':
      default:
        return 'CREATE_TASK.REPEAT_PATTERN_DAILY';
    }
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
    if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
