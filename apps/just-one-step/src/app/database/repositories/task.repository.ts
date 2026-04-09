
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
import {
  addDays,
  formatCalendarDate,
  getDeviceTimezone,
  getToday,
  getWeekday,
  isAfter,
  isBefore,
  parseCalendarDate,
  toCalendarDate,
} from '../../shared/calendar';

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
export type RecurrenceType = 'none' | SimpleRecurrenceType;
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
  recurrenceType?: RecurrenceType;
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
  startLocalDate?: string | null;
  endLocalDate?: string | null;
  localTime?: string | null;
  timezone?: string | null;
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

export interface TaskMonthDayCategorySummary {
  dateKey: string;
  taskCount: number;
  categoryIds: string[];
}

export interface TaskYearMonthCategorySummary {
  monthKey: string;
  taskCount: number;
  categoryIds: string[];
}

export interface PersistedTaskAggregate extends TaskListItem {
  recurrenceType: RecurrenceType;
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
  start_local_date: string | null;
  end_local_date: string | null;
  local_time: string | null;
  timezone: string | null;
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

interface TaskMonthCalendarCandidateRow extends Record<string, unknown> {
  task_id: string;
  category_id: string | null;
  schedule_type: string;
  start_local_date: string | null;
  end_local_date: string | null;
  pattern: string | null;
  day_of_month: number | null;
  year_month: number | null;
  year_day: number | null;
}

interface TaskRecurrenceWeekdaySummaryRow extends Record<string, unknown> {
  task_id: string;
  weekday_index: number;
}

interface TaskDateCategorySummaryAccumulator {
  taskIds: Set<string>;
  categoryIds: string[];
  seenCategoryIds: Set<string>;
}

interface TaskRecurrenceBatchRow extends TaskRecurrenceRow {
  task_id: string;
}

interface TaskRecurrenceWeekdayBatchRow extends TaskRecurrenceWeekdayRow {
  task_id: string;
}

interface TaskNotificationBatchRow extends TaskNotificationRow {
  task_id: string;
}

interface TaskNotificationOffsetBatchRow extends TaskNotificationOffsetRow {
  task_id: string;
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

interface TaskCalendarPersistenceFields {
  startLocalDate: string;
  endLocalDate: string | null;
  localTime: string | null;
  timezone: string;
  legacyOneTimeDate: string | null;
  legacyOneTimeTime: string | null;
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
          t.start_local_date,
          t.end_local_date,
          t.local_time,
          t.timezone,
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

  async listMonthDayCategorySummaries(
    monthStartIso: string,
    monthEndIso: string
  ): Promise<TaskMonthDayCategorySummary[] | null> {
    if (!this.isNativeRuntime()) {
      return this.listMonthDayCategorySummariesBrowser(monthStartIso, monthEndIso);
    }

    await this.ensureSqliteReady();

    const normalizedRange = this.resolveSummaryRange(monthStartIso, monthEndIso);
    if (!normalizedRange) {
      return [];
    }

    const summaryContext = await this.loadDateCategorySummaryContext(
      normalizedRange.normalizedStart,
      normalizedRange.normalizedEnd
    );
    if (summaryContext.candidates.length === 0) {
      return [];
    }

    const dailySummary = this.buildDateCategorySummary(
      normalizedRange.normalizedStart,
      normalizedRange.normalizedEnd,
      summaryContext.candidates,
      summaryContext.recurrenceWeekdaysByTask
    );

    return [...dailySummary.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateKey, summary]) => ({
        dateKey,
        taskCount: summary.taskIds.size,
        categoryIds: summary.categoryIds,
      }));
  }

  async listYearMonthCategorySummaries(
    yearStartIso: string,
    yearEndIso: string
  ): Promise<TaskYearMonthCategorySummary[] | null> {
    if (!this.isNativeRuntime()) {
      return this.listYearMonthCategorySummariesBrowser(yearStartIso, yearEndIso);
    }

    await this.ensureSqliteReady();

    const normalizedRange = this.resolveSummaryRange(yearStartIso, yearEndIso);
    if (!normalizedRange) {
      return [];
    }

    const summaryContext = await this.loadDateCategorySummaryContext(
      normalizedRange.normalizedStart,
      normalizedRange.normalizedEnd
    );
    if (summaryContext.candidates.length === 0) {
      return [];
    }

    const dailySummary = this.buildDateCategorySummary(
      normalizedRange.normalizedStart,
      normalizedRange.normalizedEnd,
      summaryContext.candidates,
      summaryContext.recurrenceWeekdaysByTask
    );
    const monthlySummary = this.aggregateDateSummaryByMonth(dailySummary);

    return [...monthlySummary.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([monthKey, summary]) => ({
        monthKey,
        taskCount: summary.taskIds.size,
        categoryIds: summary.categoryIds,
      }));
  }

  async listTaskAggregatesForDate(
    dateIso: string
  ): Promise<PersistedTaskAggregate[] | null> {
    if (!this.isNativeRuntime()) {
      return this.listTaskAggregatesForDateBrowser(dateIso);
    }

    await this.ensureSqliteReady();

    const dateKey = this.toCalendarDateKey(dateIso);
    if (!dateKey) {
      return [];
    }

    const summaryContext = await this.loadDateCategorySummaryContext(
      dateKey,
      dateKey
    );
    if (summaryContext.candidates.length === 0) {
      return [];
    }

    const taskIds = new Set<string>();
    for (const candidate of summaryContext.candidates) {
      if (
        !this.candidateOccursOnLocalDate(
          candidate,
          dateKey,
          summaryContext.recurrenceWeekdaysByTask
        )
      ) {
        continue;
      }

      const taskId = candidate.task_id.trim();
      if (!taskId) {
        continue;
      }

      taskIds.add(taskId);
    }

    if (taskIds.size === 0) {
      return [];
    }

    const aggregates = await this.loadTaskAggregatesByIds([...taskIds]);

    return aggregates.filter(
      (task): task is PersistedTaskAggregate =>
        !!task &&
        task.isActive &&
        !task.isArchived &&
        task.deletedAt === null &&
        (task.scheduleType === 'one_time' || !!task.recurrence)
    );
  }

