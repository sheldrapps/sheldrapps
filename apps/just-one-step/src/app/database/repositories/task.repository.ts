
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  NativeSqliteManager,
  SqliteTransactionContext,
} from '@sheldrapps/native-sqlite-kit';
import {
  CategoryNameValidationException,
  validateCategoryName,
} from './category-name.validation';
import { CategoryRepository } from './category.repository';

export type TaskMode = 'check' | 'duration';
export type TaskPriority = 'S' | 'A' | 'B' | 'C';
export type TaskScheduleType = 'one_time' | 'recurring';
export type TaskDurationMode = 'single' | 'per_occurrence';
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
  durationMin?: number | null;
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
  commonDurationMin?: number | null;
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
  priority?: TaskPriority;
  scheduleType?: TaskScheduleType;
  durationMode?: TaskDurationMode;
  oneTimeDate?: string | null;
  oneTimeTime?: string | null;
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
  includeDeleted?: boolean;
}

export interface TaskListItem {
  id: string;
  title: string;
  description: string | null;
  trackingMode: TaskMode;
  priority: TaskPriority;
  scheduleType: TaskScheduleType;
  durationMode: TaskDurationMode;
  oneTimeDate: string | null;
  oneTimeTime: string | null;
  estimatedDurationMin: number | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  isActive: boolean;
  isArchived: boolean;
  deletedAt: string | null;
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
    commonDurationMin?: number | null;
    timezone: string | null;
    weekdays: Array<{
      dayOfWeek: number;
      weekdayBit: number;
      timeValue: string | null;
      durationMin?: number | null;
    }>;
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
  category_name: string | null;
  category_color: string | null;
  tracking_mode: string;
  priority: string;
  schedule_type: string;
  duration_mode: string;
  one_time_date: string | null;
  one_time_time: string | null;
  estimated_duration_min: number | null;
  is_active: number;
  is_archived: number;
  deleted_at: string | null;
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
  common_duration_min: number | null;
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
  duration_min: number | null;
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
  durationMin: number | null;
}

interface PersistedRecurrenceState {
  pattern: SimpleRecurrenceType;
  hasTime: boolean;
  sameTimeForSelectedDays: boolean;
  commonTime: string | null;
  commonDurationMin: number | null;
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

const TASKS_BROWSER_STORAGE_KEY = 'just-one-step.tasks.browser.v1';

@Injectable({ providedIn: 'root' })
export class TaskRepository {
  private readonly sqliteManager = inject(NativeSqliteManager);
  private readonly categoryRepository = inject(CategoryRepository);

  async createTask(input: CreateTaskInput): Promise<string> {
    if (!this.isNativeRuntime()) {
      return this.createTaskBrowser(input);
    }

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

  async createTaskWithCustomCategory(
    input: CreateTaskInput,
    customCategoryName: string
  ): Promise<string> {
    if (!this.isNativeRuntime()) {
      return this.createTaskWithCustomCategoryBrowser(input, customCategoryName);
    }

    await this.ensureSqliteReady();

    const categoryNames = await this.listCategoryNames();
    const validation = validateCategoryName(customCategoryName, categoryNames);
    if (validation.error) {
      throw new CategoryNameValidationException(validation.error);
    }
    const normalizedCategoryName = validation.normalizedName;

    const normalizedInput = this.sanitizeCreateTaskInput({
      ...input,
      categoryId: null,
    });
    const taskId = this.createUuid('task');
    const categoryId = this.createUuid('cat');
    const nowIso = new Date().toISOString();
    const defaultColor = '#6366F1';

    try {
      // Keep category and task creation atomic to avoid orphan categories.
      await this.sqliteManager.runInTransaction(async (tx) => {
        const sortOrderRows = await tx.query<{ max_sort_order: number | null }>(
          `
            SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order
            FROM categories
            WHERE deleted_at IS NULL AND is_archived = 0
          `
        );
        const maxSortOrder = Number(sortOrderRows[0]?.max_sort_order ?? -1);
        const nextSortOrder = Number.isFinite(maxSortOrder) ? maxSortOrder + 1 : 0;

        await tx.execute(
          `
            INSERT INTO categories (
              id,
              name,
              color,
              icon,
              description,
              sort_order,
              is_archived,
              origin,
              seed_key,
              created_at,
              updated_at,
              deleted_at
            )
            VALUES (?, ?, ?, NULL, NULL, ?, 0, 'user', NULL, ?, ?, NULL)
          `,
          [categoryId, normalizedCategoryName, defaultColor, nextSortOrder, nowIso, nowIso]
        );

        await this.insertTask(
          tx,
          taskId,
          {
            ...normalizedInput,
            categoryId,
          },
          nowIso
        );
        await this.persistTaskBranches(
          tx,
          taskId,
          {
            ...normalizedInput,
            categoryId,
          },
          nowIso
        );
      });
    } catch (error: unknown) {
      if (this.isCategoryDuplicateConstraintError(error)) {
        throw new CategoryNameValidationException('duplicate');
      }

      throw error;
    }

    return taskId;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
    if (!this.isNativeRuntime()) {
      return this.updateTaskBrowser(taskId, input);
    }

    await this.ensureSqliteReady();
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      throw new Error('Task id is required.');
    }

    const existingRows = await this.sqliteManager.query<{ id: string }>(
      `
        SELECT id
        FROM tasks
        WHERE id = ? AND deleted_at IS NULL
        LIMIT 1
      `,
      [normalizedTaskId]
    );
    if (!existingRows[0]) {
      throw new Error(`Task not found: ${normalizedTaskId}`);
    }

    const normalizedInput = this.sanitizeCreateTaskInput(input);
    const forwardOnlyInput = this.enforceForwardOnlyRecurrenceOnUpdate(normalizedInput);
    const nowIso = new Date().toISOString();

    await this.sqliteManager.runInTransaction(async (tx) => {
      await this.updateTaskRow(tx, normalizedTaskId, forwardOnlyInput, nowIso);
      await this.deleteTaskBranches(tx, normalizedTaskId);
      await this.persistTaskBranches(tx, normalizedTaskId, forwardOnlyInput, nowIso);
    });
  }

