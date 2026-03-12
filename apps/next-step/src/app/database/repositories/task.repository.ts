
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  NativeSqliteManager,
  SqliteTransactionContext,
} from '@sheldrapps/native-sqlite-kit';

export type TaskMode = 'check' | 'duration';
export type RecurrenceMode = 'simple' | 'weekly_schedule';
export type SimpleRecurrenceType =
  | 'daily'
  | 'selected_weekdays'
  | 'monthly'
  | 'yearly';
export type NotificationType =
  | 'tts'
  | 'sound'
  | 'vibration'
  | 'popup'
  | 'fullscreen'
  | 'none';
export type NotificationTriggerMode = 'at_time' | 'before' | 'manual_only';

export interface WeeklyScheduleSlotInput {
  dayOfWeek: number;
  time: string;
}

export interface CreateTaskRecurrenceInput {
  mode: RecurrenceMode;
  simpleType?: SimpleRecurrenceType;
  daysOfWeekMask?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  timeOfDay?: string | null;
  weeklyDayTimes?: WeeklyScheduleSlotInput[];
  hasTime?: boolean;
  sameTimeForSelectedDays?: boolean;
  startsToday?: boolean;
  hasEndDate?: boolean;
  startDate: string;
  endDate?: string | null;
  timezone?: string | null;
}

export interface CreateTaskNotificationInput {
  notificationType: NotificationType;
  triggerMode: NotificationTriggerMode;
  notificationOffsets?: number[] | null;
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

export type UpdateTaskInput = CreateTaskInput;

export interface TaskListFilters {
  categoryId?: string | null;
  searchText?: string | null;
  limit?: number | null;
  offset?: number | null;
}

export interface TaskListItem {
  id: string;
  title: string;
  description: string | null;
  trackingMode: TaskMode;
  estimatedDurationMin: number | null;
  categoryId: string | null;
  recurrenceEnabled: boolean;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedTaskAggregate extends TaskListItem {
  recurrence?: {
    pattern: SimpleRecurrenceType;
    hasTime: boolean;
    sameTimeForSelectedDays: boolean;
    commonTime: string | null;
    startsToday: boolean;
    startDate: string;
    hasEndDate: boolean;
    endDate: string | null;
    dayOfMonth: number | null;
    yearMonth: number | null;
    yearDay: number | null;
    timezone: string | null;
    weekdays: Array<{ dayOfWeek: number; weekdayBit: number; timeValue: string | null }>;
  };
  notification?: {
    notificationType: Exclude<NotificationType, 'none'>;
    triggerMode: NotificationTriggerMode;
    offsets: number[];
    soundName: string | null;
    ttsText: string | null;
    repeatIfMissed: boolean;
  };
}

interface TaskRow extends Record<string, unknown> {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  tracking_mode: string;
  estimated_duration_min: number | null;
  is_recurrence_enabled: number;
  is_notifications_enabled: number;
  created_at: string;
  updated_at: string;
}

interface TaskRecurrenceRow extends Record<string, unknown> {
  pattern: string;
  has_time: number;
  same_time_for_selected_days: number;
  common_time: string | null;
  starts_today: number;
  start_date: string;
  has_end_date: number;
  end_date: string | null;
  day_of_month: number | null;
  year_month: number | null;
  year_day: number | null;
  timezone: string | null;
}

interface TaskRecurrenceWeekdayRow extends Record<string, unknown> {
  weekday_index: number;
  time_value: string | null;
}

interface TaskNotificationRow extends Record<string, unknown> {
  notification_type: string;
  trigger_mode: string;
  sound_name: string | null;
  tts_text: string | null;
  repeat_if_missed: number;
}

interface TaskNotificationOffsetRow extends Record<string, unknown> {
  offset_minutes: number;
}

interface PersistedRecurrenceWeekday {
  dayOfWeek: number;
  timeValue: string | null;
}

interface PersistedRecurrenceState {
  pattern: SimpleRecurrenceType;
  hasTime: boolean;
  sameTimeForSelectedDays: boolean;
  commonTime: string | null;
  startsToday: boolean;
  startDate: string;
  hasEndDate: boolean;
  endDate: string | null;
  dayOfMonth: number | null;
  yearMonth: number | null;
  yearDay: number | null;
  timezone: string | null;
  weekdays: PersistedRecurrenceWeekday[];
}

@Injectable({ providedIn: 'root' })
export class TaskRepository {
  private readonly sqliteManager = inject(NativeSqliteManager);

