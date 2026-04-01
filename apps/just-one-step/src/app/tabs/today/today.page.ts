import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonTitle,
  IonToolbar,
} from "@ionic/angular/standalone";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { LoadingStateComponent } from "@sheldrapps/ui-theme";
import { addIcons } from "ionicons";
import {
  play,
  playOutline,
  refreshOutline,
  timerOutline,
} from "ionicons/icons";
import {
  PersistedTaskAggregate,
  type UpdateTaskInput,
  TaskRepository,
} from "../../database/repositories/task.repository";
import {
  TodayNowCard,
  TodayTaskListItem,
  TodayUpcomingGap,
} from "./today.models";
import { TodayMotivationalCopyComponent } from "./components/today-motivational-copy.component";
import { TodayNowSectionComponent } from "./components/today-now-section.component";
import { TodayFreeTimesSectionComponent } from "./components/today-free-times-section.component";
import { TodayTasksSectionComponent } from "./components/today-tasks-section.component";
import {
  buildGaps,
  rankBacklog,
  type TaskAggregate,
} from "./today-selection.engine";
import {
  formatCalendarDate,
  getDeviceTimezone,
  getWeekday,
  isAfter,
  isBefore,
  parseCalendarDate,
  toCalendarDate,
} from "../../shared/calendar";

interface TodayTaskTime {
  time: string | null;
  startMinutes: number | null;
}

interface TodayTaskItem {
  task: PersistedTaskAggregate;
  startMinutes: number | null;
  endMinutes: number | null;
  durationMin: number;
  timeLabel: string | null;
}

interface TodayRunningSession {
  taskId: string;
  startedAt: string;
  expectedEndAt: string;
  durationMin: number;
  status: "running" | "completed";
}

interface ActiveTimerWindowRecord {
  startedAt: string;
  expectedEndAt?: string | null;
  endedAt?: string | null;
  completedAt?: string | null;
  status?: string | null;
  source?: string | null;
  taskId?: string | null;
}

const TODAY_RUNNING_SESSION_STORAGE_KEY =
  "just-one-step.today.running-session.v1";
const ACTIVE_TIMER_WINDOWS_STORAGE_KEY =
  "just-one-step.timer.active-windows.v1";
const DEFAULT_DURATION_MIN = 25;
const DEFAULT_CHECK_DURATION_MIN = 10;
const DEFAULT_FIVE_MIN_DURATION = 5;
const DEFAULT_POSTPONE_MINUTES = 30;
const MAX_UPCOMING_FREE_SPACES = 2;
const TODAY_QUOTES: ReadonlyArray<readonly [string, string]> = [
  ["TODAY.QUOTES.0.LINE_1", "TODAY.QUOTES.0.LINE_2"],
  ["TODAY.QUOTES.1.LINE_1", "TODAY.QUOTES.1.LINE_2"],
  ["TODAY.QUOTES.2.LINE_1", "TODAY.QUOTES.2.LINE_2"],
  ["TODAY.QUOTES.3.LINE_1", "TODAY.QUOTES.3.LINE_2"],
];

@Component({
  standalone: true,
  selector: "app-today",
  templateUrl: "./today.page.html",
  styleUrls: ["./today.page.scss"],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonNote,
    TranslateModule,
    LoadingStateComponent,
    TodayMotivationalCopyComponent,
    TodayNowSectionComponent,
    TodayFreeTimesSectionComponent,
    TodayTasksSectionComponent,
  ],
})
export class TodayPage {
  private readonly taskRepository = inject(TaskRepository);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  isLoading = false;
  loadFailed = false;

  nowCard: TodayNowCard | null = null;
  nowMode: "active" | "free" = "free";
  nowFreeRangeLabel: string | null = null;
  upcomingFreeSpaces: TodayUpcomingGap[] = [];
  todayItems: TodayTaskListItem[] = [];
  runningTaskId: string | null = null;
  dailyIntentLine1 = "";
  dailyIntentLine2 = "";

  private now = new Date();
  private nowTickerId: number | null = null;
  private currentDateKey = this.resolveDateKey(this.now);
  private todayTasks: PersistedTaskAggregate[] = [];

  constructor() {
    addIcons({ play, playOutline, refreshOutline, timerOutline });
  }

