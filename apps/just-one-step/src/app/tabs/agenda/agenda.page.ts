import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ComponentRef,
  ElementRef,
  OnDestroy,
  Type,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
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
  type DayAgendaTimelineBoundary,
  type DayAgendaTimelineHeightTier,
  type DayAgendaTimelineSegment,
} from '@sheldrapps/ui-theme';
import {
  formatCalendarDate,
  getDeviceTimezone,
  getWeekday,
  isAfter,
  isBefore,
  parseCalendarDate,
  toCalendarDate,
} from '../../shared/calendar';
import { addIcons } from 'ionicons';
import {
  addOutline,
  chevronBackOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import {
  PersistedTaskAggregate,
  TaskPriority,
  TaskMonthDayCategorySummary,
  TaskRepository,
} from '../../database/repositories/task.repository';
import { Subscription } from 'rxjs';
import { AgendaControlsComponent } from './components/agenda-controls.component';

type AgendaViewMode = 'day' | 'month' | 'year';
interface AgendaTimelineTask {
  taskId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  durationMin: number;
  durationLabel: string | null;
  startLabel: string;
  endLabel: string;
  startMinutes: number;
  endMinutes: number;
  accentBorderColor: string;
  accentBackgroundColor: string;
  accentShadowColor: string;
}

export interface AgendaUntimedTask {
  taskId: string;
  title: string;
  description: string | null;
  accentBorderColor: string;
  accentBackgroundColor: string;
  createdAt: string;
}

interface AgendaDayClassification {
  intervalEvents: AgendaTimelineTask[];
  pointEvents: AgendaTimelineTask[];
  dayTasks: AgendaUntimedTask[];
  occurredTaskIds: string[];
}

interface AgendaOccurrenceDecision {
  occurs: boolean;
  reason: string;
}

interface AgendaResolvedTime {
  source:
    | 'simple.timeOfDay'
    | 'weekly_schedule.weeklyDayTimes'
    | 'one_time.timeOfDay'
    | 'none';
  resolvedTime: string | null;
  startMinutes: number | null;
}

interface AgendaDaySegment {
  key: string;
  type: 'empty' | 'event';
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  heightTier: DayAgendaTimelineHeightTier;
  visualHeightPx: number;
  timeTopLabel: string;
  timeBottomLabel: string;
  isCurrent: boolean;
  displayTitle: string | null;
  displayHint: string | null;
  displayAccentColor: string | null;
  emptyHint: string | null;
  items?: AgendaTimelineTask[];
  task?: AgendaTimelineTask;
}

interface AgendaDayTimelineViewModel {
  boundaries: DayAgendaTimelineBoundary[];
  segments: DayAgendaTimelineSegment[];
}

interface AgendaMonthDayTaskSummary {
  taskCount: number;
  categoryDotColors: string[];
}

export interface AgendaRailDay {
  key: string;
  date: Date;
  weekdayLabel: string;
  dayNumberLabel: string;
  isWeekdayLabelUpper: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export interface AgendaMonthCell {
  key: string;
  date: Date | null;
  dayNumberLabel: string;
  densityLevel: number;
  categoryDotColors: string[];
  categoryDotTopColors: string[];
  categoryDotMiddleColors: string[];
  categoryDotBottomColors: string[];
  categoryDotOverflow: number;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
}

export interface AgendaYearMonth {
  key: string;
  monthIndex: number;
  monthLabel: string;
  densityLevel: number;
  isCurrentMonth: boolean;
  isSelectedMonth: boolean;
}

const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const SLOT_MINUTES = 15;
const EMPTY_SEGMENT_HEIGHT_SM_PX = 32;
const EMPTY_SEGMENT_HEIGHT_MD_PX = 40;
const EMPTY_SEGMENT_HEIGHT_LG_PX = 48;
const EVENT_SEGMENT_HEIGHT_SM_PX = 32;
const EVENT_SEGMENT_HEIGHT_MD_PX = 40;
const EVENT_SEGMENT_HEIGHT_LG_PX = 48;
const DEFAULT_GAP_DURATION_MIN = 30;
const DAY_RAIL_RANGE = 4;
const MONTH_DOT_MAX_VISIBLE = 9;
const MONTH_DOT_VISIBLE_WITH_OVERFLOW = 8;
const MONTH_DOT_ROW_CAPACITY = 3;

@Component({
  standalone: true,
  selector: 'app-agenda',
  templateUrl: './agenda.page.html',
  styleUrls: ['./agenda.page.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonNote,
    TranslateModule,
    LoadingStateComponent,
    AgendaControlsComponent,
  ],
})
export class AgendaPage implements AfterViewInit, OnDestroy {
  private readonly taskRepository = inject(TaskRepository);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly debugDayClassification = false;

  constructor() {
    addIcons({ addOutline, chevronBackOutline, chevronForwardOutline });
    this.refreshViewModels();
  }

  @ViewChild(IonContent)
  private content?: IonContent;

  @ViewChild(IonContent, { read: ElementRef })
  private contentElementRef?: ElementRef<HTMLElement>;

  @ViewChild('agendaViewHost', { read: ViewContainerRef })
  private agendaViewHost?: ViewContainerRef;

  private viewRef: ComponentRef<unknown> | null = null;
  private viewRefMode: AgendaViewMode | null = null;
  private viewRenderToken = 0;
  private dayRenderRecoveryToken = 0;
  private viewSubscriptions: Subscription[] = [];
  private readonly lazyViewCache = new Map<AgendaViewMode, Type<unknown>>();
  private readonly monthSummaryCache = new Map<
    string,
    Map<string, AgendaMonthDayTaskSummary>
  >();
  private readonly monthSummaryLoading = new Set<string>();

  currentView: AgendaViewMode = 'day';
  selectedDate = this.dateAtLocalNoon(new Date());
  scheduledTasks: PersistedTaskAggregate[] = [];
  isLoading = false;
  loadFailed = false;
  now = new Date();
  private nowTickerId: number | null = null;

  railDays: AgendaRailDay[] = [];
  monthWeekdayLabels: string[] = [];
  daySegments: AgendaDaySegment[] = [];
  dayTimelineBoundaries: DayAgendaTimelineBoundary[] = [];
  dayTimelineSegments: DayAgendaTimelineSegment[] = [];
  dayUntimedTasks: AgendaUntimedTask[] = [];
  monthCells: AgendaMonthCell[] = [];
  yearMonths: AgendaYearMonth[] = [];

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

  get dayHeaderLabel(): string {
    return new Intl.DateTimeFormat(this.activeLocale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(this.selectedDate);
  }

  get dayHeaderWeekdayLabel(): string {
    const weekday = new Intl.DateTimeFormat(this.activeLocale, {
      weekday: 'long',
    }).format(this.selectedDate);
    return this.capitalizeFirst(weekday);
  }

  get dayHeaderDateLabel(): string {
    return new Intl.DateTimeFormat(this.activeLocale, {
      day: 'numeric',
      month: 'long',
    }).format(this.selectedDate).toLocaleLowerCase(this.activeLocale);
  }

  get monthHeaderLabel(): string {
    const month = new Intl.DateTimeFormat(this.activeLocale, {
      month: 'long',
    }).format(this.selectedDate);
    const year = new Intl.DateTimeFormat(this.activeLocale, {
      year: 'numeric',
    }).format(this.selectedDate);
    return `${month} ${year}`;
  }

  get yearHeaderLabel(): string {
    return new Intl.DateTimeFormat(this.activeLocale, {
      year: 'numeric',
    }).format(this.selectedDate);
  }

  get isSelectedDayToday(): boolean {
    return this.isSameDay(this.selectedDate, this.now);
  }

  async ionViewWillEnter(): Promise<void> {
    this.beginLoadingOverlay();
    this.selectedDate = this.dateAtLocalNoon(new Date());
    this.startNowTicker();
    try {
      await this.loadAgendaTasks();
      await this.ensureMonthSummaryForDate(this.selectedDate);
      this.queueScrollNearNow();
      this.queueScrollRailToToday();
    } finally {
      this.endLoadingOverlay();
    }
  }

  ngAfterViewInit(): void {
    this.renderCurrentView();
  }

  ionViewDidLeave(): void {
    this.stopNowTicker();
  }

  ionViewDidEnter(): void {
    this.renderCurrentView();
    this.scheduleDayRenderRecovery();
  }

  ngOnDestroy(): void {
    this.destroyRenderedView();
    this.stopNowTicker();
  }

  onViewModeSelected(nextView: AgendaViewMode): void {
    this.currentView = nextView;
    this.renderCurrentView();
    if (nextView === 'month') {
      void this.ensureMonthSummaryForDate(this.selectedDate);
    }
  }

  onScopeShift(delta: number): void {
    if (this.currentView === 'day') {
      this.onDayShift(delta);
      return;
    }

    if (this.currentView === 'month') {
      this.onMonthShift(delta);
      return;
    }

    this.onYearShift(delta);
  }

  onDayShift(deltaDays: number): void {
    const previousDate = this.selectedDate;
    this.selectedDate = this.addDays(this.selectedDate, deltaDays);
    this.refreshViewModels();
    this.queueScrollNearNow();
    this.queueMonthSummaryLoad(previousDate, this.selectedDate);
  }

  onMonthShift(deltaMonths: number): void {
    const previousDate = this.selectedDate;
    this.selectedDate = this.shiftMonth(this.selectedDate, deltaMonths);
    this.refreshViewModels();
    this.queueMonthSummaryLoad(previousDate, this.selectedDate);
  }

  onYearShift(deltaYears: number): void {
    const previousDate = this.selectedDate;
    this.selectedDate = this.shiftYear(this.selectedDate, deltaYears);
    this.refreshViewModels();
    this.queueMonthSummaryLoad(previousDate, this.selectedDate);
  }

  selectRailDay(day: AgendaRailDay): void {
    const previousDate = this.selectedDate;
    this.selectedDate = this.cloneDate(day.date);
    this.refreshViewModels();
    this.queueScrollNearNow();
    this.queueMonthSummaryLoad(previousDate, this.selectedDate);
    if (day.isToday) {
      this.queueScrollRailToToday();
    }
  }

  openDayFromMonth(cell: AgendaMonthCell): void {
    if (!cell.date) {
      return;
    }

    const previousDate = this.selectedDate;
    this.selectedDate = this.cloneDate(cell.date);
    this.currentView = 'day';
    this.refreshViewModels();
    this.queueScrollNearNow();
    this.queueMonthSummaryLoad(previousDate, this.selectedDate);
  }

  openMonthFromYear(month: AgendaYearMonth): void {
    const previousDate = this.selectedDate;
    this.selectedDate = this.withMonth(this.selectedDate, month.monthIndex);
    this.currentView = 'month';
    this.refreshViewModels();
    this.queueMonthSummaryLoad(previousDate, this.selectedDate);
  }

  async openQuickCreate(): Promise<void> {
    await this.navigateToCreateTask(
      this.selectedDate,
      this.resolveDefaultCreateTime(this.selectedDate),
      DEFAULT_GAP_DURATION_MIN
    );
  }

  async openTask(task: AgendaTimelineTask): Promise<void> {
    await this.router.navigate(['/tasks/view', task.taskId]);
  }

  async openUntimedTask(task: AgendaUntimedTask): Promise<void> {
    await this.router.navigate(['/tasks/view', task.taskId]);
  }

  taskAriaLabel(task: AgendaTimelineTask): string {
    return this.translate.instant('AGENDA.TASK_ARIA', {
      title: task.title,
      start: task.startLabel,
      end: task.endLabel,
    });
  }

  onDayTimelineSegmentClick(segment: DayAgendaTimelineSegment): void {
    if (segment.type !== 'event') {
      return;
    }

    const clickedTaskId = segment.activeTaskId ?? null;
    if (clickedTaskId) {
      void this.router.navigate(['/tasks/view', clickedTaskId]);
      return;
    }

    const source = this.daySegments.find(
      (candidate) => candidate.key === segment.key
    );
    if (!source?.task) {
      return;
    }

    void this.openTask(source.task);
  }

  private renderCurrentView(): void {
    const host = this.agendaViewHost;
    if (!host) {
      return;
    }

    const mode = this.currentView;
    const cachedComponent = this.lazyViewCache.get(mode);
    if (cachedComponent) {
      this.applyResolvedView(mode, cachedComponent);
      return;
    }

    const renderToken = ++this.viewRenderToken;
    void this.resolveViewComponent(mode).then((componentType) => {
      if (renderToken !== this.viewRenderToken || !this.agendaViewHost) {
        return;
      }

      this.applyResolvedView(mode, componentType);
    });
  }

  private async resolveViewComponent(mode: AgendaViewMode): Promise<Type<unknown>> {
    const cached = this.lazyViewCache.get(mode);
    if (cached) {
      return cached;
    }

    let componentType: Type<unknown>;
    switch (mode) {
      case 'day': {
        componentType = (await import('./components/agenda-day.component')).AgendaDayComponent;
        break;
      }
      case 'month': {
        componentType = (await import('./components/agenda-month.component')).AgendaMonthComponent;
        break;
      }
      default: {
        componentType = (await import('./components/agenda-year.component')).AgendaYearComponent;
        break;
      }
    }

    this.lazyViewCache.set(mode, componentType);
    return componentType;
  }

  private applyResolvedView(mode: AgendaViewMode, componentType: Type<unknown>): void {
    if (!this.viewRef || this.viewRefMode !== mode) {
      this.destroyRenderedView();
      this.viewRef = this.agendaViewHost?.createComponent(componentType) ?? null;
      this.viewRefMode = mode;
      if (!this.viewRef) {
        return;
      }

      this.bindViewOutputs(mode, this.viewRef.instance as Record<string, unknown>);
    }

    this.bindViewInputs(mode);

    if (mode === 'day') {
      this.queueScrollNearNow();
      this.queueScrollRailToToday();
    }
  }

  private bindViewInputs(mode: AgendaViewMode): void {
    if (!this.viewRef) {
      return;
    }

    switch (mode) {
      case 'day': {
        this.viewRef.setInput('activeLocale', this.activeLocale);
        this.viewRef.setInput('railDays', this.railDays);
        this.viewRef.setInput('daySegments', this.daySegments);
        this.viewRef.setInput('dayTimelineBoundaries', this.dayTimelineBoundaries);
        this.viewRef.setInput('dayTimelineSegments', this.dayTimelineSegments);
        this.viewRef.setInput('dayOpenMessageVisible', this.dayOpenMessageVisible);
        this.viewRef.setInput('dayUntimedTasks', this.dayUntimedTasks);
        break;
      }
      case 'month': {
        this.viewRef.setInput('activeLocale', this.activeLocale);
        this.viewRef.setInput('monthWeekdayLabels', this.monthWeekdayLabels);
        this.viewRef.setInput('monthCells', this.monthCells);
        break;
      }
      default: {
        this.viewRef.setInput('yearMonths', this.yearMonths);
        break;
      }
    }
  }

  private bindViewOutputs(mode: AgendaViewMode, instance: Record<string, unknown>): void {
    this.clearViewSubscriptions();

    if (mode === 'day') {
      const selectRailDay = instance['selectRailDay'] as {
        subscribe: (cb: (day: AgendaRailDay) => void) => Subscription;
      };
      const timelineSegmentClick = instance['timelineSegmentClick'] as {
        subscribe: (cb: (segment: DayAgendaTimelineSegment) => void) => Subscription;
      };
      const openUntimedTask = instance['openUntimedTask'] as {
        subscribe: (cb: (task: AgendaUntimedTask) => void) => Subscription;
      };

      this.viewSubscriptions.push(selectRailDay.subscribe((day) => this.selectRailDay(day)));
      this.viewSubscriptions.push(
        timelineSegmentClick.subscribe((segment) => this.onDayTimelineSegmentClick(segment))
      );
      this.viewSubscriptions.push(
        openUntimedTask.subscribe((task) => {
          void this.openUntimedTask(task);
        })
      );
      return;
    }

    if (mode === 'month') {
      const openDay = instance['openDay'] as {
        subscribe: (cb: (cell: AgendaMonthCell) => void) => Subscription;
      };

      this.viewSubscriptions.push(openDay.subscribe((cell) => this.openDayFromMonth(cell)));
      return;
    }

    const openMonth = instance['openMonth'] as {
      subscribe: (cb: (month: AgendaYearMonth) => void) => Subscription;
    };

    this.viewSubscriptions.push(openMonth.subscribe((month) => this.openMonthFromYear(month)));
  }

  private clearViewSubscriptions(): void {
    for (const subscription of this.viewSubscriptions) {
      subscription.unsubscribe();
    }
    this.viewSubscriptions = [];
  }

  private destroyRenderedView(): void {
    this.clearViewSubscriptions();
    this.viewRef?.destroy();
    this.viewRef = null;
    this.viewRefMode = null;
    this.agendaViewHost?.clear();
  }

  private resolveEmptySegmentHint(): string {
    return this.translate.instant('AGENDA.EMPTY_HINT_FREE_TIME');
  }

  get dayOpenMessageVisible(): boolean {
    return (
      this.dayUntimedTasks.length === 0 &&
      this.daySegments.length === 1 &&
      this.daySegments[0].type === 'empty' &&
      this.daySegments[0].startMinutes === DAY_START_HOUR * 60 &&
      this.daySegments[0].endMinutes === DAY_END_HOUR * 60
    );
  }

  fullDateAriaLabel(date: Date): string {
    return new Intl.DateTimeFormat(this.activeLocale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  private async loadAgendaTasks(): Promise<void> {
    this.loadFailed = false;
    this.monthSummaryCache.clear();
    this.monthSummaryLoading.clear();

    try {
      const taskRows = await this.taskRepository.listTasks();
      if (taskRows.length === 0) {
        this.scheduledTasks = [];
        return;
      }

      const aggregates = await Promise.all(
        taskRows.map((task) => this.taskRepository.getTaskAggregate(task.id))
      );

      this.scheduledTasks = aggregates.filter(
        (task): task is PersistedTaskAggregate =>
          !!task &&
          task.isActive &&
          !task.isArchived &&
          task.deletedAt === null &&
          (task.scheduleType === 'one_time' || !!task.recurrence)
      );
    } catch {
      this.scheduledTasks = [this.buildSampleTaskAggregate()];
      this.loadFailed = false;
    } finally {
      this.refreshViewModels();
    }
  }

  private refreshViewModels(): void {
    this.railDays = this.buildRailDays();
    this.monthWeekdayLabels = this.buildMonthWeekdayLabels();
    this.logLoadedTasksForDate(this.selectedDate);
    const classification = this.buildDayClassification(this.selectedDate);
    const timedTasks = [...classification.intervalEvents, ...classification.pointEvents]
      .sort((left, right) => left.startMinutes - right.startMinutes || left.title.localeCompare(right.title));
    this.dayUntimedTasks = classification.dayTasks;
    this.daySegments =
      timedTasks.length === 0 && this.dayUntimedTasks.length > 0
        ? []
        : this.buildDaySegments(timedTasks);

    if (this.daySegments.length === 0 && this.dayUntimedTasks.length === 0) {
      this.daySegments = this.buildDaySegments([]);
    }

    const dayTimeline = this.buildDayTimelineViewModel(this.daySegments);
    this.dayTimelineBoundaries = dayTimeline.boundaries;
    this.dayTimelineSegments = dayTimeline.segments;

    this.logDayClassification(this.selectedDate, classification, this.daySegments);

    this.monthCells = this.buildMonthCells(this.selectedDate);
    this.yearMonths = this.buildYearMonths(this.selectedDate);
    this.renderCurrentView();
    this.scheduleDayRenderRecovery();
  }

  private scheduleDayRenderRecovery(): void {
    if (this.currentView !== 'day' || this.isLoading || !this.agendaViewHost) {
      return;
    }

    const token = ++this.dayRenderRecoveryToken;
    window.setTimeout(() => {
      if (token !== this.dayRenderRecoveryToken) {
        return;
      }

      if (this.currentView !== 'day' || this.isLoading || !this.agendaViewHost) {
        return;
      }

      const hasRail = !!this.queryAgendaElement<HTMLElement>('.agenda-date-rail');
      const hasTimeline = !!this.queryAgendaElement<HTMLElement>('.agenda-timeline');
      const hasUntimedList =
        !!this.queryAgendaElement<HTMLElement>('.agenda-untimed-list');

      if (!hasRail || (!hasTimeline && !hasUntimedList)) {
        this.renderCurrentView();
      }
    }, 32);
  }

  private beginLoadingOverlay(): void {
    this.isLoading = true;
  }

  private endLoadingOverlay(): void {
    this.isLoading = false;
  }

  private queueMonthSummaryLoad(previousDate: Date, nextDate: Date): void {
    if (this.monthSummaryKey(previousDate) === this.monthSummaryKey(nextDate)) {
      return;
    }

    void this.ensureMonthSummaryForDate(nextDate);
  }

  private async ensureMonthSummaryForDate(date: Date): Promise<void> {
    const monthSummaryLoader = (
      this.taskRepository as Partial<TaskRepository>
    ).listMonthDayCategorySummaries;

    if (typeof monthSummaryLoader !== 'function') {
      return;
    }

    const monthKey = this.monthSummaryKey(date);
    if (this.monthSummaryCache.has(monthKey) || this.monthSummaryLoading.has(monthKey)) {
      return;
    }

    this.monthSummaryLoading.add(monthKey);

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthStart = this.dateKey(this.createDate(year, month, 1));
    const monthEnd = this.dateKey(
      this.createDate(year, month, this.daysInMonth(year, month))
    );

    try {
      const summaries = await monthSummaryLoader.call(
        this.taskRepository,
        monthStart,
        monthEnd
      );
      if (!summaries) {
        return;
      }

      this.monthSummaryCache.set(monthKey, this.mapMonthSummaryRows(summaries));

      if (this.monthSummaryKey(this.selectedDate) === monthKey) {
        this.monthCells = this.buildMonthCells(this.selectedDate);
        if (this.currentView === 'month') {
          this.renderCurrentView();
        }
      }
    } catch {
      this.monthSummaryCache.delete(monthKey);
    } finally {
      this.monthSummaryLoading.delete(monthKey);
    }
  }

  private mapMonthSummaryRows(
    rows: readonly TaskMonthDayCategorySummary[]
  ): Map<string, AgendaMonthDayTaskSummary> {
    const mapped = new Map<string, AgendaMonthDayTaskSummary>();

    for (const row of rows) {
      const dateKey = row.dateKey.trim();
      if (dateKey.length === 0) {
        continue;
      }

      const uniqueColors: string[] = [];
      const seenColors = new Set<string>();
      for (const rawColor of row.categoryColors) {
        const color = rawColor.trim();
        if (color.length === 0) {
          continue;
        }

        const colorKey = color.toLowerCase();
        if (seenColors.has(colorKey)) {
          continue;
        }

        seenColors.add(colorKey);
        uniqueColors.push(color);
      }

      mapped.set(dateKey, {
        taskCount: Math.max(0, Math.round(row.taskCount)),
        categoryDotColors: uniqueColors,
      });
    }

    return mapped;
  }

  private logLoadedTasksForDate(date: Date): void {
    if (!this.debugDayClassification) {
      return;
    }

    const dateKey = this.dateKey(date);
    console.info(`[agenda][load] date=${dateKey} count=${this.scheduledTasks.length}`);
    for (const task of this.scheduledTasks) {
      const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
      const hasTime = Boolean(recurrence?.hasTime);
      const timeOfDay = recurrence?.commonTime ?? recurrence?.weekdays[0]?.timeValue ?? 'null';
      const estimatedDuration = task.estimatedDurationMin ?? null;
      console.info(
        `[agenda][load] task=${task.id} title="${task.title}" mode=${task.trackingMode} hasTime=${hasTime} timeOfDay=${timeOfDay} estimatedDurationMin=${estimatedDuration}`
      );
    }
  }

  private buildDayClassification(date: Date): AgendaDayClassification {
    const intervalEvents: AgendaTimelineTask[] = [];
    const pointEvents: AgendaTimelineTask[] = [];
    const dayTasks: AgendaUntimedTask[] = [];
    const occurredTaskIds: string[] = [];

    const dateKey = this.dateKey(date);

    for (const task of this.scheduledTasks) {
      const occurrence = this.resolveOccurrence(task, date);
      if (this.debugDayClassification) {
        console.info(
          `[agenda][occurs] task=${task.id} title="${task.title}" date=${dateKey} occurs=${occurrence.occurs} reason=${occurrence.reason}`
        );
      }

      if (!occurrence.occurs) {
        continue;
      }

      occurredTaskIds.push(task.id);
      const time = this.resolveTimeForDateDetailed(task, date);
      if (this.debugDayClassification) {
        const resolved = time.resolvedTime ?? 'null';
        const minutes = time.startMinutes ?? 'null';
        console.info(
          `[agenda][time] task=${task.id} source=${time.source} resolvedTime=${resolved} startMinutes=${minutes}`
        );
      }

      const durationRaw = task.estimatedDurationMin ?? null;
      if (!time.resolvedTime || time.startMinutes === null) {
        dayTasks.push(this.createUntimedTask(task));
        if (this.debugDayClassification) {
          console.info(
            `[agenda][classify] task=${task.id} mode=${task.trackingMode} hasTime=${Boolean(
              task.recurrenceEnabled ? task.recurrence?.hasTime : false
            )} duration=${durationRaw} -> dayTask reason=missing_or_invalid_time`
          );
        }
        continue;
      }

      const timelineTask = this.buildTimelineTask(task, date);
      if (!timelineTask) {
        dayTasks.push(this.createUntimedTask(task));
        if (this.debugDayClassification) {
          console.info(
            `[agenda][classify] task=${task.id} mode=${task.trackingMode} hasTime=${Boolean(
              task.recurrenceEnabled ? task.recurrence?.hasTime : false
            )} duration=${durationRaw} -> dayTask reason=unrenderable_timeline_task`
          );
        }
        continue;
      }

      if (timelineTask.endMinutes > timelineTask.startMinutes) {
        intervalEvents.push(timelineTask);
        if (this.debugDayClassification) {
          console.info(
            `[agenda][classify] task=${task.id} mode=${task.trackingMode} hasTime=${Boolean(
              task.recurrenceEnabled ? task.recurrence?.hasTime : false
            )} duration=${durationRaw} -> intervalEvent reason=duration_positive`
          );
        }
      } else {
        pointEvents.push(timelineTask);
        if (this.debugDayClassification) {
          console.info(
            `[agenda][classify] task=${task.id} mode=${task.trackingMode} hasTime=${Boolean(
              task.recurrenceEnabled ? task.recurrence?.hasTime : false
            )} duration=${durationRaw} -> pointEvent reason=duration_zero`
          );
        }
      }
    }

    dayTasks.sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    const classifiedTotal = intervalEvents.length + pointEvents.length + dayTasks.length;
    if (this.debugDayClassification && classifiedTotal !== occurredTaskIds.length) {
      const seenIds = new Set<string>();
      const classifiedIds = [
        ...intervalEvents.map((task) => task.taskId),
        ...pointEvents.map((task) => task.taskId),
        ...dayTasks.map((task) => task.taskId),
      ].filter((taskId) => {
        if (seenIds.has(taskId)) {
          return false;
        }

        seenIds.add(taskId);
        return true;
      });
      const missing = occurredTaskIds.filter((taskId) => !classifiedIds.includes(taskId));
      console.error('%c[agenda][coverage] mismatch', 'color: #d00000; font-weight: 700;', {
        date: dateKey,
        occurredCount: occurredTaskIds.length,
        intervalCount: intervalEvents.length,
        pointCount: pointEvents.length,
        dayTaskCount: dayTasks.length,
        classifiedTotal,
        missing,
      });
    }

    return {
      intervalEvents: intervalEvents.sort((left, right) => left.startMinutes - right.startMinutes),
      pointEvents: pointEvents.sort((left, right) => left.startMinutes - right.startMinutes),
      dayTasks,
      occurredTaskIds,
    };
  }

  private logDayClassification(
    date: Date,
    classification: AgendaDayClassification,
    segments: readonly AgendaDaySegment[]
  ): void {
    if (!this.debugDayClassification) {
      return;
    }

    const classifiedTotal =
      classification.intervalEvents.length +
      classification.pointEvents.length +
      classification.dayTasks.length;

    const hasCoverageGap = classifiedTotal !== classification.occurredTaskIds.length;

    console.info('[agenda.day.debug]', {
      date: this.dateKey(date),
      occurredTaskCount: classification.occurredTaskIds.length,
      intervalEventCount: classification.intervalEvents.length,
      pointEventCount: classification.pointEvents.length,
      dayTaskCount: classification.dayTasks.length,
      classifiedTotal,
      hasCoverageGap,
      segments: segments.map((segment) => ({
        key: segment.key,
        type: segment.type,
        startMinutes: segment.startMinutes,
        endMinutes: segment.endMinutes,
      })),
      intervalEvents: classification.intervalEvents.map((task) => ({
        taskId: task.taskId,
        startMinutes: task.startMinutes,
        endMinutes: task.endMinutes,
        durationMin: task.durationMin,
      })),
      pointEvents: classification.pointEvents.map((task) => ({
        taskId: task.taskId,
        atMinutes: task.startMinutes,
      })),
      dayTasks: classification.dayTasks.map((task) => ({
        taskId: task.taskId,
        title: task.title,
      })),
    });

    console.info(
      '[agenda][segments]',
      segments.map((segment) => ({
        type: segment.type,
        startMinutes: segment.startMinutes,
        endMinutes: segment.endMinutes,
        taskId: segment.task?.taskId ?? null,
      }))
    );

    console.info(
      '[agenda][dayTasks]',
      classification.dayTasks.map((task) => ({
        taskId: task.taskId,
        title: task.title,
      }))
    );

    console.info(
      '[agenda][template] timeline=daySegments pointEvents+intervalEvents->daySegments dayTasks=dayUntimedTasks emptyState=dayOpenMessageVisible'
    );
  }

  private startNowTicker(): void {
    if (this.nowTickerId !== null) {
      return;
    }

    this.nowTickerId = window.setInterval(() => {
      this.now = new Date();
      this.refreshViewModels();
    }, 60_000);
  }

  private stopNowTicker(): void {
    if (this.nowTickerId !== null) {
      window.clearInterval(this.nowTickerId);
      this.nowTickerId = null;
    }
  }

  private queueScrollNearNow(): void {
    if (this.currentView !== 'day' || !this.isSelectedDayToday) {
      return;
    }

    window.setTimeout(() => {
      void this.scrollTimelineNearNow();
    }, 0);
  }

  private queueScrollRailToToday(): void {
    window.setTimeout(() => this.scrollRailToToday(), 0);
  }

  private queryAgendaElement<T extends HTMLElement>(selector: string): T | null {
    const host = this.contentElementRef?.nativeElement;
    if (!host) {
      return null;
    }

    return host.querySelector<T>(selector);
  }

  private scrollRailToToday(): void {
    const rail = this.queryAgendaElement<HTMLElement>('.agenda-date-rail');
    if (!rail) {
      return;
    }

    const todayChip = rail.querySelector<HTMLElement>('.agenda-date-chip--today');
    if (!todayChip) {
      return;
    }

    const railWidth = rail.clientWidth;
    const chipCenter = todayChip.offsetLeft + todayChip.offsetWidth / 2;
    const scrollLeft = chipCenter - railWidth / 2;
    rail.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  }

  private async scrollTimelineNearNow(): Promise<void> {
    const content = this.content;
    const timelineElement = this.queryAgendaElement<HTMLElement>('.agenda-timeline');
    if (!content || !timelineElement) {
      return;
    }

    const nowMinutes = this.resolveCurrentDayMinutes();
    if (nowMinutes === null) {
      return;
    }

    const currentSegment = this.daySegments.find(
      (segment) => nowMinutes >= segment.startMinutes && nowMinutes < segment.endMinutes
    );
    if (!currentSegment) {
      return;
    }

    const segmentElement = timelineElement.querySelector<HTMLElement>(
      `[data-segment-key="${currentSegment.key}"]`
    );
    if (!segmentElement) {
      return;
    }

    const scrollElement = await content.getScrollElement();
    const scrollRect = scrollElement.getBoundingClientRect();
    const segmentRect = segmentElement.getBoundingClientRect();
    const segmentCenter =
      scrollElement.scrollTop + (segmentRect.top - scrollRect.top) + (segmentRect.height / 2);
    const desiredY = Math.max(0, segmentCenter - (scrollRect.height / 2));
    await content.scrollToPoint(0, desiredY, 220);
  }

  private buildMonthWeekdayLabels(): string[] {
    return Array.from({ length: 7 }, (_, index) => {
      const day = this.createDate(2026, 2, index + 2);
      return new Intl.DateTimeFormat(this.activeLocale, {
        weekday: 'short',
      }).format(day);
    });
  }

  private buildRailDays(): AgendaRailDay[] {
    const days: AgendaRailDay[] = [];
    for (let offset = -DAY_RAIL_RANGE; offset <= DAY_RAIL_RANGE; offset += 1) {
      const date = this.addDays(this.selectedDate, offset);
      days.push({
        key: this.dateKey(date),
        date,
        weekdayLabel: new Intl.DateTimeFormat(this.activeLocale, {
          weekday: 'short',
        }).format(date),
        dayNumberLabel: new Intl.DateTimeFormat(this.activeLocale, {
          day: 'numeric',
        }).format(date),
        isWeekdayLabelUpper: false,
        isToday: this.isSameDay(date, new Date()),
        isSelected: this.isSameDay(date, this.selectedDate),
      });
    }

    return days;
  }

  private buildTimelineTask(
    task: PersistedTaskAggregate,
    date: Date
  ): AgendaTimelineTask | null {
    if (!this.taskOccursOnDate(task, date)) {
      return null;
    }

    const time = this.resolveTimeForDate(task, date);
    if (!time) {
      return null;
    }

    const startMinutes = this.timeToMinutes(time);
    if (startMinutes === null) {
      return null;
    }

    const durationMin = this.resolveTaskDuration(task, date);
    const isPointEvent = durationMin <= 0;
    const endMinutes = isPointEvent ? startMinutes : startMinutes + durationMin;
    const visibleStart = DAY_START_HOUR * 60;
    const visibleEnd = DAY_END_HOUR * 60;
    const clippedStart = Math.max(startMinutes, visibleStart);
    const clippedEnd = Math.min(endMinutes, visibleEnd);
    if (isPointEvent) {
      if (startMinutes < visibleStart || startMinutes >= visibleEnd) {
        return null;
      }
    } else if (clippedEnd <= visibleStart || clippedStart >= visibleEnd || clippedEnd <= clippedStart) {
      return null;
    }

    const color = this.resolveTaskColor(task);

    return {
      taskId: task.id,
      title: task.title,
      description: task.description?.trim() || null,
      priority: task.priority,
      durationMin,
      durationLabel: durationMin > 0 ? `${durationMin} ${this.translate.instant('TASK_DETAIL.MINUTES_SHORT')}` : null,
      startLabel: this.formatMinutes(startMinutes),
      endLabel: this.formatMinutes(endMinutes),
      startMinutes,
      endMinutes,
      accentBorderColor: color,
      accentBackgroundColor: this.withAlpha(color, 0.14),
      accentShadowColor: this.withAlpha(color, 0.22),
    };
  }

  private buildDaySegments(tasks: readonly AgendaTimelineTask[]): AgendaDaySegment[] {
    const visibleStart = DAY_START_HOUR * 60;
    const visibleEnd = DAY_END_HOUR * 60;
    const segments: AgendaDaySegment[] = [];
    const nowMinutes = this.resolveCurrentDayMinutes();
    const normalizedTasks = tasks
      .map((task) => {
        const taskStart = Math.max(visibleStart, task.startMinutes);
        const taskEndRaw = Math.min(visibleEnd, task.endMinutes);
        const taskEndForOverlap = Math.min(
          visibleEnd,
          task.endMinutes > task.startMinutes ? task.endMinutes : task.startMinutes + 1
        );
        return {
          task,
          taskStart,
          taskEndRaw,
          taskEndForOverlap,
        };
      })
      .filter((entry) => entry.taskEndForOverlap > entry.taskStart)
      .sort(
        (left, right) =>
          left.taskStart - right.taskStart ||
          left.taskEndForOverlap - right.taskEndForOverlap ||
          left.task.title.localeCompare(right.task.title)
      );

    const overlapGroups: Array<{
      startMinutes: number;
      endMinutes: number;
      overlapEndMinutes: number;
      tasks: AgendaTimelineTask[];
    }> = [];

    for (const entry of normalizedTasks) {
      const lastGroup = overlapGroups[overlapGroups.length - 1];
      if (!lastGroup) {
        overlapGroups.push({
          startMinutes: entry.taskStart,
          endMinutes: entry.taskEndRaw,
          overlapEndMinutes: entry.taskEndForOverlap,
          tasks: [entry.task],
        });
        continue;
      }

      if (entry.taskStart < lastGroup.overlapEndMinutes) {
        lastGroup.endMinutes = Math.max(lastGroup.endMinutes, entry.taskEndRaw);
        lastGroup.overlapEndMinutes = Math.max(
          lastGroup.overlapEndMinutes,
          entry.taskEndForOverlap
        );
        lastGroup.tasks.push(entry.task);
        continue;
      }

      overlapGroups.push({
        startMinutes: entry.taskStart,
        endMinutes: entry.taskEndRaw,
        overlapEndMinutes: entry.taskEndForOverlap,
        tasks: [entry.task],
      });
    }

    let cursor = visibleStart;
    for (const group of overlapGroups) {
      if (group.startMinutes > cursor) {
        segments.push(this.createEmptySegment(cursor, group.startMinutes, nowMinutes));
      }

      segments.push(
        this.createEventSegment(
          group.tasks,
          group.startMinutes,
          group.endMinutes,
          nowMinutes
        )
      );
      cursor = Math.max(cursor, group.endMinutes);
    }

    if (cursor < visibleEnd) {
      segments.push(this.createEmptySegment(cursor, visibleEnd, nowMinutes));
    }

    if (segments.length === 0) {
      segments.push(this.createEmptySegment(visibleStart, visibleEnd, nowMinutes));
    }

    return segments;
  }

  private buildDayTimelineViewModel(
    segments: readonly AgendaDaySegment[]
  ): AgendaDayTimelineViewModel {
    if (segments.length === 0) {
      return {
        boundaries: [],
        segments: [],
      };
    }

    const boundaryMinutes: number[] = [];
    const pushBoundaryMinutes = (minutes: number): void => {
      const clamped = Math.max(
        DAY_START_HOUR * 60,
        Math.min(minutes, DAY_END_HOUR * 60)
      );
      if (boundaryMinutes[boundaryMinutes.length - 1] === clamped) {
        return;
      }

      boundaryMinutes.push(clamped);
    };

    const effectiveEndBySegmentKey = new Map<string, number>();
    pushBoundaryMinutes(segments[0].startMinutes);
    for (const segment of segments) {
      const effectiveEnd =
        segment.endMinutes > segment.startMinutes
          ? segment.endMinutes
          : Math.min(DAY_END_HOUR * 60, segment.startMinutes + 1);

      effectiveEndBySegmentKey.set(segment.key, effectiveEnd);
      pushBoundaryMinutes(effectiveEnd);
    }

    const boundaries: DayAgendaTimelineBoundary[] = boundaryMinutes.map(
      (minutes, index) => ({
        key: `boundary-${minutes}-${index}`,
        minutes,
        label: this.formatTimelineBoundaryMinutes(minutes),
      })
    );

    const boundaryIndexByMinutes = new Map<number, number>();
    boundaries.forEach((boundary, index) => {
      boundaryIndexByMinutes.set(boundary.minutes, index);
    });

    const timelineSegments: DayAgendaTimelineSegment[] = segments.map(
      (segment, index) => {
        const effectiveEnd =
          effectiveEndBySegmentKey.get(segment.key) ?? segment.endMinutes;
        const startBoundaryIndex =
          boundaryIndexByMinutes.get(segment.startMinutes) ?? Math.max(0, index);
        const endBoundaryIndex =
          boundaryIndexByMinutes.get(effectiveEnd) ??
          Math.min(startBoundaryIndex + 1, boundaries.length - 1);

        return {
          key: segment.key,
          type: segment.type,
          startMinutes: segment.startMinutes,
          endMinutes: effectiveEnd,
          startBoundaryIndex,
          endBoundaryIndex,
          heightTier: segment.heightTier,
          visualHeightPx: segment.visualHeightPx,
          title: segment.displayTitle,
          hint: segment.displayHint,
          accentColor: segment.displayAccentColor,
          accentBackgroundColor: segment.task?.accentBackgroundColor ?? null,
          accentShadowColor: segment.task?.accentShadowColor ?? null,
          eventItems:
            segment.type === 'event'
              ? (segment.items ?? []).map((item) => ({
                  key: `event-item-${segment.key}-${item.taskId}`,
                  taskId: item.taskId,
                  title: item.title,
                  ariaLabel: this.taskAriaLabel(item),
                  accentColor: item.accentBorderColor,
                  accentBackgroundColor: item.accentBackgroundColor,
                  accentShadowColor: item.accentShadowColor,
                }))
              : [],
          isCurrent: segment.isCurrent,
          interactive: segment.type === 'event' && (segment.items?.length ?? 0) > 0,
          ariaLabel:
            segment.type === 'event' && segment.task
              ? this.taskAriaLabel(segment.task)
              : null,
        };
      }
    );

    return {
      boundaries,
      segments: timelineSegments,
    };
  }

  private createEmptySegment(
    startMinutes: number,
    endMinutes: number,
    nowMinutes: number | null
  ): AgendaDaySegment {
    const durationMinutes = Math.max(0, endMinutes - startMinutes);
    const heightTier = this.resolveEmptyHeightTier(durationMinutes);
    const displayHint = this.resolveEmptySegmentHint();
    return {
      key: `empty-${startMinutes}-${endMinutes}`,
      type: 'empty',
      startMinutes,
      endMinutes,
      durationMinutes,
      heightTier,
      visualHeightPx: this.resolveTierVisualHeight(heightTier),
      timeTopLabel: this.formatMinutes(startMinutes),
      timeBottomLabel: this.formatTimelineBoundaryMinutes(endMinutes),
      isCurrent: this.isNowInRange(startMinutes, endMinutes, nowMinutes),
      displayTitle: null,
      displayHint,
      displayAccentColor: null,
      emptyHint: displayHint,
    };
  }

  private createEventSegment(
    tasks: readonly AgendaTimelineTask[],
    startMinutes: number,
    endMinutes: number,
    nowMinutes: number | null
  ): AgendaDaySegment {
    const primaryTask = tasks[0];
    const durationMinutes = Math.max(0, endMinutes - startMinutes);
    const heightTier = this.resolveEventHeightTier(durationMinutes);
    return {
      key: `event-${tasks.map((task) => task.taskId).join('-')}-${startMinutes}`,
      type: 'event',
      startMinutes,
      endMinutes,
      durationMinutes,
      heightTier,
      visualHeightPx: this.resolveTierVisualHeight(heightTier),
      timeTopLabel: this.formatMinutes(startMinutes),
      timeBottomLabel: this.formatTimelineBoundaryMinutes(endMinutes),
      isCurrent: this.isNowInTaskRange(startMinutes, endMinutes, nowMinutes),
      displayTitle: primaryTask?.title ?? null,
      displayHint: null,
      displayAccentColor: primaryTask?.accentBorderColor ?? null,
      emptyHint: null,
      items: [...tasks],
      task: primaryTask,
    };
  }

  private resolveEmptyHeightTier(durationMinutes: number): DayAgendaTimelineHeightTier {
    if (durationMinutes <= 15) {
      return 'empty-sm';
    }

    if (durationMinutes <= 45) {
      return 'empty-md';
    }

    return 'empty-lg';
  }

  private resolveEventHeightTier(durationMinutes: number): DayAgendaTimelineHeightTier {
    if (durationMinutes <= 15) {
      return 'event-sm';
    }

    if (durationMinutes <= 45) {
      return 'event-md';
    }

    return 'event-lg';
  }

  private resolveTierVisualHeight(tier: DayAgendaTimelineHeightTier): number {
    switch (tier) {
      case 'empty-sm':
        return EMPTY_SEGMENT_HEIGHT_SM_PX;
      case 'empty-md':
        return EMPTY_SEGMENT_HEIGHT_MD_PX;
      case 'empty-lg':
        return EMPTY_SEGMENT_HEIGHT_LG_PX;
      case 'event-sm':
        return EVENT_SEGMENT_HEIGHT_SM_PX;
      case 'event-md':
        return EVENT_SEGMENT_HEIGHT_MD_PX;
      case 'event-lg':
        return EVENT_SEGMENT_HEIGHT_LG_PX;
      default:
        return EMPTY_SEGMENT_HEIGHT_SM_PX;
    }
  }

  private formatTimelineBoundaryMinutes(minutes: number): string {
    // Keep visual narrative human-readable at day closure: 24:00 is shown as 23:59.
    if (minutes >= DAY_END_HOUR * 60) {
      return '23:59';
    }

    return this.formatMinutes(minutes);
  }

  private resolveCurrentDayMinutes(): number | null {
    if (!this.isSelectedDayToday) {
      return null;
    }

    return this.now.getHours() * 60 + this.now.getMinutes();
  }

  private isNowInRange(
    startMinutes: number,
    endMinutes: number,
    nowMinutes: number | null
  ): boolean {
    if (nowMinutes === null) {
      return false;
    }

    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  private isNowInTaskRange(
    startMinutes: number,
    endMinutes: number,
    nowMinutes: number | null
  ): boolean {
    if (nowMinutes === null) {
      return false;
    }

    if (endMinutes <= startMinutes) {
      return nowMinutes === startMinutes;
    }

    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  private buildMonthCells(date: Date): AgendaMonthCell[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = this.createDate(year, month, 1);
    const firstWeekdayIndex = this.toMondayBasedDay(firstDay) - 1;
    const daysInMonth = this.daysInMonth(year, month);
    const cells: AgendaMonthCell[] = [];

    for (let index = 0; index < firstWeekdayIndex; index += 1) {
      cells.push({
        key: `empty-${index}`,
        date: null,
        dayNumberLabel: '',
        densityLevel: 0,
        categoryDotColors: [],
        categoryDotTopColors: [],
        categoryDotMiddleColors: [],
        categoryDotBottomColors: [],
        categoryDotOverflow: 0,
        isToday: false,
        isSelected: false,
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const cellDate = this.createDate(year, month, day);
      const daySummary = this.buildMonthCellTaskSummary(cellDate);
      const dotLayout = this.buildMonthCellDotLayout(daySummary.categoryDotColors);
      cells.push({
        key: this.dateKey(cellDate),
        date: cellDate,
        dayNumberLabel: `${day}`,
        densityLevel: this.toDensityLevel(daySummary.taskCount),
        categoryDotColors: daySummary.categoryDotColors,
        categoryDotTopColors: dotLayout.topColors,
        categoryDotMiddleColors: dotLayout.middleColors,
        categoryDotBottomColors: dotLayout.bottomColors,
        categoryDotOverflow: dotLayout.overflowCount,
        isToday: this.isSameDay(cellDate, new Date()),
        isSelected: this.isSameDay(cellDate, this.selectedDate),
        isCurrentMonth: true,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        key: `tail-${cells.length}`,
        date: null,
        dayNumberLabel: '',
        densityLevel: 0,
        categoryDotColors: [],
        categoryDotTopColors: [],
        categoryDotMiddleColors: [],
        categoryDotBottomColors: [],
        categoryDotOverflow: 0,
        isToday: false,
        isSelected: false,
        isCurrentMonth: false,
      });
    }

    return cells;
  }

  private buildYearMonths(date: Date): AgendaYearMonth[] {
    const year = date.getFullYear();
    const today = new Date();

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthDate = this.createDate(year, monthIndex, 1);
      const taskCount = this.countTasksForMonth(year, monthIndex);
      return {
        key: `${year}-${monthIndex + 1}`,
        monthIndex,
        monthLabel: new Intl.DateTimeFormat(this.activeLocale, {
          month: 'long',
        }).format(monthDate),
        densityLevel: this.toDensityLevel(taskCount),
        isCurrentMonth:
          today.getFullYear() === year && today.getMonth() === monthIndex,
        isSelectedMonth:
          this.selectedDate.getFullYear() === year &&
          this.selectedDate.getMonth() === monthIndex,
      };
    });
  }

  private countTasksForDate(date: Date): number {
    let count = 0;
    for (const task of this.scheduledTasks) {
      if (this.taskOccursOnDate(task, date)) {
        count += 1;
      }
    }

    return count;
  }

  private countTasksForMonth(year: number, month: number): number {
    const daysInMonth = this.daysInMonth(year, month);
    let count = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      count += this.countTasksForDate(this.createDate(year, month, day));
    }

    return count;
  }

  private buildMonthCellTaskSummary(date: Date): {
    taskCount: number;
    categoryDotColors: string[];
  } {
    const monthSummary = this.monthSummaryCache.get(this.monthSummaryKey(date));
    if (monthSummary) {
      const cachedSummary = monthSummary.get(this.dateKey(date));
      if (cachedSummary) {
        return {
          taskCount: cachedSummary.taskCount,
          categoryDotColors: [...cachedSummary.categoryDotColors],
        };
      }

      return {
        taskCount: 0,
        categoryDotColors: [],
      };
    }

    let taskCount = 0;
    const categoryDotColors: string[] = [];
    const seenCategoryColors = new Set<string>();

    for (const task of this.scheduledTasks) {
      if (!this.taskOccursOnDate(task, date)) {
        continue;
      }

      taskCount += 1;
      const categoryColor = this.resolveTaskColor(task).trim();
      if (!categoryColor) {
        continue;
      }

      const colorKey = categoryColor.toLowerCase();
      if (seenCategoryColors.has(colorKey)) {
        continue;
      }

      seenCategoryColors.add(colorKey);
      categoryDotColors.push(categoryColor);
    }

    return {
      taskCount,
      categoryDotColors,
    };
  }

  private buildMonthCellDotLayout(categoryDotColors: readonly string[]): {
    topColors: string[];
    middleColors: string[];
    bottomColors: string[];
    overflowCount: number;
  } {
    if (categoryDotColors.length <= MONTH_DOT_MAX_VISIBLE) {
      return {
        topColors: categoryDotColors.slice(0, MONTH_DOT_ROW_CAPACITY),
        middleColors: categoryDotColors.slice(
          MONTH_DOT_ROW_CAPACITY,
          MONTH_DOT_ROW_CAPACITY * 2
        ),
        bottomColors: categoryDotColors.slice(
          MONTH_DOT_ROW_CAPACITY * 2,
          MONTH_DOT_ROW_CAPACITY * 3
        ),
        overflowCount: 0,
      };
    }

    const visibleColors = categoryDotColors.slice(0, MONTH_DOT_VISIBLE_WITH_OVERFLOW);
    return {
      topColors: visibleColors.slice(0, MONTH_DOT_ROW_CAPACITY),
      middleColors: visibleColors.slice(
        MONTH_DOT_ROW_CAPACITY,
        MONTH_DOT_ROW_CAPACITY * 2
      ),
      bottomColors: visibleColors.slice(MONTH_DOT_ROW_CAPACITY * 2),
      overflowCount: categoryDotColors.length - MONTH_DOT_VISIBLE_WITH_OVERFLOW,
    };
  }

  private taskOccursOnDate(task: PersistedTaskAggregate, date: Date): boolean {
    return this.resolveOccurrence(task, date).occurs;
  }

  private resolveOccurrence(task: PersistedTaskAggregate, date: Date): AgendaOccurrenceDecision {
    const dateKey = this.resolveTaskDateKey(date);

    if (task.scheduleType === 'one_time') {
      const oneTimeDate =
        this.normalizeLocalDateKey(task.startLocalDate) ??
        this.resolveLocalDateKeyFromIso(task.oneTimeDate, this.resolveTaskTimezone(task));
      if (!oneTimeDate) {
        return { occurs: false, reason: 'invalid_one_time_date' };
      }

      return oneTimeDate === dateKey
        ? { occurs: true, reason: 'one_time_date_match' }
        : { occurs: false, reason: 'one_time_date_mismatch' };
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence) {
      return { occurs: false, reason: 'no_recurrence' };
    }

    const startDate =
      this.normalizeLocalDateKey(task.startLocalDate) ??
      this.resolveLocalDateKeyFromIso(recurrence.startDate, this.resolveTaskTimezone(task));
    if (startDate && isBefore(dateKey, startDate)) {
      return { occurs: false, reason: 'before_start_date' };
    }

    if (recurrence.hasEndDate && recurrence.endDate) {
      const endDate =
        this.normalizeLocalDateKey(task.endLocalDate) ??
        this.resolveLocalDateKeyFromIso(recurrence.endDate, this.resolveTaskTimezone(task));
      if (endDate && isAfter(dateKey, endDate)) {
        return { occurs: false, reason: 'after_end_date' };
      }
    }

    const dateParts = parseCalendarDate(dateKey);
    const weekday = getWeekday(dateKey, 'UTC');
    switch (recurrence.pattern) {
      case 'daily':
        return { occurs: true, reason: 'daily' };
      case 'selected_weekdays':
        return recurrence.weekdays.some(
          (entry) => entry.dayOfWeek === weekday
        )
          ? { occurs: true, reason: 'weekday_match' }
          : { occurs: false, reason: 'weekday_not_selected' };
      case 'monthly':
        return recurrence.dayOfMonth === dateParts.day
          ? { occurs: true, reason: 'monthly_day_match' }
          : { occurs: false, reason: 'monthly_day_mismatch' };
      case 'yearly':
        return (
          recurrence.yearMonth === dateParts.month &&
          recurrence.yearDay === dateParts.day
        )
          ? { occurs: true, reason: 'yearly_day_match' }
          : { occurs: false, reason: 'yearly_day_mismatch' };
      default:
        return { occurs: false, reason: 'unsupported_pattern' };
    }
  }

  private resolveTimeForDate(task: PersistedTaskAggregate, date: Date): string | null {
    return this.resolveTimeForDateDetailed(task, date).resolvedTime;
  }

  private resolveTimeForDateDetailed(task: PersistedTaskAggregate, date: Date): AgendaResolvedTime {
    if (task.scheduleType === 'one_time') {
      const normalizedTime = task.oneTimeTime?.trim() ?? '';
      return {
        source: normalizedTime ? 'one_time.timeOfDay' : 'none',
        resolvedTime: normalizedTime || null,
        startMinutes: normalizedTime ? this.timeToMinutes(normalizedTime) : null,
      };
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (!recurrence || !recurrence.hasTime) {
      return {
        source: 'none',
        resolvedTime: null,
        startMinutes: null,
      };
    }

    let resolvedTime: string | null = null;
    let source: AgendaResolvedTime['source'] = 'none';
    const weekday = getWeekday(this.resolveTaskDateKey(date), 'UTC');

    if (recurrence.pattern === 'selected_weekdays') {
      const weekdayConfig = recurrence.weekdays.find(
        (item) => item.dayOfWeek === weekday
      );
      if (weekdayConfig?.timeValue) {
        resolvedTime = weekdayConfig.timeValue;
        source = 'weekly_schedule.weeklyDayTimes';
      } else if (recurrence.commonTime) {
        resolvedTime = recurrence.commonTime;
        source = 'simple.timeOfDay';
      }
    } else if (recurrence.commonTime) {
      resolvedTime = recurrence.commonTime;
      source = 'simple.timeOfDay';
    } else if (recurrence.weekdays[0]?.timeValue) {
      resolvedTime = recurrence.weekdays[0].timeValue;
      source = 'weekly_schedule.weeklyDayTimes';
    }

    return {
      source,
      resolvedTime,
      startMinutes: resolvedTime ? this.timeToMinutes(resolvedTime) : null,
    };
  }

  private resolveTaskDuration(task: PersistedTaskAggregate, date: Date): number {
    if (task.trackingMode !== 'duration') {
      return 0;
    }

    if (task.scheduleType === 'one_time') {
      return task.estimatedDurationMin && task.estimatedDurationMin > 0
        ? task.estimatedDurationMin
        : 0;
    }

    const recurrence = task.recurrenceEnabled ? task.recurrence : undefined;
    if (recurrence?.pattern === 'selected_weekdays') {
      const dayOfWeek = getWeekday(this.resolveTaskDateKey(date), 'UTC');
      const weekday = recurrence.weekdays.find((entry) => entry.dayOfWeek === dayOfWeek);
      if (weekday?.durationMin && weekday.durationMin > 0) {
        return weekday.durationMin;
      }

      if (recurrence.commonDurationMin && recurrence.commonDurationMin > 0) {
        return recurrence.commonDurationMin;
      }
    } else if (recurrence?.commonDurationMin && recurrence.commonDurationMin > 0) {
      return recurrence.commonDurationMin;
    }

    return task.estimatedDurationMin && task.estimatedDurationMin > 0
      ? task.estimatedDurationMin
      : 0;
  }

  private createUntimedTask(task: PersistedTaskAggregate): AgendaUntimedTask {
    const color = this.resolveTaskColor(task);
    return {
      taskId: task.id,
      title: task.title,
      description: task.description?.trim() || null,
      accentBorderColor: color,
      accentBackgroundColor: this.withAlpha(color, 0.11),
      createdAt: task.createdAt,
    };
  }

  private resolveDefaultCreateTime(date: Date): string {
    const now = new Date();
    if (!this.isSameDay(date, now)) {
      return '09:00';
    }

    const roundedMinutes = Math.ceil((now.getHours() * 60 + now.getMinutes()) / SLOT_MINUTES) * SLOT_MINUTES;
    const clamped = Math.max(DAY_START_HOUR * 60, Math.min(roundedMinutes, DAY_END_HOUR * 60 - DEFAULT_GAP_DURATION_MIN));
    return this.formatMinutes(clamped);
  }

  private async navigateToCreateTask(
    date: Date,
    startTime: string,
    suggestedDuration: number
  ): Promise<void> {
    await this.router.navigate(['/task/new'], {
      queryParams: {
        date: this.dateKey(date),
        startTime,
        suggestedDuration,
      },
    });
  }

  private isAgendaViewMode(value: string | undefined): value is AgendaViewMode {
    return value === 'day' || value === 'month' || value === 'year';
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

  private formatMinutes(minutes: number): string {
    const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const remainder = normalized % 60;
    return `${`${hours}`.padStart(2, '0')}:${`${remainder}`.padStart(2, '0')}`;
  }

  private dateAtLocalNoon(value: Date): Date {
    return this.createDate(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private createDate(year: number, month: number, day: number): Date {
    return new Date(year, month, day, 12, 0, 0, 0);
  }

  private addDays(date: Date, days: number): Date {
    const next = this.cloneDate(date);
    next.setDate(next.getDate() + days);
    return this.dateAtLocalNoon(next);
  }

  private shiftMonth(date: Date, deltaMonths: number): Date {
    const targetMonth = date.getMonth() + deltaMonths;
    const year = date.getFullYear() + Math.floor(targetMonth / 12);
    const month = ((targetMonth % 12) + 12) % 12;
    const day = Math.min(date.getDate(), this.daysInMonth(year, month));
    return this.createDate(year, month, day);
  }

  private shiftYear(date: Date, deltaYears: number): Date {
    const year = date.getFullYear() + deltaYears;
    const month = date.getMonth();
    const day = Math.min(date.getDate(), this.daysInMonth(year, month));
    return this.createDate(year, month, day);
  }

  private withMonth(date: Date, monthIndex: number): Date {
    const day = Math.min(date.getDate(), this.daysInMonth(date.getFullYear(), monthIndex));
    return this.createDate(date.getFullYear(), monthIndex, day);
  }

  private cloneDate(date: Date): Date {
    return this.createDate(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  private dateKey(date: Date): string {
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  }

  private monthSummaryKey(date: Date): string {
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
  }

  private resolveTaskTimezone(task: PersistedTaskAggregate): string {
    const fallback = getDeviceTimezone();
    const candidate = task.timezone?.trim() || task.recurrence?.timezone?.trim() || fallback;
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: candidate }).format(new Date());
      return candidate;
    } catch {
      return fallback;
    }
  }

  private resolveTaskDateKey(date: Date): string {
    return this.dateKey(date);
  }

  private normalizeLocalDateKey(value: string | null | undefined): string | null {
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
    if (typeof value !== 'string') {
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

  private compareDateOnly(left: Date, right: Date): number {
    const leftKey = this.dateKey(left);
    const rightKey = this.dateKey(right);
    return leftKey.localeCompare(rightKey);
  }

  private isSameDay(left: Date, right: Date): boolean {
    return this.compareDateOnly(this.dateAtLocalNoon(left), this.dateAtLocalNoon(right)) === 0;
  }

  private toMondayBasedDay(date: Date): number {
    const day = date.getDay();
    return day === 0 ? 7 : day;
  }

  private toDensityLevel(taskCount: number): number {
    if (taskCount <= 0) {
      return 0;
    }

    if (taskCount === 1) {
      return 1;
    }

    if (taskCount <= 3) {
      return 2;
    }

    return 3;
  }

  private resolveTaskColor(task: PersistedTaskAggregate): string {
    return task.categoryColor ?? '#64748B';
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
    if ([red, green, blue].some((value) => Number.isNaN(value))) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private capitalizeFirst(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return trimmed;
    }

    return `${trimmed.charAt(0).toLocaleUpperCase(this.activeLocale)}${trimmed.slice(1)}`;
  }

  private buildSampleTaskAggregate(): PersistedTaskAggregate {
    const nowIso = new Date().toISOString();
    return {
      id: 'sample-task',
      title: this.translate.instant('TASKS.SAMPLE_TASK'),
      description: null,
      trackingMode: 'duration',
      priority: 'B',
      scheduleType: 'recurring',
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
        offsets: [15],
        soundName: null,
        ttsText: null,
        repeatIfMissed: false,
      },
    };
  }
}