  async createTask(input: CreateTaskInput): Promise<string> {
    await this.ensureSqliteReady();

    const normalizedInput = this.sanitizeCreateTaskInput(input);
    const taskId = this.createUuid('task');
    const nowIso = new Date().toISOString();

    await this.sqliteManager.runInTransaction(async (tx) => {
      await this.insertTask(tx, taskId, normalizedInput, nowIso);
      await this.persistTaskBranches(tx, taskId, normalizedInput, nowIso);
    });

    return taskId;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
    await this.ensureSqliteReady();
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      throw new Error('Task id is required.');
    }

    const existingRows = await this.sqliteManager.query<{ id: string }>(
      `
        SELECT id
        FROM tasks
        WHERE id = ?
        LIMIT 1
      `,
      [normalizedTaskId]
    );
    if (!existingRows[0]) {
      throw new Error(`Task not found: ${normalizedTaskId}`);
    }

    const normalizedInput = this.sanitizeCreateTaskInput(input);
    const nowIso = new Date().toISOString();

    await this.sqliteManager.runInTransaction(async (tx) => {
      await this.updateTaskRow(tx, normalizedTaskId, normalizedInput, nowIso);
      await this.deleteTaskBranches(tx, normalizedTaskId);
      await this.persistTaskBranches(tx, normalizedTaskId, normalizedInput, nowIso);
    });
  }

  async getTaskById(taskId: string): Promise<PersistedTaskAggregate | null> {
    await this.ensureSqliteReady();
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return null;
    }

    return this.loadTaskAggregate(normalizedTaskId);
  }

  async getTaskAggregate(taskId: string): Promise<PersistedTaskAggregate | null> {
    return this.getTaskById(taskId);
  }

