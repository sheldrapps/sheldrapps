import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  NativeSqliteManager,
  SqliteTransactionContext,
} from '@sheldrapps/native-sqlite-kit';

export type TaskMode = 'check' | 'duration';
export type RecurrenceType =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'interval';
export type NotificationType =
  | 'tts'
  | 'sound'
  | 'vibration'
  | 'popup'
  | 'fullscreen'
  | 'none';
export type NotificationTriggerMode = 'at_time' | 'before' | 'manual_only';

export interface CreateTaskRecurrenceInput {
  type: RecurrenceType;
  intervalValue?: number | null;
  daysOfWeekMask?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  timeOfDay?: string | null;
  startDate: string;
  endDate?: string | null;
  timezone?: string | null;
}

export interface CreateTaskNotificationInput {
  notificationType: NotificationType;
  triggerMode: NotificationTriggerMode;
  minutesBefore?: number | null;
  soundName?: string | null;
  ttsText?: string | null;
  repeatIfMissed?: boolean;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  mode: TaskMode;
  estimatedDurationMin?: number | null;
  categoryId?: string | null;
  recurrence?: CreateTaskRecurrenceInput;
  notification?: CreateTaskNotificationInput;
}

@Injectable({ providedIn: 'root' })
export class TaskRepository {
  private readonly sqliteManager = inject(NativeSqliteManager);

  async createTask(input: CreateTaskInput): Promise<string> {
    await this.ensureSqliteReady();

    const taskId = this.createUuid('task');
    const nowIso = new Date().toISOString();

    await this.sqliteManager.runInTransaction(async (tx) => {
      await this.insertTask(tx, taskId, input, nowIso);

      if (input.recurrence) {
        await this.insertRecurrence(tx, taskId, input.recurrence);
      }

      if (input.notification) {
        await this.insertNotification(tx, taskId, input.notification, nowIso);
      }
    });

    return taskId;
  }

  private async ensureSqliteReady(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('Native SQLite is only available on Android runtime.');
    }

    if (!this.sqliteManager.isReady()) {
      await this.sqliteManager.initialize();
    }
  }

  private async insertTask(
    tx: SqliteTransactionContext,
    taskId: string,
    input: CreateTaskInput,
    nowIso: string
  ): Promise<void> {
    await tx.execute(
      `
        INSERT INTO tasks (
          id,
          title,
          description,
          mode,
          estimated_duration_min,
          is_active,
          category_id,
          created_at,
          updated_at,
          archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        input.title.trim(),
        input.description?.trim() || null,
        input.mode,
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
        1,
        input.categoryId ?? null,
        nowIso,
        nowIso,
        null,
      ]
    );
  }

  private async insertRecurrence(
    tx: SqliteTransactionContext,
    taskId: string,
    recurrence: CreateTaskRecurrenceInput
  ): Promise<void> {
    await tx.execute(
      `
        INSERT INTO task_recurrences (
          id,
          task_id,
          type,
          interval_value,
          days_of_week_mask,
          day_of_month,
          month_of_year,
          time_of_day,
          start_date,
          end_date,
          timezone,
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        this.createUuid('recurrence'),
        taskId,
        recurrence.type,
        recurrence.intervalValue ?? null,
        recurrence.daysOfWeekMask ?? null,
        recurrence.dayOfMonth ?? null,
        recurrence.monthOfYear ?? null,
        recurrence.timeOfDay ?? null,
        recurrence.startDate,
        recurrence.endDate ?? null,
        recurrence.timezone ?? null,
        1,
      ]
    );
  }

  private async insertNotification(
    tx: SqliteTransactionContext,
    taskId: string,
    notification: CreateTaskNotificationInput,
    nowIso: string
  ): Promise<void> {
    await tx.execute(
      `
        INSERT INTO task_notifications (
          id,
          task_id,
          notification_type,
          trigger_mode,
          minutes_before,
          is_enabled,
          sound_name,
          tts_text,
          repeat_if_missed,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        this.createUuid('notification'),
        taskId,
        notification.notificationType,
        notification.triggerMode,
        notification.minutesBefore ?? null,
        1,
        notification.soundName ?? null,
        notification.ttsText ?? null,
        notification.repeatIfMissed ? 1 : 0,
        nowIso,
        nowIso,
      ]
    );
  }

  private createUuid(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch {
        // Falls back when randomUUID is unavailable at runtime.
      }
    }

    return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  }
}