  async getTaskById(taskId: string): Promise<PersistedTaskAggregate | null> {
    if (!this.isNativeRuntime()) {
      return this.getTaskByIdBrowser(taskId);
    }

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
    if (!this.isNativeRuntime()) {
      return this.listTasksBrowser(filters);
    }

    await this.ensureSqliteReady();

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    const categoryId = this.normalizeNullableText(filters.categoryId);
    const searchText = this.normalizeNullableText(filters.searchText);
    const includeDeleted = filters.includeDeleted === true;

    if (!includeDeleted) {
      whereClauses.push('t.deleted_at IS NULL');
    }

    if (categoryId) {
      whereClauses.push('t.category_id = ?');
      params.push(categoryId);
    }

    if (searchText) {
      const searchLike = `%${searchText}%`;
      whereClauses.push('(t.title LIKE ? OR t.description LIKE ?)');
      params.push(searchLike, searchLike);
    }
    const limit = this.sanitizeBoundedInteger(filters.limit, 1, 500) ?? 100;
    const offset = this.sanitizeBoundedInteger(filters.offset, 0, 1_000_000) ?? 0;
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = await this.sqliteManager.query<TaskRow>(
      `
        SELECT
          t.id,
          t.title,
          t.description,
          t.category_id,
          c.name AS category_name,
          c.color AS category_color,
          t.tracking_mode,
          t.priority,
          t.schedule_type,
          t.duration_mode,
          t.one_time_date,
          t.one_time_time,
          t.estimated_duration_min,
          t.is_active,
          t.is_archived,
          t.deleted_at,
          t.is_recurrence_enabled,
          t.is_notifications_enabled,
          t.created_at,
          t.updated_at
        FROM tasks t
        LEFT JOIN categories c
          ON c.id = t.category_id
          AND c.deleted_at IS NULL
        ${whereSql}
        ORDER BY t.updated_at DESC, t.created_at DESC
        LIMIT ?
        OFFSET ?
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.mapTaskListItem(row));
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.isNativeRuntime()) {
      return this.deleteTaskBrowser(taskId);
    }

    await this.ensureSqliteReady();
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }

    const nowIso = new Date().toISOString();
    await this.sqliteManager.execute(
      `
        UPDATE tasks
        SET
          deleted_at = ?,
          is_archived = 1,
          is_active = 0,
          updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `,
      [nowIso, nowIso, normalizedTaskId]
    );
  }

  async archiveTask(taskId: string): Promise<void> {
    if (!this.isNativeRuntime()) {
      return this.setTaskArchivedStateBrowser(taskId, true);
    }

    await this.setTaskArchivedState(taskId, true);
  }

  async unarchiveTask(taskId: string): Promise<void> {
    if (!this.isNativeRuntime()) {
      return this.setTaskArchivedStateBrowser(taskId, false);
    }

    await this.setTaskArchivedState(taskId, false);
  }

  async setTaskActive(taskId: string, isActive: boolean): Promise<void> {
    if (!this.isNativeRuntime()) {
      return this.setTaskActiveBrowser(taskId, isActive);
    }

    await this.ensureSqliteReady();
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }

    const nowIso = new Date().toISOString();
    await this.sqliteManager.execute(
      `
        UPDATE tasks
        SET
          is_active = ?,
          updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `,
      [isActive ? 1 : 0, nowIso, normalizedTaskId]
    );
  }

  private async loadTaskAggregate(taskId: string): Promise<PersistedTaskAggregate | null> {
    const taskRows = await this.sqliteManager.query<TaskRow>(
      `
        SELECT
          t.id,
          t.title,
          t.description,
          t.category_id,
          c.name AS category_name,
          c.color AS category_color,
          t.tracking_mode,
          t.priority,
          t.schedule_type,
          t.duration_mode,
          t.one_time_date,
          t.one_time_time,
          t.estimated_duration_min,
          t.is_active,
          t.is_archived,
          t.deleted_at,
          t.is_recurrence_enabled,
          t.is_notifications_enabled,
          t.created_at,
          t.updated_at
        FROM tasks t
        LEFT JOIN categories c
          ON c.id = t.category_id
          AND c.deleted_at IS NULL
        WHERE t.id = ? AND t.deleted_at IS NULL
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
          common_duration_min,
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
          time_value,
          duration_min
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
      recurrenceEnabled:
        this.normalizeScheduleType(taskRow.schedule_type, recurrence !== undefined) ===
          'recurring' && recurrence !== undefined,
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
      priority: this.normalizeTaskPriority(row.priority),
      scheduleType: this.normalizeScheduleType(
        row.schedule_type,
        this.toBooleanFlag(row.is_recurrence_enabled)
      ),
      durationMode: this.normalizeDurationMode(row.duration_mode),
      oneTimeDate: this.resolveIsoDate(row.one_time_date) ?? null,
      oneTimeTime: this.normalizeTimeValue(`${row.one_time_time ?? ''}`),
      estimatedDurationMin: this.toNullableNumber(row.estimated_duration_min),
      categoryId: this.normalizeNullableText(row.category_id),
      categoryName: this.normalizeNullableText(row.category_name),
      categoryColor: this.normalizeNullableText(row.category_color),
      isActive: this.toBooleanFlag(row.is_active),
      isArchived: this.toBooleanFlag(row.is_archived),
      deletedAt: this.normalizeNullableText(row.deleted_at),
      recurrenceEnabled: this.toBooleanFlag(row.is_recurrence_enabled),
      notificationsEnabled: this.toBooleanFlag(row.is_notifications_enabled),
      createdAt: this.resolveIsoDate(row.created_at) ?? new Date(0).toISOString(),
      updatedAt: this.resolveIsoDate(row.updated_at) ?? new Date(0).toISOString(),
    };
  }