  async listTasks(filters: TaskListFilters = {}): Promise<TaskListItem[]> {
    await this.ensureSqliteReady();

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    const categoryId = this.normalizeNullableText(filters.categoryId);
    const searchText = this.normalizeNullableText(filters.searchText);

    if (categoryId) {
      whereClauses.push('category_id = ?');
      params.push(categoryId);
    }

    if (searchText) {
      const searchLike = `%${searchText}%`;
      whereClauses.push('(title LIKE ? OR description LIKE ?)');
      params.push(searchLike, searchLike);
    }
    const limit = this.sanitizeBoundedInteger(filters.limit, 1, 500) ?? 100;
    const offset = this.sanitizeBoundedInteger(filters.offset, 0, 1_000_000) ?? 0;
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = await this.sqliteManager.query<TaskRow>(
      `
        SELECT
          id,
          title,
          description,
          category_id,
          tracking_mode,
          estimated_duration_min,
          is_recurrence_enabled,
          is_notifications_enabled,
          created_at,
          updated_at
        FROM tasks
        ${whereSql}
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.mapTaskListItem(row));
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.ensureSqliteReady();
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }

    await this.sqliteManager.runInTransaction(async (tx) => {
      await tx.execute(
        `
          DELETE FROM tasks
          WHERE id = ?
        `,
        [normalizedTaskId]
      );
    });
  }

  private async loadTaskAggregate(taskId: string): Promise<PersistedTaskAggregate | null> {
    const taskRows = await this.sqliteManager.query<TaskRow>(
      `
        SELECT
          id,
          title,
          description,
          category_id,
          tracking_mode,
          estimated_duration_min,
          is_recurrence_enabled,
          is_notifications_enabled,
          created_at,
          updated_at
        FROM tasks
        WHERE id = ?
        LIMIT 1
      `,
      [taskId]
    );
    const taskRow = taskRows[0];
    if (!taskRow) {
      return null;
    }

    const recurrenceRows = await this.sqliteManager.query<TaskRecurrenceRow>(
      `
        SELECT
          pattern,
          has_time,
          same_time_for_selected_days,
          common_time,
          starts_today,
          start_date,
          has_end_date,
          end_date,
          day_of_month,
          year_month,
          year_day,
          timezone
        FROM task_recurrence
        WHERE task_id = ?
        LIMIT 1
      `,
      [taskId]
    );

    const recurrenceWeekdayRows = await this.sqliteManager.query<TaskRecurrenceWeekdayRow>(
      `
        SELECT
          weekday_index,
          time_value
        FROM task_recurrence_weekdays
        WHERE task_id = ?
        ORDER BY weekday_index ASC
      `,
      [taskId]
    );

    const notificationRows = await this.sqliteManager.query<TaskNotificationRow>(
      `
        SELECT
          notification_type,
          trigger_mode,
          sound_name,
          tts_text,
          repeat_if_missed
        FROM task_notifications
        WHERE task_id = ?
        LIMIT 1
      `,
      [taskId]
    );

    const notificationOffsetRows = await this.sqliteManager.query<TaskNotificationOffsetRow>(
      `
        SELECT offset_minutes
        FROM task_notification_offsets
        WHERE task_id = ?
        ORDER BY sort_order ASC, offset_minutes ASC
      `,
      [taskId]
    );

    const recurrence = this.buildCanonicalRecurrence(
      recurrenceRows[0],
      recurrenceWeekdayRows
    );
    const notification = this.buildCanonicalNotification(
      notificationRows[0],
      notificationOffsetRows
    );

    return {
      ...this.mapTaskListItem(taskRow),
      recurrenceEnabled: recurrence !== undefined,
      notificationsEnabled: notification !== undefined,
      recurrence,
      notification,
    };
  }

  private mapTaskListItem(row: TaskRow): TaskListItem {
    return {
      id: row.id,
      title: row.title,
      description: this.normalizeNullableText(row.description),
      trackingMode: this.normalizeTaskMode(row.tracking_mode),
      estimatedDurationMin: this.toNullableNumber(row.estimated_duration_min),
      categoryId: this.normalizeNullableText(row.category_id),
      recurrenceEnabled: this.toBooleanFlag(row.is_recurrence_enabled),
      notificationsEnabled: this.toBooleanFlag(row.is_notifications_enabled),
      createdAt: this.resolveIsoDate(row.created_at) ?? new Date(0).toISOString(),
      updatedAt: this.resolveIsoDate(row.updated_at) ?? new Date(0).toISOString(),
    };
  }

  private async ensureSqliteReady(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      throw new Error('Native SQLite is only available on Android runtime.');
    }

    if (!this.sqliteManager.isReady()) {
      await this.sqliteManager.initialize();
    }
  }

  private sanitizeCreateTaskInput(input: CreateTaskInput): CreateTaskInput {
    const title = input.title.trim();
    if (title.length === 0) {
      throw new Error('Task title is required.');
    }

    const mode = this.normalizeTaskMode(input.mode);
    const estimatedDurationMin =
      mode === 'duration'
        ? this.sanitizeBoundedInteger(input.estimatedDurationMin, 1, 1440)
        : null;

    return {
      title,
      description: this.normalizeNullableText(input.description),
      mode,
      estimatedDurationMin,
      categoryId: this.normalizeNullableText(input.categoryId),
      recurrence: this.sanitizeRecurrenceInput(input.recurrence),
      notification: this.sanitizeNotificationInput(input.notification),
    };
  }

  private sanitizeRecurrenceInput(
    recurrence?: CreateTaskRecurrenceInput
  ): CreateTaskRecurrenceInput | undefined {
    if (!recurrence) {
      return undefined;
    }

    const startDateSeed = this.resolveIsoDate(recurrence.startDate);
    const startsToday = recurrence.startsToday ?? this.isTodayDate(startDateSeed);
    const startDate = this.resolvePersistedStartDate(startsToday, startDateSeed);
    const parsedEndDate = this.resolveIsoDate(recurrence.endDate ?? null);
    const hasEndDate =
      (recurrence.hasEndDate ?? parsedEndDate !== null) && parsedEndDate !== null;
    const timezone = this.normalizeNullableText(recurrence.timezone);
    if (recurrence.mode === 'weekly_schedule') {
      const weeklyDayTimes = this.normalizeWeeklyDayTimes(recurrence.weeklyDayTimes ?? []);
      if (weeklyDayTimes.length === 0) {
        throw new Error('Selected weekdays recurrence requires at least one day.');
      }

      return {
        mode: 'weekly_schedule',
        weeklyDayTimes: weeklyDayTimes.map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          time: entry.timeValue ?? '',
        })),
        hasTime: true,
        sameTimeForSelectedDays: false,
        startsToday,
        hasEndDate,
        startDate,
        endDate: hasEndDate ? parsedEndDate : null,
        timezone,
      };
    }

    const simpleType = this.normalizeSimplePattern(recurrence.simpleType);
    const normalizedTime = this.normalizeTimeValue(recurrence.timeOfDay ?? '');
    const hasTime =
      (recurrence.hasTime ?? normalizedTime !== null) && normalizedTime !== null;
    const sameTimeForSelectedDays =
      simpleType === 'selected_weekdays' && hasTime
        ? recurrence.sameTimeForSelectedDays ?? true
        : true;
    const resolvedDateParts = this.resolveSimpleRecurrenceDateParts(simpleType, startDate);

    let daysOfWeekMask: number | null = null;
    let dayOfMonth: number | null = null;
    let monthOfYear: number | null = null;

    if (simpleType === 'selected_weekdays') {
      daysOfWeekMask = this.sanitizeWeekdayMask(recurrence.daysOfWeekMask);
      if (!daysOfWeekMask) {
        throw new Error('Selected weekdays recurrence requires at least one day.');
      }
    } else if (simpleType === 'monthly') {
      dayOfMonth =
        this.sanitizeBoundedInteger(recurrence.dayOfMonth, 1, 31) ??
        resolvedDateParts.dayOfMonth;
    } else if (simpleType === 'yearly') {
      dayOfMonth =
        this.sanitizeBoundedInteger(recurrence.dayOfMonth, 1, 31) ??
        resolvedDateParts.dayOfMonth;
      monthOfYear =
        this.sanitizeBoundedInteger(recurrence.monthOfYear, 1, 12) ??
        resolvedDateParts.monthOfYear;
    }

    return {
      mode: 'simple',
      simpleType,
      daysOfWeekMask,
      dayOfMonth,
      monthOfYear,
      timeOfDay: hasTime ? normalizedTime : null,
      hasTime,
      sameTimeForSelectedDays,
      startsToday,
      hasEndDate,
      startDate,
      endDate: hasEndDate ? parsedEndDate : null,
      timezone,
    };
  }

  private sanitizeNotificationInput(
    notification?: CreateTaskNotificationInput
  ): CreateTaskNotificationInput | undefined {
    if (!notification) {
      return undefined;
    }

    const notificationType = this.normalizeNotificationType(
      notification.notificationType
    );
    const triggerMode = this.normalizeTriggerMode(notification.triggerMode);
    const normalized: CreateTaskNotificationInput = {
      notificationType,
      triggerMode,
      notificationOffsets: null,
      soundName: this.normalizeNullableText(notification.soundName),
      ttsText: this.normalizeNullableText(notification.ttsText),
      repeatIfMissed: Boolean(notification.repeatIfMissed),
    };

    if (triggerMode !== 'before') {
      return normalized;
    }

    const offsets = this.normalizeOffsets(notification.notificationOffsets ?? []);
    if (offsets.length === 0) {
      throw new Error(
        'At least one notification offset is required when trigger mode is before.'
      );
    }

    normalized.notificationOffsets = offsets;
    return normalized;
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
          category_id,
          tracking_mode,
          estimated_duration_min,
          is_recurrence_enabled,
          is_notifications_enabled,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        input.title.trim(),
        this.normalizeNullableText(input.description),
        this.normalizeNullableText(input.categoryId),
        input.mode,
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
        input.recurrence ? 1 : 0,
        input.notification ? 1 : 0,
        nowIso,
        nowIso,
      ]
    );
  }

  private async updateTaskRow(
    tx: SqliteTransactionContext,
    taskId: string,
    input: CreateTaskInput,
    nowIso: string
  ): Promise<void> {
    await tx.execute(
      `
        UPDATE tasks
        SET
          title = ?,
          description = ?,
          category_id = ?,
          tracking_mode = ?,
          estimated_duration_min = ?,
          is_recurrence_enabled = ?,
          is_notifications_enabled = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        input.title.trim(),
        this.normalizeNullableText(input.description),
        this.normalizeNullableText(input.categoryId),
        input.mode,
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
        input.recurrence ? 1 : 0,
        input.notification ? 1 : 0,
        nowIso,
        taskId,
      ]
    );
  }

  private async deleteTaskBranches(
    tx: SqliteTransactionContext,
    taskId: string
  ): Promise<void> {
    await tx.execute(
      `
        DELETE FROM task_notification_offsets
        WHERE task_id = ?
      `,
      [taskId]
    );

    await tx.execute(
      `
        DELETE FROM task_notifications
        WHERE task_id = ?
      `,
      [taskId]
    );

    await tx.execute(
      `
        DELETE FROM task_recurrence_weekdays
        WHERE task_id = ?
      `,
      [taskId]
    );

    await tx.execute(
      `
        DELETE FROM task_recurrence
        WHERE task_id = ?
      `,
      [taskId]
    );
  }

  private async persistTaskBranches(
    tx: SqliteTransactionContext,
    taskId: string,
    input: CreateTaskInput,
    nowIso: string
  ): Promise<void> {
    if (input.recurrence) {
      await this.insertRecurrence(tx, taskId, input.recurrence, nowIso);
    }

    if (input.notification) {
      await this.insertNotification(tx, taskId, input.notification, nowIso);
    }
  }

  private async insertRecurrence(
    tx: SqliteTransactionContext,
    taskId: string,
    recurrence: CreateTaskRecurrenceInput,
    nowIso: string
  ): Promise<void> {
    const persisted = this.resolveRecurrencePersistenceState(recurrence);
    await tx.execute(
      `
        INSERT INTO task_recurrence (
          task_id,
          pattern,
          has_time,
          same_time_for_selected_days,
          common_time,
          starts_today,
          start_date,
          has_end_date,
          end_date,
          day_of_month,
          year_month,
          year_day,
          timezone,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        persisted.pattern,
        persisted.hasTime ? 1 : 0,
        persisted.sameTimeForSelectedDays ? 1 : 0,
        persisted.commonTime,
        persisted.startsToday ? 1 : 0,
        persisted.startDate,
        persisted.hasEndDate ? 1 : 0,
        persisted.endDate,
        persisted.dayOfMonth,
        persisted.yearMonth,
        persisted.yearDay,
        persisted.timezone,
        nowIso,
        nowIso,
      ]
    );

    if (persisted.pattern !== 'selected_weekdays') {
      return;
    }

    for (const weekday of persisted.weekdays) {
      await tx.execute(
        `
          INSERT INTO task_recurrence_weekdays (
            id,
            task_id,
            weekday_index,
            time_value,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          this.createUuid('recurrence-weekday'),
          taskId,
          weekday.dayOfWeek,
          weekday.timeValue,
          nowIso,
          nowIso,
        ]
      );
    }
  }

  private resolveRecurrencePersistenceState(
    recurrence: CreateTaskRecurrenceInput
  ): PersistedRecurrenceState {
    const startsToday = recurrence.startsToday ?? this.isTodayDate(recurrence.startDate);
    const startDate = this.resolvePersistedStartDate(startsToday, recurrence.startDate);
    const endDate = this.resolveIsoDate(recurrence.endDate ?? null);
    const hasEndDate = (recurrence.hasEndDate ?? endDate !== null) && endDate !== null;
    const timezone = this.normalizeNullableText(recurrence.timezone);

    if (recurrence.mode === 'weekly_schedule') {
      const weekdays = this.normalizeWeeklyDayTimes(recurrence.weeklyDayTimes ?? []);
      if (weekdays.length === 0) {
        throw new Error('Selected weekdays recurrence requires at least one day.');
      }

      return {
        pattern: 'selected_weekdays',
        hasTime: true,
        sameTimeForSelectedDays: false,
        commonTime: null,
        startsToday,
        startDate,
        hasEndDate,
        endDate: hasEndDate ? endDate : null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone,
        weekdays,
      };
    }

    const pattern = this.normalizeSimplePattern(recurrence.simpleType);
    const normalizedCommonTime = this.normalizeTimeValue(recurrence.timeOfDay ?? '');
    const hasTime =
      (recurrence.hasTime ?? normalizedCommonTime !== null) &&
      normalizedCommonTime !== null;
    const sameTimeForSelectedDays =
      pattern === 'selected_weekdays' && hasTime
        ? recurrence.sameTimeForSelectedDays ?? true
        : true;
    const resolvedDateParts = this.resolveSimpleRecurrenceDateParts(pattern, startDate);

    let dayOfMonth: number | null = null;
    let yearMonth: number | null = null;
    let yearDay: number | null = null;
    let weekdays: PersistedRecurrenceWeekday[] = [];

    if (pattern === 'monthly') {
      dayOfMonth =
        this.sanitizeBoundedInteger(recurrence.dayOfMonth, 1, 31) ??
        resolvedDateParts.dayOfMonth;
    } else if (pattern === 'yearly') {
      yearDay =
        this.sanitizeBoundedInteger(recurrence.dayOfMonth, 1, 31) ??
        resolvedDateParts.dayOfMonth;
      yearMonth =
        this.sanitizeBoundedInteger(recurrence.monthOfYear, 1, 12) ??
        resolvedDateParts.monthOfYear;
    } else if (pattern === 'selected_weekdays') {
      weekdays = this.dayMaskToWeekdays(recurrence.daysOfWeekMask).map((dayOfWeek) => ({
        dayOfWeek,
        timeValue: null,
      }));
      if (weekdays.length === 0) {
        throw new Error('Selected weekdays recurrence requires at least one day.');
      }
    }

    return {
      pattern,
      hasTime,
      sameTimeForSelectedDays,
      commonTime: hasTime ? normalizedCommonTime : null,
      startsToday,
      startDate,
      hasEndDate,
      endDate: hasEndDate ? endDate : null,
      dayOfMonth,
      yearMonth,
      yearDay,
      timezone,
      weekdays: hasTime && !sameTimeForSelectedDays
        ? weekdays
        : weekdays.map((day) => ({ ...day, timeValue: null })),
    };
  }

  private async insertNotification(
    tx: SqliteTransactionContext,
    taskId: string,
    notification: CreateTaskNotificationInput,
    nowIso: string
  ): Promise<void> {
    const notificationType = this.normalizeNotificationType(
      notification.notificationType
    );
    const triggerMode = this.normalizeTriggerMode(notification.triggerMode);

    await tx.execute(
      `
        INSERT INTO task_notifications (
          task_id,
          notification_type,
          trigger_mode,
          sound_name,
          tts_text,
          repeat_if_missed,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        notificationType,
        triggerMode,
        this.normalizeNullableText(notification.soundName),
        this.normalizeNullableText(notification.ttsText),
        notification.repeatIfMissed ? 1 : 0,
        nowIso,
        nowIso,
      ]
    );

    if (triggerMode !== 'before') {
      return;
    }

    const offsets = this.resolveNotificationOffsets(notification);
    for (const [index, offsetMinutes] of offsets.entries()) {
      await tx.execute(
        `
          INSERT INTO task_notification_offsets (
            id,
            task_id,
            offset_minutes,
            sort_order,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          this.createUuid('notification-offset'),
          taskId,
          offsetMinutes,
          index,
          nowIso,
          nowIso,
        ]
      );
    }
  }

  private buildCanonicalRecurrence(
    recurrenceRow: TaskRecurrenceRow | undefined,
    weekdayRows: readonly TaskRecurrenceWeekdayRow[]
  ): PersistedTaskAggregate['recurrence'] {
    if (!recurrenceRow) {
      return undefined;
    }

    let pattern = this.normalizeSimplePattern(recurrenceRow.pattern);
    const hasTime = this.toBooleanFlag(recurrenceRow.has_time);
    let sameTimeForSelectedDays =
      pattern === 'selected_weekdays'
        ? this.toBooleanFlag(recurrenceRow.same_time_for_selected_days)
        : true;
    let commonTime = hasTime
      ? this.normalizeTimeValue(recurrenceRow.common_time ?? '')
      : null;
    const startsToday = this.toBooleanFlag(recurrenceRow.starts_today);
    const startDate =
      this.resolveIsoDate(recurrenceRow.start_date) ??
      this.resolvePersistedStartDate(startsToday, null);
    const rawEndDate = this.resolveIsoDate(recurrenceRow.end_date);
    const hasEndDate = this.toBooleanFlag(recurrenceRow.has_end_date) && rawEndDate !== null;
    const endDate = hasEndDate ? rawEndDate : null;
    const timezone = this.normalizeNullableText(recurrenceRow.timezone);

    let weekdays = this.normalizePersistedWeekdays(weekdayRows);
    if (pattern !== 'selected_weekdays') {
      weekdays = [];
      sameTimeForSelectedDays = true;
    }
    if (pattern === 'selected_weekdays' && weekdays.length === 0) {
      pattern = 'daily';
      sameTimeForSelectedDays = true;
    }
    if (!hasTime) {
      commonTime = null;
      sameTimeForSelectedDays = true;
      weekdays = weekdays.map((weekday) => ({ ...weekday, timeValue: null }));
    } else if (sameTimeForSelectedDays) {
      weekdays = weekdays.map((weekday) => ({ ...weekday, timeValue: null }));
    } else {
      commonTime = null;
      weekdays = weekdays.map((weekday) => ({
        ...weekday,
        timeValue: this.normalizeTimeValue(weekday.timeValue ?? ''),
      }));
    }

    return {
      pattern,
      hasTime,
      sameTimeForSelectedDays,
      commonTime,
      startsToday,
      startDate,
      hasEndDate,
      endDate,
      dayOfMonth:
        pattern === 'monthly'
          ? this.sanitizeBoundedInteger(recurrenceRow.day_of_month, 1, 31)
          : null,
      yearMonth:
        pattern === 'yearly'
          ? this.sanitizeBoundedInteger(recurrenceRow.year_month, 1, 12)
          : null,
      yearDay:
        pattern === 'yearly'
          ? this.sanitizeBoundedInteger(recurrenceRow.year_day, 1, 31)
          : null,
      timezone,
      weekdays: weekdays.map((weekday) => ({
        dayOfWeek: weekday.dayOfWeek,
        weekdayBit: this.dayOfWeekToMask(weekday.dayOfWeek),
        timeValue: weekday.timeValue,
      })),
    };
  }

  private buildCanonicalNotification(
    notificationRow: TaskNotificationRow | undefined,
    offsetRows: readonly TaskNotificationOffsetRow[]
  ): PersistedTaskAggregate['notification'] {
    if (!notificationRow) {
      return undefined;
    }

    let triggerMode = this.normalizeTriggerMode(notificationRow.trigger_mode);
    const offsets =
      triggerMode === 'before'
        ? this.normalizeOffsets(offsetRows.map((row) => row.offset_minutes))
        : [];
    if (triggerMode === 'before' && offsets.length === 0) {
      triggerMode = 'at_time';
    }

    return {
      notificationType: this.normalizeNotificationType(notificationRow.notification_type),
      triggerMode,
      offsets: triggerMode === 'before' ? offsets : [],
      soundName: this.normalizeNullableText(notificationRow.sound_name),
      ttsText: this.normalizeNullableText(notificationRow.tts_text),
      repeatIfMissed: this.toBooleanFlag(notificationRow.repeat_if_missed),
    };
  }
  private normalizePersistedWeekdays(
    rows: readonly TaskRecurrenceWeekdayRow[]
  ): PersistedRecurrenceWeekday[] {
    const byDay = new Map<number, PersistedRecurrenceWeekday>();
    for (const row of rows) {
      const dayOfWeek = this.sanitizeBoundedInteger(row.weekday_index, 1, 7);
      if (!dayOfWeek) {
        continue;
      }

      byDay.set(dayOfWeek, {
        dayOfWeek,
        timeValue: this.normalizeNullableText(row.time_value),
      });
    }

    return [...byDay.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  private normalizeWeeklyDayTimes(
    weeklyDayTimes: readonly WeeklyScheduleSlotInput[]
  ): PersistedRecurrenceWeekday[] {
    const byDay = new Map<number, PersistedRecurrenceWeekday>();
    for (const dayTime of weeklyDayTimes) {
      const dayOfWeek = this.sanitizeBoundedInteger(dayTime.dayOfWeek, 1, 7);
      if (!dayOfWeek) {
        continue;
      }

      const normalizedTime = this.normalizeTimeValue(dayTime.time);
      if (!normalizedTime) {
        continue;
      }

      byDay.set(dayOfWeek, {
        dayOfWeek,
        timeValue: normalizedTime,
      });
    }

    return [...byDay.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  private resolveNotificationOffsets(
    notification: CreateTaskNotificationInput
  ): number[] {
    const offsets = this.normalizeOffsets(notification.notificationOffsets ?? []);
    if (offsets.length === 0) {
      throw new Error(
        'At least one notification offset is required when trigger mode is before.'
      );
    }
    return offsets;
  }

  private dayMaskToWeekdays(maskValue: number | null | undefined): number[] {
    const mask = this.sanitizeWeekdayMask(maskValue) ?? 0;
    const map: Array<{ dayOfWeek: number; bit: number }> = [
      { dayOfWeek: 1, bit: 1 },
      { dayOfWeek: 2, bit: 2 },
      { dayOfWeek: 3, bit: 4 },
      { dayOfWeek: 4, bit: 8 },
      { dayOfWeek: 5, bit: 16 },
      { dayOfWeek: 6, bit: 32 },
      { dayOfWeek: 7, bit: 64 },
    ];

    return map
      .filter((entry) => (mask & entry.bit) !== 0)
      .map((entry) => entry.dayOfWeek);
  }

  private resolveSimpleRecurrenceDateParts(
    type: SimpleRecurrenceType,
    startDateIso: string
  ): { dayOfMonth: number | null; monthOfYear: number | null } {
    if (type !== 'monthly' && type !== 'yearly') {
      return { dayOfMonth: null, monthOfYear: null };
    }

    const date = new Date(startDateIso);
    if (Number.isNaN(date.getTime())) {
      return { dayOfMonth: null, monthOfYear: null };
    }

    const dayOfMonth = date.getDate();
    const monthOfYear = date.getMonth() + 1;
    if (type === 'monthly') {
      return { dayOfMonth, monthOfYear: null };
    }

    return { dayOfMonth, monthOfYear };
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

  private sanitizeWeekdayMask(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    const normalizedMask = Math.round(value) & 127;
    return normalizedMask > 0 ? normalizedMask : null;
  }

  private normalizeOffsets(values: readonly number[]): number[] {
    return Array.from(
      new Set(
        values
          .filter((candidate) => Number.isFinite(candidate))
          .map((candidate) => Math.round(candidate))
          .filter((candidate) => candidate > 0)
      )
    ).sort((a, b) => a - b);
  }

  private normalizeTaskMode(value: unknown): TaskMode {
    return value === 'duration' ? 'duration' : 'check';
  }

  private normalizeSimplePattern(value: unknown): SimpleRecurrenceType {
    if (
      value === 'daily' ||
      value === 'selected_weekdays' ||
      value === 'monthly' ||
      value === 'yearly'
    ) {
      return value;
    }

    return 'daily';
  }

  private normalizeTriggerMode(value: unknown): NotificationTriggerMode {
    if (value === 'before' || value === 'manual_only') {
      return value;
    }

    return 'at_time';
  }

  private normalizeNotificationType(
    value: unknown
  ): Exclude<NotificationType, 'none'> {
    if (
      value === 'tts' ||
      value === 'sound' ||
      value === 'vibration' ||
      value === 'popup' ||
      value === 'fullscreen'
    ) {
      return value;
    }

    return 'sound';
  }

  private normalizeNullableText(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toNullableNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return value;
  }

  private toBooleanFlag(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    return value === '1';
  }

  private dayOfWeekToMask(dayOfWeek: number): number {
    const normalized = Math.trunc(dayOfWeek);
    switch (normalized) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 3:
        return 4;
      case 4:
        return 8;
      case 5:
        return 16;
      case 6:
        return 32;
      case 7:
        return 64;
      default:
        throw new Error(`Invalid dayOfWeek value: ${dayOfWeek}`);
    }
  }

  private isTodayDate(value: string | null): boolean {
    if (!value) {
      return false;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }

    const now = new Date();
    return (
      parsed.getUTCFullYear() === now.getUTCFullYear() &&
      parsed.getUTCMonth() === now.getUTCMonth() &&
      parsed.getUTCDate() === now.getUTCDate()
    );
  }

  private resolvePersistedStartDate(
    startsToday: boolean,
    value: string | null
  ): string {
    if (startsToday) {
      return new Date().toISOString();
    }

    const parsed = this.resolveIsoDate(value);
    if (parsed) {
      return parsed;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }

  private resolveIsoDate(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
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

    return null;
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