  async ionViewWillEnter(): Promise<void> {
    this.now = new Date();
    await this.loadTodayData();
    this.startNowTicker();
  }

  ionViewDidLeave(): void {
    this.stopNowTicker();
  }

  get hasNowCard(): boolean {
    return this.nowCard !== null;
  }

  get hasUpcomingFreeSpaces(): boolean {
    return this.upcomingFreeSpaces.length > 0;
  }

  get hasTodayItems(): boolean {
    return this.todayItems.length > 0;
  }

  async reloadTodayData(): Promise<void> {
    await this.loadTodayData();
  }

  async executeNow(): Promise<void> {
    if (!this.nowCard) {
      return;
    }

    this.triggerTapFeedback();
    this.startTaskSession(this.nowCard.taskId, this.nowCard.durationMin);
    this.refreshComputedSections();
  }

  async executeNowFiveMinutes(): Promise<void> {
    if (!this.nowCard) {
      return;
    }

    this.triggerTapFeedback();
    this.startTaskSession(this.nowCard.taskId, DEFAULT_FIVE_MIN_DURATION);
    this.refreshComputedSections();
  }

  async reprogramNow(): Promise<void> {
    if (!this.nowCard) {
      return;
    }

    await this.router.navigate(["/task", this.nowCard.taskId, "edit"]);
  }

  async createTask(): Promise<void> {
    await this.router.navigate(["/task/new"]);
  }

  executeTodayTask(item: TodayTaskListItem): void {
    this.triggerTapFeedback();
    this.startTaskSession(item.taskId, item.durationMin);
    this.refreshComputedSections();
  }

  isTaskRunning(taskId: string): boolean {
    return this.runningTaskId === taskId;
  }

  async completeNowCheckTask(): Promise<void> {
    if (!this.nowCard || this.nowCard.task.trackingMode !== "check") {
      return;
    }

    await this.taskRepository.archiveTask(this.nowCard.taskId);
    await this.loadTodayData();
  }

  async postponeNowCheckTask(): Promise<void> {
    if (!this.nowCard) {
      return;
    }

    if (this.nowCard.task.trackingMode !== "check") {
      await this.reprogramNow();
      return;
    }

    if (this.nowCard.task.scheduleType !== "one_time") {
      await this.reprogramNow();
      return;
    }

    const postponed = new Date(Date.now() + DEFAULT_POSTPONE_MINUTES * 60_000);
    const nextTime = this.minutesToTime(
      postponed.getHours() * 60 + postponed.getMinutes(),
    );
    const nextDateIso = new Date(
      postponed.getFullYear(),
      postponed.getMonth(),
      postponed.getDate(),
      12,
      0,
      0,
      0,
    ).toISOString();

    await this.taskRepository.updateTask(this.nowCard.taskId, {
      ...this.toUpdateTaskInput(this.nowCard.task),
      oneTimeDate: nextDateIso,
      oneTimeTime: nextTime,
    });
    await this.loadTodayData();
  }