  private async setTaskArchivedState(taskId: string, isArchived: boolean): Promise<void> {
    await this.ensureSqliteReady();
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }

    const nowIso = new Date().toISOString();
    await this.sqliteManager.execute(
      `
        UPDATE tasks
        SET
          is_archived = ?,
          updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `,
      [isArchived ? 1 : 0, nowIso, normalizedTaskId]
    );
  }

  private async createTaskBrowser(input: CreateTaskInput): Promise<string> {
    const normalizedInput = this.sanitizeCreateTaskInput(input);
    const taskId = this.createUuid('task');
    const nowIso = new Date().toISOString();
    const categorySnapshot = await this.resolveCategorySnapshot(normalizedInput.categoryId);
    const tasks = this.readBrowserTasks();
    tasks.push(
      this.buildBrowserAggregate(taskId, normalizedInput, nowIso, categorySnapshot)
    );
    this.writeBrowserTasks(tasks);
    return taskId;
  }

  private async createTaskWithCustomCategoryBrowser(
    input: CreateTaskInput,
    customCategoryName: string
  ): Promise<string> {
    const existingCategoryNames = this.readBrowserTasks()
      .map((task) => task.categoryName)
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
    const validation = validateCategoryName(customCategoryName, existingCategoryNames);
    if (validation.error) {
      throw new CategoryNameValidationException(validation.error);
    }

    const normalizedInput = this.sanitizeCreateTaskInput({
      ...input,
      categoryId: this.createUuid('cat'),
    });

    const taskId = this.createUuid('task');
    const nowIso = new Date().toISOString();
    const aggregate = this.buildBrowserAggregate(taskId, normalizedInput, nowIso, {
      name: validation.normalizedName,
      color: '#6366F1',
    });
    aggregate.categoryName = validation.normalizedName;
    aggregate.categoryColor = '#6366F1';

    const tasks = this.readBrowserTasks();
    tasks.push(aggregate);
    this.writeBrowserTasks(tasks);
    return taskId;
  }