  private resolveSummaryRange(
    rangeStartIso: string,
    rangeEndIso: string
  ): { normalizedStart: string; normalizedEnd: string } | null {
    const rangeStart = this.toCalendarDateKey(rangeStartIso);
    const rangeEnd = this.toCalendarDateKey(rangeEndIso);
    if (!rangeStart || !rangeEnd) {
      return null;
    }

    const [normalizedStart, normalizedEnd] =
      rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
    return { normalizedStart, normalizedEnd };
  }

  private async loadDateCategorySummaryContext(
    normalizedStart: string,
    normalizedEnd: string
  ): Promise<{
    candidates: TaskMonthCalendarCandidateRow[];
    recurrenceWeekdaysByTask: Map<string, Set<number>>;
  }> {
    const candidates = await this.sqliteManager.query<TaskMonthCalendarCandidateRow>(
      `
        SELECT DISTINCT
          t.id AS task_id,
          t.category_id AS category_id,
          t.schedule_type,
          t.start_local_date,
          t.end_local_date,
          tr.pattern,
          tr.day_of_month,
          tr.year_month,
          tr.year_day
        FROM tasks t
        LEFT JOIN task_recurrence tr
          ON tr.task_id = t.id
        WHERE
          t.deleted_at IS NULL
          AND t.is_archived = 0
          AND t.is_active = 1
          AND (
            (
              t.schedule_type = 'one_time'
              AND t.start_local_date >= ?
              AND t.start_local_date <= ?
            )
            OR (
              t.schedule_type = 'recurring'
              AND t.start_local_date <= ?
              AND (t.end_local_date IS NULL OR t.end_local_date >= ?)
            )
          )
      `,
      [normalizedStart, normalizedEnd, normalizedEnd, normalizedStart]
    );

    if (candidates.length === 0) {
      return {
        candidates: [],
        recurrenceWeekdaysByTask: new Map<string, Set<number>>(),
      };
    }

    const candidateTaskIds = [...new Set(
      candidates
        .map((candidate) => candidate.task_id?.trim() ?? '')
        .filter((taskId) => taskId.length > 0)
    )];
    const weekdayRows = await this.loadRecurrenceWeekdaySummaryRows(candidateTaskIds);

    const recurrenceWeekdaysByTask = new Map<string, Set<number>>();
    for (const row of weekdayRows) {
      const taskId = row.task_id?.trim();
      if (!taskId) {
        continue;
      }

      const weekday = Math.round(Number(row.weekday_index) || 0);
      if (weekday < 1 || weekday > 7) {
        continue;
      }

      if (!recurrenceWeekdaysByTask.has(taskId)) {
        recurrenceWeekdaysByTask.set(taskId, new Set<number>());
      }

      recurrenceWeekdaysByTask.get(taskId)?.add(weekday);
    }

    return {
      candidates,
      recurrenceWeekdaysByTask,
    };
  }

  private async loadRecurrenceWeekdaySummaryRows(
    taskIds: readonly string[]
  ): Promise<TaskRecurrenceWeekdaySummaryRow[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const placeholders = taskIds.map(() => '?').join(', ');
    return this.sqliteManager.query<TaskRecurrenceWeekdaySummaryRow>(
      `
        SELECT
          task_id,
          weekday_index
        FROM task_recurrence_weekdays
        WHERE task_id IN (${placeholders})
      `,
      [...taskIds]
    );
  }

  private buildDateCategorySummary(
    normalizedStart: string,
    normalizedEnd: string,
    candidates: readonly TaskMonthCalendarCandidateRow[],
    recurrenceWeekdaysByTask: ReadonlyMap<string, ReadonlySet<number>>
  ): Map<string, TaskDateCategorySummaryAccumulator> {
    const dateSummary = new Map<string, TaskDateCategorySummaryAccumulator>();

    for (
      let day = normalizedStart;
      !isAfter(day, normalizedEnd);
      day = formatCalendarDate(addDays(day, 1))
    ) {
      for (const candidate of candidates) {
        if (
          !this.candidateOccursOnLocalDate(
            candidate,
            day,
            recurrenceWeekdaysByTask
          )
        ) {
          continue;
        }

        const currentSummary =
          dateSummary.get(day) ?? this.createDateCategorySummaryAccumulator();

        currentSummary.taskIds.add(candidate.task_id);
        const categoryId = this.normalizeNullableText(candidate.category_id);
        if (categoryId && !currentSummary.seenCategoryIds.has(categoryId)) {
          currentSummary.seenCategoryIds.add(categoryId);
          currentSummary.categoryIds.push(categoryId);
        }

        dateSummary.set(day, currentSummary);
      }
    }

    return dateSummary;
  }

  private aggregateDateSummaryByMonth(
    dailySummary: ReadonlyMap<string, TaskDateCategorySummaryAccumulator>
  ): Map<string, TaskDateCategorySummaryAccumulator> {
    const monthlySummary = new Map<string, TaskDateCategorySummaryAccumulator>();

    for (const [dateKey, summary] of dailySummary.entries()) {
      const monthKey = dateKey.slice(0, 7);
      const currentSummary =
        monthlySummary.get(monthKey) ?? this.createDateCategorySummaryAccumulator();

      for (const taskId of summary.taskIds) {
        currentSummary.taskIds.add(taskId);
      }

      for (const categoryId of summary.categoryIds) {
        if (currentSummary.seenCategoryIds.has(categoryId)) {
          continue;
        }

        currentSummary.seenCategoryIds.add(categoryId);
        currentSummary.categoryIds.push(categoryId);
      }

      monthlySummary.set(monthKey, currentSummary);
    }

    return monthlySummary;
  }