  withAlpha(hexColor: string, alpha: number): string {
    const normalized = hexColor.trim();
    const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
    if (hex.length !== 6) {
      return "rgba(0, 0, 0, 0.08)";
    }

    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
      return "rgba(0, 0, 0, 0.08)";
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private async loadTodayData(): Promise<void> {
    this.isLoading = true;
    this.loadFailed = false;

    try {
      this.now = new Date();
      this.currentDateKey = this.resolveDateKey(this.now);
      this.updateDailyIntent(this.now);
      this.todayTasks = await this.loadTasksForDate(this.currentDateKey);
      this.refreshComputedSections();
    } catch {
      this.todayTasks = [];
      this.nowCard = null;
      this.nowMode = "free";
      this.nowFreeRangeLabel = null;
      this.upcomingFreeSpaces = [];
      this.todayItems = [];
      this.runningTaskId = null;
      this.loadFailed = true;
    } finally {
      this.isLoading = false;
    }
  }

  private refreshComputedSections(): void {
    const items: TodayTaskItem[] = [];
    const byTaskId = new Map<string, TodayTaskItem>();
    for (const task of this.todayTasks) {
      const time = this.resolveTimeForToday(task);
      const duration = this.resolveTaskDurationForToday(task);
      const start = time.startMinutes;
      const end = start === null ? null : start + Math.max(duration, 1);
      const item: TodayTaskItem = {
        task,
        startMinutes: start,
        endMinutes: end,
        durationMin: duration,
        timeLabel: this.buildTaskTimeLabel(time.time, start, end),
      };
      items.push(item);
      byTaskId.set(task.id, item);
    }

    const nowMinutes = this.now.getHours() * 60 + this.now.getMinutes();
    const normalizedTasks = items.map((item) => this.toTaskAggregate(item));
    const currentTask = this.findCurrentTask(normalizedTasks, nowMinutes);

    this.nowMode = currentTask ? "active" : "free";
    this.nowCard = this.toNowCardFromCurrentTask(
      currentTask,
      byTaskId,
      nowMinutes,
    );
    this.nowFreeRangeLabel = this.resolveNowFreeRangeLabel(
      normalizedTasks,
      nowMinutes,
    );

    this.upcomingFreeSpaces = buildGaps(normalizedTasks, nowMinutes)
      .slice(0, MAX_UPCOMING_FREE_SPACES)
      .map((gap) => ({
        key: `${gap.startMinutes}-${gap.endMinutes}`,
        rangeLabel: `${this.minutesToTime(gap.startMinutes)} - ${this.minutesToTime(
          gap.endMinutes,
        )}`,
        durationLabel: this.formatDuration(gap.durationMinutes),
        sizeTier: this.resolveTaskSizeTier(gap.durationMinutes),
      }));

    this.todayItems = this.buildTodayItems(
      normalizedTasks,
      currentTask?.id ?? null,
      byTaskId,
      this.resolveCompletedTaskIdsForToday(),
    );

    const runningSession = this.readRunningSession();
    this.runningTaskId = runningSession?.taskId ?? null;
  }

  private toTaskAggregate(item: TodayTaskItem): TaskAggregate {
    const hasTime = item.startMinutes !== null && item.endMinutes !== null;
    return {
      id: item.task.id,
      title: item.task.title,
      durationMinutes: item.durationMin,
      hasTime,
      startMinutes: hasTime ? (item.startMinutes as number) : undefined,
      endMinutes: hasTime ? (item.endMinutes as number) : undefined,
      priority: item.task.priority,
    };
  }

  private findCurrentTask(
    tasks: readonly TaskAggregate[],
    nowMinutes: number,
  ): TaskAggregate | null {
    return (
      tasks.find(
        (task) =>
          task.hasTime &&
          typeof task.startMinutes === "number" &&
          typeof task.endMinutes === "number" &&
          task.startMinutes <= nowMinutes &&
          nowMinutes < task.endMinutes,
      ) ?? null
    );
  }

  private toNowCardFromCurrentTask(
    currentTask: TaskAggregate | null,
    byTaskId: ReadonlyMap<string, TodayTaskItem>,
    nowMinutes: number,
  ): TodayNowCard | null {
    if (!currentTask) {
      return null;
    }

    const sourceItem = byTaskId.get(currentTask.id);
    if (!sourceItem) {
      return null;
    }

    return this.toNowCard(sourceItem, nowMinutes);
  }

  private toNowCard(item: TodayTaskItem, nowMinutes: number): TodayNowCard {
    const task = item.task;
    const color = this.resolveTaskColor(task);
    const progressPercent = this.resolveNowProgress(item, nowMinutes);
    const hasExplicitDuration = this.hasExplicitDuration(task);
    return {
      taskId: task.id,
      title: task.title,
      categoryLabel:
        task.categoryName?.trim() ||
        this.translate.instant("TODAY.CATEGORY_NONE"),
      priorityLabel: this.translate.instant(`TASK.PRIORITY.${task.priority}`),
      durationLabel: this.formatDuration(item.durationMin),
      contextLabel: this.translate.instant("TODAY.NOW_CONTEXT_CURRENT"),
      timeLabel: item.timeLabel,
      color,
      progressPercent,
      showPercentRing: !hasExplicitDuration,
      timerLabel: hasExplicitDuration
        ? `${item.durationMin} ${this.translate.instant("TASK_DETAIL.MINUTES_SHORT")}`
        : null,
      durationMin: item.durationMin,
      task,
    };
  }

  private hasExplicitDuration(task: PersistedTaskAggregate): boolean {
    if ((task.estimatedDurationMin ?? 0) > 0) {
      return true;
    }

    const recurrence = task.recurrence;
    if (!recurrence) {
      return false;
    }

    if ((recurrence.commonDurationMin ?? 0) > 0) {
      return true;
    }

    return recurrence.weekdays.some(
      (weekday) => (weekday.durationMin ?? 0) > 0,
    );
  }

  private resolveNowProgress(item: TodayTaskItem, nowMinutes: number): number {
    const runningSession = this.readRunningSession();
    if (runningSession && runningSession.taskId === item.task.id) {
      const startedAt = new Date(runningSession.startedAt).getTime();
      const expectedEndAt = new Date(runningSession.expectedEndAt).getTime();
      if (
        Number.isFinite(startedAt) &&
        Number.isFinite(expectedEndAt) &&
        expectedEndAt > startedAt
      ) {
        const nowTimestamp = Date.now();
        const raw =
          ((nowTimestamp - startedAt) / (expectedEndAt - startedAt)) * 100;
        return this.clampPercent(raw);
      }
    }

    if (item.startMinutes === null || item.endMinutes === null) {
      return 0;
    }

    const raw =
      ((nowMinutes - item.startMinutes) /
        Math.max(1, item.endMinutes - item.startMinutes)) *
      100;
    return this.clampPercent(raw);
  }

  private buildTodayItems(
    tasks: readonly TaskAggregate[],
    currentTaskId: string | null,
    byTaskId: ReadonlyMap<string, TodayTaskItem>,
    completedTaskIds: ReadonlySet<string>,
  ): TodayTaskListItem[] {
    return tasks
      .filter((task) => task.id !== currentTaskId)
      .sort((left, right) => {
        const leftCompleted = completedTaskIds.has(left.id);
        const rightCompleted = completedTaskIds.has(right.id);
        if (leftCompleted !== rightCompleted) {
          return leftCompleted ? 1 : -1;
        }

        const priorityDiff =
          this.priorityRank(left.priority) - this.priorityRank(right.priority);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        const leftStart = left.startMinutes ?? Number.MAX_SAFE_INTEGER;
        const rightStart = right.startMinutes ?? Number.MAX_SAFE_INTEGER;
        if (leftStart !== rightStart) {
          return leftStart - rightStart;
        }

        return left.title.localeCompare(right.title);
      })
      .map((task) => byTaskId.get(task.id))
      .filter((item): item is TodayTaskItem => !!item)
      .map((item) => ({
        taskId: item.task.id,
        priorityCode: item.task.priority,
        title: item.task.title,
        priorityLabel: this.translate.instant(
          `TASK.PRIORITY.${item.task.priority}`,
        ),
        completed: completedTaskIds.has(item.task.id),
        durationLabel: this.formatDuration(item.durationMin),
        timeLabel: item.timeLabel,
        color: this.resolveTaskColor(item.task),
        sizeTier: this.resolveTaskSizeTier(item.durationMin),
        durationMin: item.durationMin,
        task: item.task,
      }));
  }

  private resolveCompletedTaskIdsForToday(): Set<string> {
    const todayKey = this.currentDateKey;
    const completed = new Set<string>();
    for (const windowRecord of this.readActiveTimerWindows()) {
      if (!windowRecord.taskId || windowRecord.source !== "today") {
        continue;
      }

      const status = (windowRecord.status ?? "").trim().toLowerCase();
      if (status !== "completed") {
        continue;
      }

      const completedAt =
        windowRecord.completedAt?.trim() || windowRecord.endedAt?.trim() || "";
      if (!completedAt) {
        continue;
      }

      const completedDate = new Date(completedAt);
      if (Number.isNaN(completedDate.getTime())) {
        continue;
      }

      if (this.resolveDateKey(completedDate) !== todayKey) {
        continue;
      }

      completed.add(windowRecord.taskId);
    }

    return completed;
  }

  private resolveTaskSizeTier(durationMin: number): "sm" | "md" | "lg" {
    if (durationMin <= 15) {
      return "sm";
    }

    if (durationMin <= 45) {
      return "md";
    }

    return "lg";
  }

  private async loadTasksForDate(
    dateKey: string,
  ): Promise<PersistedTaskAggregate[]> {
    const dailyLoader = (this.taskRepository as Partial<TaskRepository>)
      .listTaskAggregatesForDate;
    if (typeof dailyLoader !== "function") {
      throw new Error("Today requires listTaskAggregatesForDate support.");
    }

    const loaded = await dailyLoader.call(this.taskRepository, dateKey);
    if (!loaded) {
      throw new Error("listTaskAggregatesForDate returned null for Today.");
    }

    return loaded;
  }

  private taskOccursOnDate(task: PersistedTaskAggregate, date: Date): boolean {
    const dateKey = this.resolveDateKey(date);

    if (task.scheduleType === "one_time") {
      const oneTimeDate =
        this.normalizeLocalDateKey(task.startLocalDate) ??
        this.resolveLocalDateKeyFromIso(
          task.oneTimeDate,
          this.resolveTaskTimezone(task),
        );
      return !!oneTimeDate && oneTimeDate === dateKey;
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence) {
      return false;
    }

    const startDate =
      this.normalizeLocalDateKey(task.startLocalDate) ??
      this.resolveLocalDateKeyFromIso(
        recurrence.startDate,
        this.resolveTaskTimezone(task),
      );
    if (startDate && isBefore(dateKey, startDate)) {
      return false;
    }

    if (recurrence.hasEndDate && recurrence.endDate) {
      const endDate =
        this.normalizeLocalDateKey(task.endLocalDate) ??
        this.resolveLocalDateKeyFromIso(
          recurrence.endDate,
          this.resolveTaskTimezone(task),
        );
      if (endDate && isAfter(dateKey, endDate)) {
        return false;
      }
    }

    const dateParts = parseCalendarDate(dateKey);
    const weekday = getWeekday(dateKey, "UTC");
    switch (recurrence.pattern) {
      case "daily":
        return true;
      case "selected_weekdays":
        return recurrence.weekdays.some((entry) => entry.dayOfWeek === weekday);
      case "monthly":
        return recurrence.dayOfMonth === dateParts.day;
      case "yearly":
        return (
          recurrence.yearMonth === dateParts.month &&
          recurrence.yearDay === dateParts.day
        );
      default:
        return false;
    }
  }

  private resolveTimeForToday(task: PersistedTaskAggregate): TodayTaskTime {
    if (task.scheduleType === "one_time") {
      const oneTime = task.oneTimeTime?.trim() ?? "";
      return {
        time: oneTime || null,
        startMinutes: oneTime ? this.timeToMinutes(oneTime) : null,
      };
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence || !recurrence.hasTime) {
      return { time: null, startMinutes: null };
    }

    const weekday = getWeekday(this.currentDateKey, "UTC");
    let resolvedTime: string | null = null;
    if (recurrence.pattern === "selected_weekdays") {
      const weekdayTime = recurrence.weekdays.find(
        (weekdayConfig) => weekdayConfig.dayOfWeek === weekday,
      )?.timeValue;
      resolvedTime = weekdayTime || recurrence.commonTime || null;
    } else {
      resolvedTime =
        recurrence.commonTime || recurrence.weekdays[0]?.timeValue || null;
    }

    return {
      time: resolvedTime,
      startMinutes: resolvedTime ? this.timeToMinutes(resolvedTime) : null,
    };
  }

  private resolveTaskDurationForToday(task: PersistedTaskAggregate): number {
    if (task.trackingMode === "check") {
      return DEFAULT_CHECK_DURATION_MIN;
    }

    if (task.scheduleType === "one_time") {
      return this.ensureMinDuration(task.estimatedDurationMin ?? null);
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (recurrence?.pattern === "selected_weekdays") {
      const weekday = getWeekday(this.currentDateKey, "UTC");
      const weekdayDuration = recurrence.weekdays.find(
        (entry) => entry.dayOfWeek === weekday,
      )?.durationMin;
      if (weekdayDuration && weekdayDuration > 0) {
        return weekdayDuration;
      }
      if (recurrence.commonDurationMin && recurrence.commonDurationMin > 0) {
        return recurrence.commonDurationMin;
      }
    } else if (
      recurrence?.commonDurationMin &&
      recurrence.commonDurationMin > 0
    ) {
      return recurrence.commonDurationMin;
    }

    return this.ensureMinDuration(task.estimatedDurationMin ?? null);
  }

  private ensureMinDuration(value: number | null): number {
    if (!value || !Number.isFinite(value) || value <= 0) {
      return DEFAULT_DURATION_MIN;
    }
    return Math.round(value);
  }

  private compareTaskRank(
    left: PersistedTaskAggregate,
    right: PersistedTaskAggregate,
  ): number {
    const leftPriority = this.priorityRank(left.priority);
    const rightPriority = this.priorityRank(right.priority);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftDuration = this.resolveTaskDurationForToday(left);
    const rightDuration = this.resolveTaskDurationForToday(right);
    if (leftDuration !== rightDuration) {
      return leftDuration - rightDuration;
    }

    return left.title.localeCompare(right.title);
  }

  private priorityRank(value: PersistedTaskAggregate["priority"]): number {
    switch (value) {
      case "S":
        return 0;
      case "A":
        return 1;
      case "B":
        return 2;
      case "C":
      default:
        return 3;
    }
  }

  private buildTaskTimeLabel(
    time: string | null,
    startMinutes: number | null,
    endMinutes: number | null,
  ): string | null {
    if (!time || startMinutes === null) {
      return null;
    }

    if (endMinutes === null || endMinutes <= startMinutes) {
      return time;
    }

    return `${this.minutesToTime(startMinutes)} - ${this.minutesToTime(endMinutes)}`;
  }

  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} ${this.translate.instant("TASK_DETAIL.MINUTES_SHORT")}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainderMinutes = minutes % 60;
    const hourLabel = this.translate.instant("TODAY.OPPORTUNITIES.HOUR_SHORT");
    const minuteLabel = this.translate.instant("TASK_DETAIL.MINUTES_SHORT");

    if (remainderMinutes === 0) {
      return `${hours} ${hourLabel}`;
    }

    return `${hours} ${hourLabel} ${remainderMinutes} ${minuteLabel}`;
  }