  private async updateTaskBrowser(taskId: string, input: UpdateTaskInput): Promise<void> {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      throw new Error('Task id is required.');
    }

    const tasks = this.readBrowserTasks();
    const index = tasks.findIndex(
      (candidate) => candidate.id === normalizedTaskId && candidate.deletedAt === null
    );
    if (index < 0) {
      throw new Error(`Task not found: ${normalizedTaskId}`);
    }

    const existing = tasks[index];
    const normalizedInput = this.sanitizeCreateTaskInput(input);
    const forwardOnlyInput = this.enforceForwardOnlyRecurrenceOnUpdate(normalizedInput);
    const categorySnapshot = await this.resolveCategorySnapshot(normalizedInput.categoryId);
    const updated = this.buildBrowserAggregate(
      normalizedTaskId,
      forwardOnlyInput,
      existing.createdAt,
      categorySnapshot
    );
    updated.updatedAt = new Date().toISOString();
    updated.isActive = existing.isActive;
    updated.isArchived = existing.isArchived;
    updated.deletedAt = existing.deletedAt;
    if (updated.categoryId === existing.categoryId) {
      updated.categoryName = existing.categoryName;
      updated.categoryColor = existing.categoryColor;
    }

    tasks[index] = updated;
    this.writeBrowserTasks(tasks);
  }

  private async getTaskByIdBrowser(taskId: string): Promise<PersistedTaskAggregate | null> {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return null;
    }

    const tasks = this.readBrowserTasks();
    return (
      tasks.find((task) => task.id === normalizedTaskId && task.deletedAt === null) ?? null
    );
  }

  private async listTasksBrowser(filters: TaskListFilters): Promise<TaskListItem[]> {
    const categoryId = this.normalizeNullableText(filters.categoryId);
    const searchText = this.normalizeNullableText(filters.searchText);
    const includeDeleted = filters.includeDeleted === true;

    let tasks = this.readBrowserTasks();
    if (!includeDeleted) {
      tasks = tasks.filter((task) => task.deletedAt === null);
    }
    if (categoryId) {
      tasks = tasks.filter((task) => task.categoryId === categoryId);
    }
    if (searchText) {
      const searchValue = searchText.toLowerCase();
      tasks = tasks.filter((task) => {
        const title = task.title.toLowerCase();
        const description = (task.description ?? '').toLowerCase();
        return title.includes(searchValue) || description.includes(searchValue);
      });
    }

    const sorted = [...tasks].sort((a, b) => {
      if (a.updatedAt !== b.updatedAt) {
        return a.updatedAt < b.updatedAt ? 1 : -1;
      }
      return a.createdAt < b.createdAt ? 1 : -1;
    });

    const limit = this.sanitizeBoundedInteger(filters.limit, 1, 500) ?? 100;
    const offset = this.sanitizeBoundedInteger(filters.offset, 0, 1_000_000) ?? 0;
    return sorted.slice(offset, offset + limit).map((task) => ({ ...task }));
  }

  private async deleteTaskBrowser(taskId: string): Promise<void> {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }

    const tasks = this.readBrowserTasks();
    const index = tasks.findIndex(
      (candidate) => candidate.id === normalizedTaskId && candidate.deletedAt === null
    );
    if (index < 0) {
      return;
    }

    const nowIso = new Date().toISOString();
    tasks[index] = {
      ...tasks[index],
      isActive: false,
      isArchived: true,
      deletedAt: nowIso,
      updatedAt: nowIso,
    };
    this.writeBrowserTasks(tasks);
  }

  private async setTaskArchivedStateBrowser(
    taskId: string,
    isArchived: boolean
  ): Promise<void> {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }

    const tasks = this.readBrowserTasks();
    const index = tasks.findIndex(
      (candidate) => candidate.id === normalizedTaskId && candidate.deletedAt === null
    );
    if (index < 0) {
      return;
    }

    tasks[index] = {
      ...tasks[index],
      isArchived,
      updatedAt: new Date().toISOString(),
    };
    this.writeBrowserTasks(tasks);
  }

  private async setTaskActiveBrowser(taskId: string, isActive: boolean): Promise<void> {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      return;
    }

    const tasks = this.readBrowserTasks();
    const index = tasks.findIndex(
      (candidate) => candidate.id === normalizedTaskId && candidate.deletedAt === null
    );
    if (index < 0) {
      return;
    }

    tasks[index] = {
      ...tasks[index],
      isActive,
      updatedAt: new Date().toISOString(),
    };
    this.writeBrowserTasks(tasks);
  }

  private buildBrowserAggregate(
    taskId: string,
    input: CreateTaskInput,
    createdAt: string,
    categorySnapshot?: { name: string | null; color: string | null }
  ): PersistedTaskAggregate {
    const nowIso = new Date().toISOString();
    const recurrencePersisted = input.recurrence
      ? this.resolveRecurrencePersistenceState(input.recurrence)
      : undefined;
    const notificationPersisted = input.notification
      ? this.resolveNotificationPersistenceState(input.notification)
      : undefined;

    return {
      id: taskId,
      title: input.title.trim(),
      description: this.normalizeNullableText(input.description),
      trackingMode: input.mode,
      priority: this.normalizeTaskPriority(input.priority),
      scheduleType: this.normalizeScheduleType(input.scheduleType, input.recurrence),
      durationMode: this.normalizeDurationMode(input.durationMode),
      oneTimeDate: this.resolveIsoDate(input.oneTimeDate ?? null),
      oneTimeTime: this.normalizeTimeValue(input.oneTimeTime ?? ''),
      estimatedDurationMin:
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
      categoryId: this.normalizeNullableText(input.categoryId),
      categoryName: categorySnapshot?.name ?? null,
      categoryColor: categorySnapshot?.color ?? null,
      isActive: true,
      isArchived: false,
      deletedAt: null,
      recurrenceEnabled:
        this.normalizeScheduleType(input.scheduleType, input.recurrence) ===
          'recurring' && recurrencePersisted !== undefined,
      notificationsEnabled: notificationPersisted !== undefined,
      createdAt,
      updatedAt: nowIso,
      recurrence: recurrencePersisted
        ? {
            pattern: recurrencePersisted.pattern,
            hasTime: recurrencePersisted.hasTime,
            sameTimeForSelectedDays: recurrencePersisted.sameTimeForSelectedDays,
            commonTime: recurrencePersisted.commonTime,
            commonDurationMin: recurrencePersisted.commonDurationMin,
            startsToday: recurrencePersisted.startsToday,
            startDate: recurrencePersisted.startDate,
            hasEndDate: recurrencePersisted.hasEndDate,
            endDate: recurrencePersisted.endDate,
            dayOfMonth: recurrencePersisted.dayOfMonth,
            yearMonth: recurrencePersisted.yearMonth,
            yearDay: recurrencePersisted.yearDay,
            timezone: recurrencePersisted.timezone,
            weekdays: recurrencePersisted.weekdays.map((weekday) => ({
              dayOfWeek: weekday.dayOfWeek,
              weekdayBit: this.dayOfWeekToMask(weekday.dayOfWeek),
              timeValue: weekday.timeValue,
              durationMin: weekday.durationMin,
            })),
          }
        : undefined,
      notification: notificationPersisted,
    };
  }

  private resolveNotificationPersistenceState(
    notification: CreateTaskNotificationInput
  ): PersistedTaskAggregate['notification'] {
    const notificationType = this.normalizeNotificationType(
      notification.notificationType
    );
    const triggerMode = this.normalizeTriggerMode(notification.triggerMode);
    const offsets =
      triggerMode === 'before'
        ? this.resolveNotificationOffsets(notification)
        : [];

    return {
      notificationType,
      triggerMode,
      offsets,
      soundName: this.normalizeNullableText(notification.soundName),
      ttsText: this.normalizeNullableText(notification.ttsText),
      repeatIfMissed: Boolean(notification.repeatIfMissed),
    };
  }

  private readBrowserTasks(): PersistedTaskAggregate[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }

    const raw = window.localStorage.getItem(TASKS_BROWSER_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((value): value is PersistedTaskAggregate => {
          return typeof value === 'object' && value !== null;
        })
        .map((task) => ({
          ...task,
          priority: this.normalizeTaskPriority(task.priority),
          scheduleType: this.normalizeScheduleType(task.scheduleType, task.recurrence),
          durationMode: this.normalizeDurationMode(task.durationMode),
          oneTimeDate: this.resolveIsoDate(task.oneTimeDate) ?? null,
          oneTimeTime: this.normalizeTimeValue(`${task.oneTimeTime ?? ''}`),
          categoryName: this.normalizeNullableText(task.categoryName),
          categoryColor: this.normalizeNullableText(task.categoryColor),
          deletedAt: this.normalizeNullableText(task.deletedAt),
          description: this.normalizeNullableText(task.description),
          recurrence: task.recurrence
            ? {
                ...task.recurrence,
                commonDurationMin: this.sanitizeBoundedInteger(
                  task.recurrence.commonDurationMin,
                  1,
                  1440
                ),
                weekdays: (task.recurrence.weekdays ?? []).map((weekday) => ({
                  ...weekday,
                  durationMin: this.sanitizeBoundedInteger(
                    weekday.durationMin,
                    1,
                    1440
                  ),
                })),
              }
            : undefined,
        }));
    } catch {
      return [];
    }
  }

  private writeBrowserTasks(tasks: PersistedTaskAggregate[]): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(TASKS_BROWSER_STORAGE_KEY, JSON.stringify(tasks));
  }

  private isNativeRuntime(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  private async resolveCategorySnapshot(
    categoryId: string | null | undefined
  ): Promise<{ name: string | null; color: string | null }> {
    const normalizedCategoryId = this.normalizeNullableText(categoryId);
    if (!normalizedCategoryId) {
      return { name: null, color: null };
    }

    try {
      const category = await this.categoryRepository.getCategoryById(normalizedCategoryId);
      return {
        name: category?.name ?? null,
        color: category?.color ?? null,
      };
    } catch {
      return { name: null, color: null };
    }
  }

  private async ensureSqliteReady(): Promise<void> {
    if (!this.isNativeRuntime()) {
      return;
    }

    if (!this.sqliteManager.isReady()) {
      await this.sqliteManager.initialize();
    }
  }

  private async listCategoryNames(): Promise<string[]> {
    const rows = await this.sqliteManager.query<{ name: string }>(
      `
        SELECT name
        FROM categories
        WHERE deleted_at IS NULL AND is_archived = 0
      `
    );
    return rows.map((row) => row.name);
  }

  private isCategoryDuplicateConstraintError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('unique constraint failed: categories.name') ||
      message.includes('idx_categories_name_ci')
    );
  }

  private sanitizeCreateTaskInput(input: CreateTaskInput): CreateTaskInput {
    const title = input.title.trim();
    if (title.length === 0) {
      throw new Error('Task title is required.');
    }

    const mode = this.normalizeTaskMode(input.mode);
    const priority = this.normalizeTaskPriority(input.priority);
    const scheduleType = this.normalizeScheduleType(input.scheduleType, input.recurrence);
    const durationMode = this.normalizeDurationMode(input.durationMode);
    const estimatedDurationMin =
      mode === 'duration'
        ? this.sanitizeBoundedInteger(input.estimatedDurationMin, 1, 1440)
        : null;
    const oneTimeDateSeed =
      scheduleType === 'one_time' ? this.resolveIsoDate(input.oneTimeDate ?? null) : null;
    const oneTimeDate = oneTimeDateSeed
      ? this.normalizeCalendarDateIso(oneTimeDateSeed, null)
      : null;
    const oneTimeTime =
      scheduleType === 'one_time'
        ? this.normalizeTimeValue(input.oneTimeTime ?? '')
        : null;
    const recurrence =
      scheduleType === 'recurring'
        ? this.sanitizeRecurrenceInput(input.recurrence)
        : undefined;
    const hasTimedOccurrence =
      (scheduleType === 'one_time' && oneTimeTime !== null) ||
      (recurrence?.hasTime ?? false);

    return {
      title,
      description: this.normalizeNullableText(input.description),
      mode,
      priority,
      scheduleType,
      durationMode,
      oneTimeDate,
      oneTimeTime,
      estimatedDurationMin,
      categoryId: this.normalizeNullableText(input.categoryId),
      recurrence,
      notification: this.sanitizeNotificationInput(input.notification, hasTimedOccurrence),
    };
  }

  private enforceForwardOnlyRecurrenceOnUpdate(input: CreateTaskInput): CreateTaskInput {
    if (input.scheduleType === 'one_time' || !input.recurrence) {
      return input;
    }

    const nowIso = new Date().toISOString();
    const effectiveEndDate =
      input.recurrence.hasEndDate && input.recurrence.endDate
        ? (input.recurrence.endDate < nowIso ? nowIso : input.recurrence.endDate)
        : input.recurrence.endDate;

    return {
      ...input,
      recurrence: {
        ...input.recurrence,
        startsToday: true,
        startDate: nowIso,
        endDate: effectiveEndDate,
      },
    };
  }

  private sanitizeRecurrenceInput(
    recurrence?: CreateTaskRecurrenceInput
  ): CreateTaskRecurrenceInput | undefined {
    if (!recurrence) {
      return undefined;
    }

    const timezone = this.normalizeNullableText(recurrence.timezone);
    const startDateSeed = this.resolveIsoDate(recurrence.startDate);
    const startsToday = recurrence.startsToday ?? this.isTodayDate(startDateSeed);
    const startDate = this.resolvePersistedStartDate(
      startsToday,
      startDateSeed,
      timezone
    );
    const parsedEndDate = this.resolveIsoDate(recurrence.endDate ?? null);
    const normalizedEndDate = parsedEndDate
      ? this.normalizeCalendarDateIso(parsedEndDate, timezone)
      : null;
    const hasEndDate =
      (recurrence.hasEndDate ?? normalizedEndDate !== null) &&
      normalizedEndDate !== null;
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
          durationMin: entry.durationMin ?? null,
        })),
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
        endDate: hasEndDate ? normalizedEndDate : null,
        timezone,
      };
    }

    const simpleType = this.normalizeSimplePattern(recurrence.simpleType);
    const normalizedTime = this.normalizeTimeValue(recurrence.timeOfDay ?? '');
    const hasTime = recurrence.hasTime === true && normalizedTime !== null;
    const sameTimeForSelectedDays =
      simpleType === 'selected_weekdays' && hasTime
        ? recurrence.sameTimeForSelectedDays ?? true
        : true;
    const resolvedDateParts = this.resolveSimpleRecurrenceDateParts(
      simpleType,
      startDate,
      timezone
    );

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
      commonDurationMin: this.sanitizeBoundedInteger(
        recurrence.commonDurationMin,
        1,
        1440
      ),
      startsToday,
      hasEndDate,
      startDate,
      endDate: hasEndDate ? normalizedEndDate : null,
      timezone,
    };
  }

  private sanitizeNotificationInput(
    notification: CreateTaskNotificationInput | undefined,
    hasTimedOccurrence: boolean
  ): CreateTaskNotificationInput | undefined {
    if (!notification) {
      return undefined;
    }

    const notificationType = this.normalizeNotificationType(
      notification.notificationType
    );
    const triggerMode = hasTimedOccurrence
      ? this.normalizeTriggerMode(notification.triggerMode)
      : 'manual_only';
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
          priority,
          schedule_type,
          duration_mode,
          one_time_date,
          one_time_time,
          estimated_duration_min,
          is_active,
          is_archived,
          deleted_at,
          is_recurrence_enabled,
          is_notifications_enabled,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        input.title.trim(),
        this.normalizeNullableText(input.description),
        this.normalizeNullableText(input.categoryId),
        input.mode,
        this.normalizeTaskPriority(input.priority),
        this.normalizeScheduleType(input.scheduleType, input.recurrence),
        this.normalizeDurationMode(input.durationMode),
        this.resolveIsoDate(input.oneTimeDate ?? null),
        this.normalizeTimeValue(input.oneTimeTime ?? ''),
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
        1,
        0,
        null,
        input.scheduleType === 'recurring' && input.recurrence ? 1 : 0,
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
          priority = ?,
          schedule_type = ?,
          duration_mode = ?,
          one_time_date = ?,
          one_time_time = ?,
          estimated_duration_min = ?,
          is_recurrence_enabled = ?,
          is_notifications_enabled = ?,
          updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `,
      [
        input.title.trim(),
        this.normalizeNullableText(input.description),
        this.normalizeNullableText(input.categoryId),
        input.mode,
        this.normalizeTaskPriority(input.priority),
        this.normalizeScheduleType(input.scheduleType, input.recurrence),
        this.normalizeDurationMode(input.durationMode),
        this.resolveIsoDate(input.oneTimeDate ?? null),
        this.normalizeTimeValue(input.oneTimeTime ?? ''),
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
        input.scheduleType === 'recurring' && input.recurrence ? 1 : 0,
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
    if (input.scheduleType !== 'one_time' && input.recurrence) {
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
          common_duration_min,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        taskId,
        persisted.pattern,
        persisted.hasTime ? 1 : 0,
        persisted.sameTimeForSelectedDays ? 1 : 0,
        persisted.commonTime,
        persisted.commonDurationMin,
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
            duration_min,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          this.createUuid('recurrence-weekday'),
          taskId,
          weekday.dayOfWeek,
          weekday.timeValue,
          weekday.durationMin,
          nowIso,
          nowIso,
        ]
      );
    }
  }

  private resolveRecurrencePersistenceState(
    recurrence: CreateTaskRecurrenceInput
  ): PersistedRecurrenceState {
    const timezone = this.normalizeNullableText(recurrence.timezone);
    const startsToday = recurrence.startsToday ?? this.isTodayDate(recurrence.startDate);
    const startDate = this.resolvePersistedStartDate(
      startsToday,
      recurrence.startDate,
      timezone
    );
    const endDate = this.resolveIsoDate(recurrence.endDate ?? null);
    const normalizedEndDate = endDate
      ? this.normalizeCalendarDateIso(endDate, timezone)
      : null;
    const hasEndDate =
      (recurrence.hasEndDate ?? normalizedEndDate !== null) &&
      normalizedEndDate !== null;
    const commonDurationMin = this.sanitizeBoundedInteger(
      recurrence.commonDurationMin,
      1,
      1440
    );

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
        commonDurationMin,
        startsToday,
        startDate,
        hasEndDate,
        endDate: hasEndDate ? normalizedEndDate : null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone,
        weekdays,
      };
    }

    const pattern = this.normalizeSimplePattern(recurrence.simpleType);
    const normalizedCommonTime = this.normalizeTimeValue(recurrence.timeOfDay ?? '');
    const hasTime = recurrence.hasTime === true && normalizedCommonTime !== null;
    const sameTimeForSelectedDays =
      pattern === 'selected_weekdays' && hasTime
        ? recurrence.sameTimeForSelectedDays ?? true
        : true;
    const resolvedDateParts = this.resolveSimpleRecurrenceDateParts(
      pattern,
      startDate,
      timezone
    );

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
        durationMin: null,
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
      commonDurationMin,
      startsToday,
      startDate,
      hasEndDate,
      endDate: hasEndDate ? normalizedEndDate : null,
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
    const commonDurationMin = this.sanitizeBoundedInteger(
      recurrenceRow.common_duration_min,
      1,
      1440
    );
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
      commonDurationMin,
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
        durationMin: weekday.durationMin,
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
        durationMin: this.sanitizeBoundedInteger(row.duration_min, 1, 1440),
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
        durationMin: this.sanitizeBoundedInteger(dayTime.durationMin, 1, 1440),
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
    startDateIso: string,
    timezone: string | null = null
  ): { dayOfMonth: number | null; monthOfYear: number | null } {
    if (type !== 'monthly' && type !== 'yearly') {
      return { dayOfMonth: null, monthOfYear: null };
    }

    const parts = this.resolveCalendarDateParts(startDateIso, timezone);
    if (!parts) {
      return { dayOfMonth: null, monthOfYear: null };
    }

    const dayOfMonth = parts.day;
    const monthOfYear = parts.month;
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

  private normalizeTaskPriority(value: unknown): TaskPriority {
    if (value === 'S' || value === 'A' || value === 'B' || value === 'C') {
      return value;
    }

    return 'B';
  }

  private normalizeScheduleType(
    value: unknown,
    recurrence?: unknown | boolean
  ): TaskScheduleType {
    if (value === 'one_time' || value === 'recurring') {
      return value;
    }

    if (typeof recurrence === 'boolean') {
      return recurrence ? 'recurring' : 'one_time';
    }

    return recurrence ? 'recurring' : 'one_time';
  }

  private normalizeDurationMode(value: unknown): TaskDurationMode {
    return value === 'per_occurrence' ? 'per_occurrence' : 'single';
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
    value: string | null,
    timezone: string | null = null
  ): string {
    if (startsToday) {
      return new Date().toISOString();
    }

    const parsed = this.resolveIsoDate(value);
    if (parsed) {
      return this.normalizeCalendarDateIso(parsed, timezone);
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.normalizeCalendarDateIso(tomorrow.toISOString(), timezone);
  }

  private normalizeCalendarDateIso(value: string, timezone: string | null): string {
    const parts = this.resolveCalendarDateParts(value, timezone);
    if (!parts) {
      return value;
    }

    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)).toISOString();
  }

  private resolveCalendarDateParts(
    value: string,
    timezone: string | null
  ): { year: number; month: number; day: number } | null {
    const trimmed = value.trim();
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const year = Number.parseInt(
          formatter.formatToParts(parsed).find((part) => part.type === 'year')?.value ??
            '',
          10
        );
        const month = Number.parseInt(
          formatter.formatToParts(parsed).find((part) => part.type === 'month')?.value ??
            '',
          10
        );
        const day = Number.parseInt(
          formatter.formatToParts(parsed).find((part) => part.type === 'day')?.value ??
            '',
          10
        );

        if (
          Number.isFinite(year) &&
          Number.isFinite(month) &&
          Number.isFinite(day) &&
          year > 0 &&
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        ) {
          return { year, month, day };
        }
      } catch {
        // Falls back to local date parts when timezone is invalid at runtime.
      }
    }

    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
    };
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