  private createDateCategorySummaryAccumulator(): TaskDateCategorySummaryAccumulator {
    return {
      taskIds: new Set<string>(),
      categoryIds: [],
      seenCategoryIds: new Set<string>(),
    };
  }

  private async listMonthDayCategorySummariesBrowser(
    monthStartIso: string,
    monthEndIso: string
  ): Promise<TaskMonthDayCategorySummary[]> {
    const normalizedRange = this.resolveSummaryRange(monthStartIso, monthEndIso);
    if (!normalizedRange) {
      return [];
    }

    const summaryContext = this.loadDateCategorySummaryContextFromBrowserTasks(
      normalizedRange.normalizedStart,
      normalizedRange.normalizedEnd
    );
    if (summaryContext.candidates.length === 0) {
      return [];
    }

    const dailySummary = this.buildDateCategorySummary(
      normalizedRange.normalizedStart,
      normalizedRange.normalizedEnd,
      summaryContext.candidates,
      summaryContext.recurrenceWeekdaysByTask
    );

    return [...dailySummary.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dateKey, summary]) => ({
        dateKey,
        taskCount: summary.taskIds.size,
        categoryIds: summary.categoryIds,
      }));
  }

  private async listYearMonthCategorySummariesBrowser(
    yearStartIso: string,
    yearEndIso: string
  ): Promise<TaskYearMonthCategorySummary[]> {
    const normalizedRange = this.resolveSummaryRange(yearStartIso, yearEndIso);
    if (!normalizedRange) {
      return [];
    }

    const summaryContext = this.loadDateCategorySummaryContextFromBrowserTasks(
      normalizedRange.normalizedStart,
      normalizedRange.normalizedEnd
    );
    if (summaryContext.candidates.length === 0) {
      return [];
    }

    const dailySummary = this.buildDateCategorySummary(
      normalizedRange.normalizedStart,
      normalizedRange.normalizedEnd,
      summaryContext.candidates,
      summaryContext.recurrenceWeekdaysByTask
    );
    const monthlySummary = this.aggregateDateSummaryByMonth(dailySummary);

    return [...monthlySummary.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([monthKey, summary]) => ({
        monthKey,
        taskCount: summary.taskIds.size,
        categoryIds: summary.categoryIds,
      }));
  }

  private async listTaskAggregatesForDateBrowser(
    dateIso: string
  ): Promise<PersistedTaskAggregate[]> {
    const dateKey = this.toCalendarDateKey(dateIso);
    if (!dateKey) {
      return [];
    }

    const summaryContext = this.loadDateCategorySummaryContextFromBrowserTasks(
      dateKey,
      dateKey
    );
    if (summaryContext.candidates.length === 0) {
      return [];
    }

    const taskIds = new Set<string>();
    for (const candidate of summaryContext.candidates) {
      if (
        !this.candidateOccursOnLocalDate(
          candidate,
          dateKey,
          summaryContext.recurrenceWeekdaysByTask
        )
      ) {
        continue;
      }

      const taskId = candidate.task_id.trim();
      if (!taskId) {
        continue;
      }

      taskIds.add(taskId);
    }

    if (taskIds.size === 0) {
      return [];
    }

    return this.readBrowserTasks().filter(
      (task) =>
        taskIds.has(task.id) &&
        task.isActive &&
        !task.isArchived &&
        task.deletedAt === null &&
        (task.scheduleType === 'one_time' || !!task.recurrence)
    );
  }

  private loadDateCategorySummaryContextFromBrowserTasks(
    normalizedStart: string,
    normalizedEnd: string
  ): {
    candidates: TaskMonthCalendarCandidateRow[];
    recurrenceWeekdaysByTask: Map<string, Set<number>>;
  } {
    const tasks = this.readBrowserTasks().filter(
      (task) =>
        task.isActive &&
        !task.isArchived &&
        task.deletedAt === null &&
        (task.scheduleType === 'one_time' || !!task.recurrence)
    );

    const candidates: TaskMonthCalendarCandidateRow[] = [];
    const recurrenceWeekdaysByTask = new Map<string, Set<number>>();

    for (const task of tasks) {
      const candidate = this.toSummaryCandidateFromAggregate(task);
      if (!candidate) {
        continue;
      }

      const scheduleType = this.normalizeScheduleType(
        candidate.schedule_type,
        candidate.pattern !== null
      );
      if (scheduleType === 'one_time') {
        const startLocalDate = this.normalizeLocalDateKey(candidate.start_local_date);
        if (
          !startLocalDate ||
          isBefore(startLocalDate, normalizedStart) ||
          isAfter(startLocalDate, normalizedEnd)
        ) {
          continue;
        }
      } else {
        const startLocalDate = this.normalizeLocalDateKey(candidate.start_local_date);
        if (!startLocalDate || isAfter(startLocalDate, normalizedEnd)) {
          continue;
        }

        const endLocalDate = this.normalizeLocalDateKey(candidate.end_local_date);
        if (endLocalDate && isBefore(endLocalDate, normalizedStart)) {
          continue;
        }
      }

      candidates.push(candidate);
      if (
        candidate.pattern !== 'selected_weekdays' ||
        !task.recurrence ||
        !Array.isArray(task.recurrence.weekdays)
      ) {
        continue;
      }

      const taskId = candidate.task_id.trim();
      if (!taskId) {
        continue;
      }

      const weekdays = new Set<number>();
      for (const weekday of task.recurrence.weekdays) {
        const normalizedWeekday = this.sanitizeBoundedInteger(
          weekday.dayOfWeek,
          1,
          7
        );
        if (!normalizedWeekday) {
          continue;
        }

        weekdays.add(normalizedWeekday);
      }

      if (weekdays.size > 0) {
        recurrenceWeekdaysByTask.set(taskId, weekdays);
      }
    }

    return {
      candidates,
      recurrenceWeekdaysByTask,
    };
  }

  private toSummaryCandidateFromAggregate(
    task: PersistedTaskAggregate
  ): TaskMonthCalendarCandidateRow | null {
    const taskId = task.id.trim();
    if (!taskId) {
      return null;
    }

    const timezone = this.resolveTimezoneOrDevice(task.timezone);
    const scheduleType = this.normalizeScheduleType(task.scheduleType, task.recurrence);
    const recurrence = task.recurrence;
    const startLocalDate =
      this.normalizeLocalDateKey(task.startLocalDate) ??
      this.resolveLocalDateKeyFromIso(recurrence?.startDate, timezone) ??
      this.resolveLocalDateKeyFromIso(task.oneTimeDate, timezone);
    if (!startLocalDate) {
      return null;
    }

    const pattern =
      scheduleType === 'recurring' && recurrence
        ? this.parseSimplePattern(task.recurrenceType) ?? recurrence.pattern
        : null;
    const endLocalDate =
      this.normalizeLocalDateKey(task.endLocalDate) ??
      this.resolveLocalDateKeyFromIso(recurrence?.endDate, timezone);

    return {
      task_id: taskId,
      category_id: this.normalizeNullableText(task.categoryId),
      schedule_type: scheduleType,
      start_local_date: startLocalDate,
      end_local_date: endLocalDate,
      pattern,
      day_of_month: recurrence?.dayOfMonth ?? null,
      year_month: recurrence?.yearMonth ?? null,
      year_day: recurrence?.yearDay ?? null,
    };
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
          t.start_local_date,
          t.end_local_date,
          t.local_time,
          t.timezone,
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
    const recurrenceEnabled =
      this.normalizeScheduleType(taskRow.schedule_type, recurrence !== undefined) ===
        'recurring' && recurrence !== undefined;
    const recurrenceType: RecurrenceType =
      recurrenceEnabled && recurrence ? recurrence.pattern : 'none';

    return {
      ...this.mapTaskListItem(taskRow),
      recurrenceType,
      recurrenceEnabled,
      notificationsEnabled: notification !== undefined,
      recurrence,
      notification,
    };
  }

  private mapTaskListItem(row: TaskRow): TaskListItem {
    const scheduleType = this.normalizeScheduleType(
      row.schedule_type,
      this.toBooleanFlag(row.is_recurrence_enabled)
    );
    const timezone = this.resolveTimezoneOrDevice(row.timezone);
    const startLocalDate =
      this.normalizeLocalDateKey(row.start_local_date) ??
      this.resolveLocalDateKeyFromIso(row.one_time_date, timezone);
    const endLocalDate = this.normalizeLocalDateKey(row.end_local_date);
    const localTime = this.normalizeTimeValue(`${row.local_time ?? ''}`);
    const legacyOneTimeDate =
      scheduleType === 'one_time'
        ? this.resolveIsoDate(row.one_time_date) ??
          this.localDateToLegacyIso(startLocalDate)
        : null;

    return {
      id: row.id,
      title: row.title,
      description: this.normalizeNullableText(row.description),
      trackingMode: this.normalizeTaskMode(row.tracking_mode),
      priority: this.normalizeTaskPriority(row.priority),
      scheduleType,
      durationMode: this.normalizeDurationMode(row.duration_mode),
      startLocalDate,
      endLocalDate,
      localTime,
      timezone,
      oneTimeDate: legacyOneTimeDate,
      oneTimeTime:
        scheduleType === 'one_time'
          ? this.normalizeTimeValue(`${row.one_time_time ?? ''}`) ?? localTime
          : null,
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

  private async loadTaskAggregatesByIds(
    taskIds: readonly string[]
  ): Promise<PersistedTaskAggregate[]> {
    const normalizedTaskIds = [...new Set(
      taskIds
        .map((taskId) => taskId.trim())
        .filter((taskId) => taskId.length > 0)
    )];
    if (normalizedTaskIds.length === 0) {
      return [];
    }

    const placeholders = normalizedTaskIds.map(() => '?').join(', ');
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
          t.start_local_date,
          t.end_local_date,
          t.local_time,
          t.timezone,
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
        WHERE t.id IN (${placeholders}) AND t.deleted_at IS NULL
        ORDER BY t.updated_at DESC, t.created_at DESC
      `,
      [...normalizedTaskIds]
    );
    if (taskRows.length === 0) {
      return [];
    }

    const loadedTaskIds = taskRows.map((row) => row.id);
    const loadedPlaceholders = loadedTaskIds.map(() => '?').join(', ');

    const recurrenceRows = await this.sqliteManager.query<TaskRecurrenceBatchRow>(
      `
        SELECT
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
          timezone
        FROM task_recurrence
        WHERE task_id IN (${loadedPlaceholders})
      `,
      [...loadedTaskIds]
    );

    const recurrenceWeekdayRows = await this.sqliteManager.query<TaskRecurrenceWeekdayBatchRow>(
      `
        SELECT
          task_id,
          weekday_index,
          time_value,
          duration_min
        FROM task_recurrence_weekdays
        WHERE task_id IN (${loadedPlaceholders})
        ORDER BY task_id ASC, weekday_index ASC
      `,
      [...loadedTaskIds]
    );

    const notificationRows = await this.sqliteManager.query<TaskNotificationBatchRow>(
      `
        SELECT
          task_id,
          notification_type,
          trigger_mode,
          sound_name,
          tts_text,
          repeat_if_missed
        FROM task_notifications
        WHERE task_id IN (${loadedPlaceholders})
      `,
      [...loadedTaskIds]
    );

    const notificationOffsetRows =
      await this.sqliteManager.query<TaskNotificationOffsetBatchRow>(
        `
          SELECT
            task_id,
            offset_minutes
          FROM task_notification_offsets
          WHERE task_id IN (${loadedPlaceholders})
          ORDER BY task_id ASC, sort_order ASC, offset_minutes ASC
        `,
        [...loadedTaskIds]
      );

    const recurrenceByTask = this.groupRowsByTaskId(recurrenceRows);
    const recurrenceWeekdaysByTask = this.groupRowsByTaskId(recurrenceWeekdayRows);
    const notificationByTask = this.groupRowsByTaskId(notificationRows);
    const notificationOffsetsByTask = this.groupRowsByTaskId(notificationOffsetRows);

    return taskRows.map((taskRow) => {
      const recurrence = this.buildCanonicalRecurrence(
        recurrenceByTask.get(taskRow.id)?.[0],
        recurrenceWeekdaysByTask.get(taskRow.id) ?? []
      );
      const notification = this.buildCanonicalNotification(
        notificationByTask.get(taskRow.id)?.[0],
        notificationOffsetsByTask.get(taskRow.id) ?? []
      );
      const recurrenceEnabled =
        this.normalizeScheduleType(taskRow.schedule_type, recurrence !== undefined) ===
          'recurring' && recurrence !== undefined;
      const recurrenceType: RecurrenceType =
        recurrenceEnabled && recurrence ? recurrence.pattern : 'none';

      return {
        ...this.mapTaskListItem(taskRow),
        recurrenceType,
        recurrenceEnabled,
        notificationsEnabled: notification !== undefined,
        recurrence,
        notification,
      };
    });
  }

  private groupRowsByTaskId<T extends { task_id: string }>(
    rows: readonly T[]
  ): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const row of rows) {
      const taskId = row.task_id?.trim();
      if (!taskId) {
        continue;
      }

      const existingRows = grouped.get(taskId);
      if (existingRows) {
        existingRows.push(row);
        continue;
      }

      grouped.set(taskId, [row]);
    }

    return grouped;
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
    const calendarFields = this.resolveCalendarPersistenceFields(input);
    const recurrencePersisted = input.recurrence
      ? this.resolveRecurrencePersistenceState(input.recurrence)
      : undefined;
    const notificationPersisted = input.notification
      ? this.resolveNotificationPersistenceState(input.notification)
      : undefined;
    const recurrenceType: RecurrenceType = recurrencePersisted
      ? recurrencePersisted.pattern
      : 'none';

    return {
      id: taskId,
      title: input.title.trim(),
      description: this.normalizeNullableText(input.description),
      trackingMode: input.mode,
      priority: this.normalizeTaskPriority(input.priority),
      scheduleType: this.normalizeScheduleType(input.scheduleType, input.recurrence),
      durationMode: this.normalizeDurationMode(input.durationMode),
      startLocalDate: calendarFields.startLocalDate,
      endLocalDate: calendarFields.endLocalDate,
      localTime: calendarFields.localTime,
      timezone: calendarFields.timezone,
      oneTimeDate: calendarFields.legacyOneTimeDate,
      oneTimeTime: calendarFields.legacyOneTimeTime,
      estimatedDurationMin:
        input.mode === 'duration' ? input.estimatedDurationMin ?? null : null,
      categoryId: this.normalizeNullableText(input.categoryId),
      categoryName: categorySnapshot?.name ?? null,
      categoryColor: categorySnapshot?.color ?? null,
      isActive: true,
      isArchived: false,
      deletedAt: null,
      recurrenceType,
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
        .map((task) => {
          const scheduleType = this.normalizeScheduleType(task.scheduleType, task.recurrence);
          const recurrence = task.recurrence
            ? {
                ...task.recurrence,
                pattern: this.normalizeSimplePattern(task.recurrence.pattern),
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
            : undefined;
          const recurrenceType: RecurrenceType =
            scheduleType === 'recurring' && recurrence
              ? recurrence.pattern
              : 'none';

          return {
            ...task,
            recurrenceType,
            priority: this.normalizeTaskPriority(task.priority),
            scheduleType,
            durationMode: this.normalizeDurationMode(task.durationMode),
            startLocalDate:
              this.normalizeLocalDateKey(task.startLocalDate) ??
              this.resolveLocalDateKeyFromIso(
                task.oneTimeDate,
                this.resolveTimezoneOrDevice(task.timezone)
              ),
            endLocalDate: this.normalizeLocalDateKey(task.endLocalDate),
            localTime: this.normalizeTimeValue(`${task.localTime ?? ''}`),
            timezone: this.resolveTimezoneOrDevice(task.timezone),
            oneTimeDate: this.resolveIsoDate(task.oneTimeDate) ?? null,
            oneTimeTime: this.normalizeTimeValue(`${task.oneTimeTime ?? ''}`),
            categoryName: this.normalizeNullableText(task.categoryName),
            categoryColor: this.normalizeNullableText(task.categoryColor),
            deletedAt: this.normalizeNullableText(task.deletedAt),
            description: this.normalizeNullableText(task.description),
            recurrenceEnabled:
              scheduleType === 'recurring' && recurrence !== undefined,
            notificationsEnabled: task.notification !== undefined,
            recurrence,
          };
        });
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
    const recurrenceType = this.resolveInputRecurrenceType(input);
    const scheduleType: TaskScheduleType =
      recurrenceType === 'none' ? 'one_time' : 'recurring';
    const requestedDurationMode = this.normalizeDurationMode(input.durationMode);
    const durationMode: TaskDurationMode =
      mode === 'duration' && scheduleType === 'recurring'
        ? requestedDurationMode
        : 'single';
    const timezone = this.resolveTimezoneOrDevice(input.recurrence?.timezone ?? null);
    const estimatedDurationMin =
      mode === 'duration'
        ? this.sanitizeBoundedInteger(input.estimatedDurationMin, 1, 1440)
        : null;
    const oneTimeDateSeed =
      scheduleType === 'one_time'
        ? this.resolveLegacyIsoForCalendarInput(input.oneTimeDate ?? null, timezone)
        : null;
    const oneTimeDate = oneTimeDateSeed ?? null;
    const oneTimeTime =
      scheduleType === 'one_time'
        ? this.normalizeTimeValue(input.oneTimeTime ?? '')
        : null;
    const recurrence =
      recurrenceType === 'none'
        ? undefined
        : this.sanitizeRecurrenceInput(input.recurrence, recurrenceType)
    ;
    if (recurrenceType !== 'none' && !recurrence) {
      throw new Error('Recurring tasks require recurrence settings.');
    }
    const resolvedRecurrenceType: RecurrenceType = recurrence
      ? this.resolveRecurrenceTypeFromRecurrenceInput(recurrence)
      : 'none';
    if (resolvedRecurrenceType !== recurrenceType) {
      throw new Error('Recurrence type does not match recurrence settings.');
    }
    const hasTimedOccurrence =
      (scheduleType === 'one_time' && oneTimeTime !== null) ||
      (recurrence?.hasTime ?? false);

    return {
      title,
      description: this.normalizeNullableText(input.description),
      mode,
      priority,
      recurrenceType: resolvedRecurrenceType,
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

  private resolveInputRecurrenceType(input: CreateTaskInput): RecurrenceType {
    const explicit = this.parseRecurrenceType(input.recurrenceType);
    if (explicit) {
      return explicit;
    }

    const scheduleType = this.normalizeScheduleType(input.scheduleType, input.recurrence);
    if (scheduleType === 'one_time') {
      return 'none';
    }

    if (!input.recurrence) {
      return 'daily';
    }

    return this.resolveRecurrenceTypeFromRecurrenceInput(input.recurrence);
  }

  private resolveRecurrenceTypeFromRecurrenceInput(
    recurrence: CreateTaskRecurrenceInput
  ): SimpleRecurrenceType {
    if (recurrence.mode === 'weekly_schedule') {
      if (
        recurrence.simpleType !== 'daily' &&
        recurrence.simpleType !== 'selected_weekdays'
      ) {
        throw new Error(
          'Weekly schedule recurrence requires simpleType daily or selected_weekdays.'
        );
      }

      return recurrence.simpleType;
    }

    if (recurrence.mode !== 'simple') {
      throw new Error('Unsupported recurrence mode.');
    }

    const simpleType = this.parseSimplePattern(recurrence.simpleType);
    if (!simpleType) {
      throw new Error('Simple recurrence requires a valid recurrence type.');
    }

    return simpleType;
  }

  private sanitizeRecurrenceInput(
    recurrence: CreateTaskRecurrenceInput | undefined,
    expectedType: SimpleRecurrenceType
  ): CreateTaskRecurrenceInput | undefined {
    if (!recurrence) {
      return undefined;
    }

    const timezone = this.resolveTimezoneOrDevice(recurrence.timezone);
    const startDateSeed = this.resolveLegacyIsoForCalendarInput(
      recurrence.startDate,
      timezone
    );
    const startsToday = recurrence.startsToday ?? this.isTodayDate(startDateSeed, timezone);
    const startDate = this.resolvePersistedStartDate(
      startsToday,
      startDateSeed,
      timezone
    );
    const normalizedEndDate = this.resolveLegacyIsoForCalendarInput(
      recurrence.endDate ?? null,
      timezone
    );
    const hasEndDate =
      (recurrence.hasEndDate ?? normalizedEndDate !== null) &&
      normalizedEndDate !== null;
    if (recurrence.mode === 'weekly_schedule') {
      if (expectedType !== 'daily' && expectedType !== 'selected_weekdays') {
        throw new Error('Weekly schedule recurrence only supports daily or selected_weekdays.');
      }
      if (recurrence.simpleType !== expectedType) {
        throw new Error('Weekly schedule recurrence type does not match expected type.');
      }
      const weeklyDayTimes = this.normalizeWeeklyDayTimes(recurrence.weeklyDayTimes ?? []);
      if (weeklyDayTimes.length === 0) {
        throw new Error('Selected weekdays recurrence requires at least one day.');
      }
      if (
        expectedType === 'daily' &&
        !this.hasAllWeekdaysSelected(
          weeklyDayTimes.map((weekday) => weekday.dayOfWeek)
        )
      ) {
        throw new Error('Daily recurrence with per-day time requires all weekdays.');
      }

      return {
        mode: 'weekly_schedule',
        simpleType: expectedType,
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

    if (recurrence.mode !== 'simple') {
      throw new Error('Unsupported recurrence mode.');
    }
    const simpleType = this.parseSimplePattern(recurrence.simpleType);
    if (!simpleType) {
      throw new Error('Simple recurrence requires a valid recurrence type.');
    }
    if (simpleType !== expectedType) {
      throw new Error('Simple recurrence type does not match expected type.');
    }
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
  private enforceForwardOnlyRecurrenceOnUpdate(input: CreateTaskInput): CreateTaskInput {
    if (input.scheduleType === 'one_time' || !input.recurrence) {
      return input;
    }

    const timezone = this.resolveTimezoneOrDevice(input.recurrence.timezone);
    const todayLocalDate = formatCalendarDate(getToday(timezone));
    const todayLegacyIso =
      this.localDateToLegacyIso(todayLocalDate) ?? new Date().toISOString();
    const normalizedEndDate = this.resolveLegacyIsoForCalendarInput(
      input.recurrence.endDate ?? null,
      timezone
    );
    const normalizedEndDateKey = this.resolveLocalDateKeyFromIso(
      normalizedEndDate,
      timezone
    );
    const effectiveEndDate =
      input.recurrence.hasEndDate && normalizedEndDateKey
        ? isBefore(normalizedEndDateKey, todayLocalDate)
          ? todayLegacyIso
          : normalizedEndDate
        : normalizedEndDate;

    return {
      ...input,
      recurrence: {
        ...input.recurrence,
        startsToday: true,
        startDate: todayLegacyIso,
        endDate: effectiveEndDate,
      },
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

  private resolveCalendarPersistenceFields(
    input: CreateTaskInput
  ): TaskCalendarPersistenceFields {
    const timezone = this.resolveTimezoneOrDevice(input.recurrence?.timezone ?? null);
    const fallbackStartDate = formatCalendarDate(getToday(timezone));

    if (input.scheduleType === 'one_time') {
      const startLocalDate =
        this.resolveLocalDateKeyFromIso(input.oneTimeDate, timezone) ?? fallbackStartDate;
      const oneTimeTime = this.normalizeTimeValue(input.oneTimeTime ?? '');
      return {
        startLocalDate,
        endLocalDate: null,
        localTime: oneTimeTime,
        timezone,
        legacyOneTimeDate: this.localDateToLegacyIso(startLocalDate),
        legacyOneTimeTime: oneTimeTime,
      };
    }

    const recurrence = input.recurrence;
    const startLocalDate =
      this.resolveLocalDateKeyFromIso(recurrence?.startDate, timezone) ??
      fallbackStartDate;
    const endLocalDate =
      recurrence?.hasEndDate === true
        ? this.resolveLocalDateKeyFromIso(recurrence.endDate ?? null, timezone)
        : null;
    const localTime =
      recurrence?.hasTime === true
        ? recurrence.mode === 'weekly_schedule'
          ? null
          : this.normalizeTimeValue(recurrence.timeOfDay ?? '')
        : null;

    return {
      startLocalDate,
      endLocalDate,
      localTime,
      timezone,
      legacyOneTimeDate: null,
      legacyOneTimeTime: null,
    };
  }

  private async insertTask(
    tx: SqliteTransactionContext,
    taskId: string,
    input: CreateTaskInput,
    nowIso: string
  ): Promise<void> {
    const calendarFields = this.resolveCalendarPersistenceFields(input);
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
          start_local_date,
          end_local_date,
          local_time,
          timezone,
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        calendarFields.startLocalDate,
        calendarFields.endLocalDate,
        calendarFields.localTime,
        calendarFields.timezone,
        calendarFields.legacyOneTimeDate,
        calendarFields.legacyOneTimeTime,
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
    const calendarFields = this.resolveCalendarPersistenceFields(input);
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
          start_local_date = ?,
          end_local_date = ?,
          local_time = ?,
          timezone = ?,
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
        calendarFields.startLocalDate,
        calendarFields.endLocalDate,
        calendarFields.localTime,
        calendarFields.timezone,
        calendarFields.legacyOneTimeDate,
        calendarFields.legacyOneTimeTime,
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

    if (persisted.weekdays.length === 0) {
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
    const timezone = this.resolveTimezoneOrDevice(recurrence.timezone);
    const normalizedStartDate = this.resolveLegacyIsoForCalendarInput(
      recurrence.startDate,
      timezone
    );
    const startsToday =
      recurrence.startsToday ?? this.isTodayDate(normalizedStartDate, timezone);
    const startDate = this.resolvePersistedStartDate(
      startsToday,
      normalizedStartDate,
      timezone
    );
    const normalizedEndDate = this.resolveLegacyIsoForCalendarInput(
      recurrence.endDate ?? null,
      timezone
    );
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
      const pattern: SimpleRecurrenceType =
        recurrence.simpleType === 'daily' ? 'daily' : 'selected_weekdays';
      if (
        pattern === 'daily' &&
        !this.hasAllWeekdaysSelected(weekdays.map((weekday) => weekday.dayOfWeek))
      ) {
        throw new Error('Daily recurrence with per-day time requires all weekdays.');
      }

      return {
        pattern,
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
      (pattern === 'selected_weekdays' || pattern === 'daily')
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
    const timezone = this.resolveTimezoneOrDevice(recurrenceRow.timezone);
    const startDate =
      this.resolveIsoDate(recurrenceRow.start_date) ??
      this.resolvePersistedStartDate(startsToday, null, timezone);
    const rawEndDate = this.resolveIsoDate(recurrenceRow.end_date);
    const hasEndDate = this.toBooleanFlag(recurrenceRow.has_end_date) && rawEndDate !== null;
    const endDate = hasEndDate ? rawEndDate : null;

    let weekdays = this.normalizePersistedWeekdays(weekdayRows);
    if (pattern !== 'selected_weekdays' && pattern !== 'daily') {
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
      weekdays =
        pattern === 'selected_weekdays'
          ? weekdays.map((weekday) => ({ ...weekday, timeValue: null }))
          : [];
    } else if (sameTimeForSelectedDays) {
      weekdays =
        pattern === 'selected_weekdays'
          ? weekdays.map((weekday) => ({ ...weekday, timeValue: null }))
          : [];
    } else {
      commonTime = null;
      weekdays = weekdays.map((weekday) => ({
        ...weekday,
        timeValue: this.normalizeTimeValue(weekday.timeValue ?? ''),
      }));
      if (
        pattern === 'daily' &&
        !this.hasAllWeekdaysSelected(weekdays.map((weekday) => weekday.dayOfWeek))
      ) {
        pattern = 'selected_weekdays';
      }
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

  private hasAllWeekdaysSelected(daysOfWeek: Iterable<number>): boolean {
    const selectedDays = new Set<number>();
    for (const dayOfWeek of daysOfWeek) {
      if (Number.isInteger(dayOfWeek) && dayOfWeek >= 1 && dayOfWeek <= 7) {
        selectedDays.add(dayOfWeek);
      }
    }

    return selectedDays.size === 7;
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

    const resolvedTimezone = this.resolveTimezoneOrDevice(timezone);
    const localDate = this.resolveCalendarDateKey(startDateIso, resolvedTimezone);
    if (!localDate) {
      return { dayOfMonth: null, monthOfYear: null };
    }
    const parts = parseCalendarDate(localDate);

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

  private parseSimplePattern(value: unknown): SimpleRecurrenceType | null {
    if (
      value === 'daily' ||
      value === 'selected_weekdays' ||
      value === 'monthly' ||
      value === 'yearly'
    ) {
      return value;
    }

    return null;
  }

  private parseRecurrenceType(value: unknown): RecurrenceType | null {
    if (value === 'none') {
      return 'none';
    }

    return this.parseSimplePattern(value);
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

  private isTodayDate(value: string | null, timezone: string): boolean {
    if (!value) {
      return false;
    }

    const localDate = this.resolveCalendarDateKey(value, timezone);
    if (!localDate) {
      return false;
    }

    const today = formatCalendarDate(getToday(timezone));
    return localDate === today;
  }

  private resolvePersistedStartDate(
    startsToday: boolean,
    value: string | null,
    timezone: string | null = null
  ): string {
    const resolvedTimezone = this.resolveTimezoneOrDevice(timezone);
    const todayLocalDate = formatCalendarDate(getToday(resolvedTimezone));
    const todayLegacyIso =
      this.localDateToLegacyIso(todayLocalDate) ?? new Date().toISOString();

    if (startsToday) {
      return todayLegacyIso;
    }

    const normalizedValue = this.resolveLegacyIsoForCalendarInput(
      value,
      resolvedTimezone
    );
    if (normalizedValue) {
      return normalizedValue;
    }

    const tomorrowLocalDate = formatCalendarDate(addDays(todayLocalDate, 1));
    return (
      this.localDateToLegacyIso(tomorrowLocalDate) ?? new Date().toISOString()
    );
  }

  private candidateOccursOnLocalDate(
    candidate: TaskMonthCalendarCandidateRow,
    dateKey: string,
    recurrenceWeekdaysByTask: ReadonlyMap<string, ReadonlySet<number>>
  ): boolean {
    const scheduleType = this.normalizeScheduleType(
      candidate.schedule_type,
      candidate.pattern !== null
    );
    const startLocalDate = this.normalizeLocalDateKey(candidate.start_local_date);
    if (!startLocalDate) {
      return false;
    }

    if (scheduleType === 'one_time') {
      return startLocalDate === dateKey;
    }

    if (isBefore(dateKey, startLocalDate)) {
      return false;
    }

    const endLocalDate = this.normalizeLocalDateKey(candidate.end_local_date);
    if (endLocalDate && isAfter(dateKey, endLocalDate)) {
      return false;
    }

    const dateParts = parseCalendarDate(dateKey);
    const pattern = this.normalizeSimplePattern(candidate.pattern);
    switch (pattern) {
      case 'daily':
        return true;
      case 'selected_weekdays': {
        const taskId = candidate.task_id.trim();
        const selectedWeekdays = recurrenceWeekdaysByTask.get(taskId);
        if (!selectedWeekdays || selectedWeekdays.size === 0) {
          return true;
        }

        return selectedWeekdays.has(getWeekday(dateKey, 'UTC'));
      }
      case 'monthly':
        return Number(candidate.day_of_month) === dateParts.day;
      case 'yearly':
        return (
          Number(candidate.year_month) === dateParts.month &&
          Number(candidate.year_day) === dateParts.day
        );
      default:
        return false;
    }
  }

  private normalizeLocalDateKey(value: unknown): string | null {
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
      return null;
    }
  }

  private resolveLocalDateKeyFromIso(
    value: string | null | undefined,
    timezone: string
  ): string | null {
    const directLocalDate = this.normalizeLocalDateKey(value);
    if (directLocalDate) {
      return directLocalDate;
    }

    const iso = this.resolveIsoDate(value);
    if (!iso) {
      return null;
    }

    try {
      return formatCalendarDate(toCalendarDate(new Date(iso), timezone));
    } catch {
      return null;
    }
  }

  private resolveCalendarDateKey(
    value: string | null | undefined,
    timezone: string
  ): string | null {
    const directLocalDate = this.normalizeLocalDateKey(value);
    if (directLocalDate) {
      return directLocalDate;
    }

    return this.resolveLocalDateKeyFromIso(value, timezone);
  }

  private resolveLegacyIsoForCalendarInput(
    value: string | null | undefined,
    timezone: string
  ): string | null {
    const localDate = this.resolveCalendarDateKey(value, timezone);
    if (!localDate) {
      return null;
    }

    return this.localDateToLegacyIso(localDate);
  }

  private localDateToLegacyIso(localDate: string | null | undefined): string | null {
    const normalized = this.normalizeLocalDateKey(localDate);
    if (!normalized) {
      return null;
    }

    const parsed = parseCalendarDate(normalized);
    return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0)).toISOString();
  }

  private resolveTimezoneOrDevice(value: unknown): string {
    const fallback = getDeviceTimezone();
    const candidate = this.normalizeNullableText(value) ?? fallback;
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: candidate }).format(new Date());
      return candidate;
    } catch {
      return fallback;
    }
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

  private toCalendarDateKey(value: string | null | undefined): string | null {
    const direct = this.normalizeLocalDateKey(value);
    if (direct) {
      return direct;
    }

    const iso = this.resolveIsoDate(value);
    if (!iso) {
      return null;
    }

    try {
      return formatCalendarDate(toCalendarDate(new Date(iso), getDeviceTimezone()));
    } catch {
      return iso.slice(0, 10);
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