  private resolveTaskColor(task: PersistedTaskAggregate): string {
    const categoryColor = task.categoryColor?.trim();
    if (categoryColor) {
      return categoryColor;
    }
    return "#64748B";
  }

  private timeToMinutes(value: string): number | null {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return null;
    }

    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const remainder = normalized % 60;
    return `${`${hours}`.padStart(2, "0")}:${`${remainder}`.padStart(2, "0")}`;
  }

  private resolveNowFreeRangeLabel(
    tasks: readonly TaskAggregate[],
    nowMinutes: number,
  ): string {
    const upcomingTimed = tasks
      .filter(
        (task) =>
          task.hasTime &&
          typeof task.startMinutes === "number" &&
          task.startMinutes > nowMinutes,
      )
      .sort(
        (left, right) =>
          (left.startMinutes as number) - (right.startMinutes as number),
      )[0];

    const end = upcomingTimed?.startMinutes ?? 24 * 60;
    return `${this.minutesToTime(nowMinutes)} - ${this.minutesToTime(end)}`;
  }

  private toUpdateTaskInput(task: PersistedTaskAggregate): UpdateTaskInput {
    return {
      title: task.title,
      description: task.description,
      mode: task.trackingMode,
      priority: task.priority,
      scheduleType: task.scheduleType,
      durationMode: task.durationMode,
      oneTimeDate: task.oneTimeDate,
      oneTimeTime: task.oneTimeTime,
      estimatedDurationMin: task.estimatedDurationMin,
      categoryId: task.categoryId,
    };
  }

  private normalizeLocalDateKey(
    value: string | null | undefined,
  ): string | null {
    if (typeof value !== "string") {
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
    timezone: string,
  ): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    try {
      return formatCalendarDate(toCalendarDate(parsed, timezone));
    } catch {
      return null;
    }
  }

  private resolveTaskTimezone(task: PersistedTaskAggregate): string {
    const fallback = getDeviceTimezone();
    const candidate =
      task.timezone?.trim() || task.recurrence?.timezone?.trim() || fallback;
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: candidate }).format(
        new Date(),
      );
      return candidate;
    } catch {
      return fallback;
    }
  }

  private resolveDateKey(date: Date): string {
    return formatCalendarDate(toCalendarDate(date, getDeviceTimezone()));
  }

  private startNowTicker(): void {
    this.stopNowTicker();
    this.nowTickerId = window.setInterval(() => {
      this.now = new Date();
      const nextDateKey = this.resolveDateKey(this.now);
      if (nextDateKey !== this.currentDateKey) {
        this.currentDateKey = nextDateKey;
        this.updateDailyIntent(this.now);
        void this.loadTodayData();
        return;
      }

      this.refreshComputedSections();
    }, 30_000);
  }

  private stopNowTicker(): void {
    if (this.nowTickerId !== null) {
      window.clearInterval(this.nowTickerId);
      this.nowTickerId = null;
    }
  }

  private startTaskSession(taskId: string, durationMin: number): void {
    const normalizedDuration = Math.max(
      DEFAULT_FIVE_MIN_DURATION,
      Math.round(durationMin),
    );
    const now = new Date();
    const expectedEndAt = new Date(now.getTime() + normalizedDuration * 60_000);
    const session: TodayRunningSession = {
      taskId,
      startedAt: now.toISOString(),
      expectedEndAt: expectedEndAt.toISOString(),
      durationMin: normalizedDuration,
      status: "running",
    };

    window.localStorage.setItem(
      TODAY_RUNNING_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );

    this.writeActiveTimerWindow({
      startedAt: session.startedAt,
      expectedEndAt: session.expectedEndAt,
      status: "running",
      source: "today",
      taskId: session.taskId,
    });
  }

  private readRunningSession(): TodayRunningSession | null {
    try {
      const raw = window.localStorage.getItem(
        TODAY_RUNNING_SESSION_STORAGE_KEY,
      );
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as TodayRunningSession;
      if (
        !parsed ||
        typeof parsed.taskId !== "string" ||
        typeof parsed.startedAt !== "string" ||
        typeof parsed.expectedEndAt !== "string"
      ) {
        return null;
      }

      const endAt = new Date(parsed.expectedEndAt).getTime();
      if (!Number.isFinite(endAt)) {
        return null;
      }

      if (endAt <= Date.now()) {
        this.completeTodaySession(parsed);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private completeTodaySession(session: TodayRunningSession): void {
    const finishedAt = new Date().toISOString();
    try {
      window.localStorage.removeItem(TODAY_RUNNING_SESSION_STORAGE_KEY);
    } catch {
      // Ignore storage errors for completed sessions.
    }

    this.writeActiveTimerWindow({
      startedAt: session.startedAt,
      expectedEndAt: session.expectedEndAt,
      endedAt: finishedAt,
      completedAt: finishedAt,
      status: "completed",
      source: "today",
      taskId: session.taskId,
    });
  }

  private writeActiveTimerWindow(windowRecord: ActiveTimerWindowRecord): void {
    try {
      const existingWindows = this.readActiveTimerWindows();
      const nowIso = new Date().toISOString();
      const normalized = existingWindows.map((record) => {
        if (record.status?.trim().toLowerCase() !== "running") {
          return record;
        }
        if (record.source !== "today") {
          return record;
        }

        return {
          ...record,
          status: "completed",
          completedAt: nowIso,
          endedAt: nowIso,
        };
      });
      normalized.push(windowRecord);

      window.localStorage.setItem(
        ACTIVE_TIMER_WINDOWS_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    } catch {
      // Ignore storage errors for timer windows.
    }
  }

  private readActiveTimerWindows(): ActiveTimerWindowRecord[] {
    try {
      const raw = window.localStorage.getItem(ACTIVE_TIMER_WINDOWS_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (value): value is ActiveTimerWindowRecord =>
          !!value && typeof value === "object" && "startedAt" in value,
      );
    } catch {
      return [];
    }
  }

  private clampPercent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private triggerTapFeedback(): void {
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(10);
      }
    } catch {
      // Ignore vibration errors in unsupported environments.
    }
  }

  private updateDailyIntent(referenceDate: Date): void {
    const [line1Key, line2Key] =
      TODAY_QUOTES[this.dayOfYear(referenceDate) % TODAY_QUOTES.length];
    this.dailyIntentLine1 = this.translate.instant(line1Key);
    this.dailyIntentLine2 = this.translate.instant(line2Key);
  }

  private dayOfYear(referenceDate: Date): number {
    const start = new Date(referenceDate.getFullYear(), 0, 0);
    const diff = referenceDate.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }
}
