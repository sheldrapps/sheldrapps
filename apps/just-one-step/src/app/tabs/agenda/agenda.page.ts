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
  TaskYearMonthCategorySummary,
  TaskRepository,
} from '../../database/repositories/task.repository';
import { CategoryRepository } from '../../database/repositories/category.repository';
import { Subscription } from 'rxjs';
import { AgendaControlsComponent } from './components/agenda-controls.component';
import {
  createEmptySegment,
  createEventSegment,
} from './agenda-day-segments';

type AgendaViewMode = 'day' | 'month' | 'year';
interface ScopeReloadOptions {
  scrollNearNow?: boolean;
  scrollRailToToday?: boolean;
}
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
  type: "empty" | "event";
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
  displayTimeLabel: string | null;
  displayDurationLabel: string | null;
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
  categoryIds: string[];
}

interface AgendaYearMonthTaskSummary {
  taskCount: number;
  categoryIds: string[];
}

type AgendaSummaryWarmupScope = 'month' | 'year';
type AgendaWarmupScheduleMode = 'idle' | 'timeout';

interface AgendaSummaryWarmupSnapshot {
  monthKey: string;
  yearKey: string;
  todayKey: string;
}

interface AgendaActiveTimerWindowRecord {
  startedAt: string;
  expectedEndAt?: string | null;
  endedAt?: string | null;
  completedAt?: string | null;
  status?: string | null;
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
  categoryBarGradient: string | null;
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
const MONTH_SUMMARY_CACHE_STORAGE_KEY = 'just-one-step.agenda.month-summary.v2';
const YEAR_SUMMARY_CACHE_STORAGE_KEY = 'just-one-step.agenda.year-summary.v2';
const CATEGORY_COLOR_CACHE_STORAGE_KEY = 'just-one-step.agenda.category-color-map.v1';
const CATEGORY_COLOR_CACHE_MAX_ENTRIES = 512;
const SUMMARY_WARMUP_IDLE_TIMEOUT_MS = 1_200;
const SUMMARY_WARMUP_FALLBACK_DELAY_MS = 180;
const SUMMARY_WARMUP_MIN_INTERVAL_MS = 20_000;
const SUMMARY_WARMUP_FAILURE_BACKOFF_MS = 120_000;
const SUMMARY_WARMUP_STATE_KEY_LIMIT = 96;
const ACTIVE_TIMER_WINDOWS_STORAGE_KEY = 'just-one-step.timer.active-windows.v1';
const MAX_ACTIVE_TIMER_SPAN_DAYS = 370;
const CATEGORY_COLOR_FALLBACK_PALETTE = [
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#14B8A6',
  '#EC4899',
  '#22C55E',
  '#3B82F6',
  '#F97316',
] as const;

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
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly debugDayClassification = false;

  constructor() {
    addIcons({ addOutline, chevronBackOutline, chevronForwardOutline });
    this.loadPersistedSummaryCaches();
    this.loadPersistedCategoryColorMap();
    this.refreshActiveTimerMutableScopes(new Date());
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
  private readonly yearSummaryCache = new Map<
    string,
    Map<number, AgendaYearMonthTaskSummary>
  >();
  private readonly yearSummaryLoading = new Set<string>();
  private readonly persistedMonthSummaryCache = new Map<
    string,
    Map<string, AgendaMonthDayTaskSummary>
  >();
  private readonly persistedYearSummaryCache = new Map<
    string,
    Map<number, AgendaYearMonthTaskSummary>
  >();
  private readonly summaryRefreshDayByScope = new Map<string, string>();
  private readonly summaryWarmupAttemptAtByScope = new Map<string, number>();
  private readonly summaryWarmupBlockedUntilByScope = new Map<string, number>();
  private readonly activeTimerMutableDateKeys = new Set<string>();
  private readonly activeTimerMutableMonthKeys = new Set<string>();
  private readonly activeTimerMutableYearKeys = new Set<string>();
  private activeTimerMutableScopesSignature = '';
  private summaryWarmupHandle: number | null = null;
  private summaryWarmupScheduleMode: AgendaWarmupScheduleMode | null = null;
  private summaryWarmupToken = 0;
  private categoryColorById = new Map<string, string>();
  private scopeLoadInFlight = false;
  private pendingScopeReload: ScopeReloadOptions | null = null;

  currentView: AgendaViewMode = 'day';
  selectedDate = this.dateAtLocalNoon(new Date());
  scheduledTasks: PersistedTaskAggregate[] = [];
  isLoading = false;
  loadFailed = false;
  now = new Date();
  private nowTickerId: number | null = null;
  private isDestroyed = false;
  private readonly onStorageEvent = (event: StorageEvent): void => {
    if (event.key !== ACTIVE_TIMER_WINDOWS_STORAGE_KEY || this.isDestroyed) {
      return;
    }

    if (this.refreshActiveTimerMutableScopes(new Date())) {
      void this.reloadCurrentScopeWithLoader();
    }
  };

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
    window.addEventListener('storage', this.onStorageEvent);
    this.selectedDate = this.dateAtLocalNoon(new Date());
    this.startNowTicker();
    await this.reloadCurrentScopeWithLoader({
      scrollNearNow: true,
      scrollRailToToday: true,
    });
  }

  ngAfterViewInit(): void {
    this.renderCurrentView();
  }

  ionViewDidLeave(): void {
    window.removeEventListener('storage', this.onStorageEvent);
    this.cancelScheduledSummaryWarmup();
    this.stopNowTicker();
  }

  ionViewDidEnter(): void {
    this.renderCurrentView();
    this.scheduleDayRenderRecovery();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    window.removeEventListener('storage', this.onStorageEvent);
    this.cancelScheduledSummaryWarmup();
    this.destroyRenderedView();
    this.stopNowTicker();
  }

  onViewModeSelected(nextView: AgendaViewMode): void {
    if (this.currentView === nextView) {
      return;
    }

    this.currentView = nextView;
    void this.reloadCurrentScopeWithLoader();
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
    this.selectedDate = this.addDays(this.selectedDate, deltaDays);
    void this.reloadCurrentScopeWithLoader({
      scrollNearNow: true,
      scrollRailToToday: this.isSelectedDayToday,
    });
  }

  onMonthShift(deltaMonths: number): void {
    this.selectedDate = this.shiftMonth(this.selectedDate, deltaMonths);
    void this.reloadCurrentScopeWithLoader();
  }

  onYearShift(deltaYears: number): void {
    this.selectedDate = this.shiftYear(this.selectedDate, deltaYears);
    void this.reloadCurrentScopeWithLoader();
  }

  selectRailDay(day: AgendaRailDay): void {
    this.selectedDate = this.cloneDate(day.date);
    void this.reloadCurrentScopeWithLoader({
      scrollNearNow: true,
      scrollRailToToday: day.isToday,
    });
  }

  openDayFromMonth(cell: AgendaMonthCell): void {
    if (!cell.date) {
      return;
    }

    this.selectedDate = this.cloneDate(cell.date);
    this.currentView = 'day';
    void this.reloadCurrentScopeWithLoader({
      scrollNearNow: true,
      scrollRailToToday: this.isSelectedDayToday,
    });
  }

  openMonthFromYear(month: AgendaYearMonth): void {
    this.selectedDate = this.withMonth(this.selectedDate, month.monthIndex);
    this.currentView = 'month';
    void this.reloadCurrentScopeWithLoader();
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
    if (this.isDestroyed || this.isLoading) {
      return;
    }

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

  private async reloadCurrentScopeWithLoader(options?: ScopeReloadOptions): Promise<void> {
    if (this.scopeLoadInFlight) {
      this.pendingScopeReload = this.mergeScopeReloadOptions(
        this.pendingScopeReload,
        options
      );
      return;
    }

    this.scopeLoadInFlight = true;
    this.beginLoadingOverlay();
    this.loadFailed = false;

    try {
      this.refreshActiveTimerMutableScopes(new Date());
      await this.loadCategoryColorMap();
      await this.loadDataForCurrentScope(this.selectedDate);
      if (this.isDestroyed) {
        return;
      }

      this.refreshViewModels();

      if (options?.scrollNearNow && this.currentView === 'day') {
        this.queueScrollNearNow();
      }

      if (options?.scrollRailToToday && this.currentView === 'day') {
        this.queueScrollRailToToday();
      }
    } catch {
      if (this.isDestroyed) {
        return;
      }

      this.loadFailed = true;
      if (this.currentView === 'day') {
        this.scheduledTasks = [];
      }
      this.refreshViewModels();
    } finally {
      this.scopeLoadInFlight = false;
      if (!this.isDestroyed) {
        this.endLoadingOverlay();
      }

      if (this.pendingScopeReload) {
        const pendingOptions = this.pendingScopeReload;
        this.pendingScopeReload = null;
        void this.reloadCurrentScopeWithLoader(pendingOptions);
      } else {
        this.prewarmSummaryCachesInBackground(this.cloneDate(this.selectedDate));
      }
    }
  }

  private async loadCategoryColorMap(): Promise<void> {
    try {
      const categories = await this.categoryRepository.listCategories({
        includeArchived: true,
        includeDeleted: true,
      });
      const mappedColors = new Map<string, string>();
      for (const category of categories) {
        const categoryId = category.id.trim();
        const categoryColor = category.color.trim();
        if (!categoryId || !categoryColor) {
          continue;
        }

        mappedColors.set(categoryId.toLowerCase(), categoryColor);
      }

      if (mappedColors.size > 0) {
        this.categoryColorById = mappedColors;
        this.writePersistedCategoryColorMap();
      }
    } catch {
      // Keep current map when category loading fails.
      if (this.categoryColorById.size === 0) {
        this.loadPersistedCategoryColorMap();
      }
    }
  }

  private prewarmSummaryCachesInBackground(date: Date): void {
    if (this.isDestroyed) {
      return;
    }

    const warmupDate = this.cloneDate(date);
    const snapshot = this.buildSummaryWarmupSnapshot(warmupDate);
    if (!this.shouldWarmAnySummary(snapshot)) {
      return;
    }

    const token = ++this.summaryWarmupToken;
    this.cancelScheduledSummaryWarmup();

    const executeWarmup = (): void => {
      this.summaryWarmupHandle = null;
      this.summaryWarmupScheduleMode = null;
      if (!this.canRunSummaryWarmup(token)) {
        return;
      }

      void this.runSummaryWarmup(token, warmupDate, snapshot);
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number }
      ) => number;
    };
    if (typeof idleWindow.requestIdleCallback === 'function') {
      this.summaryWarmupScheduleMode = 'idle';
      this.summaryWarmupHandle = idleWindow.requestIdleCallback(executeWarmup, {
        timeout: SUMMARY_WARMUP_IDLE_TIMEOUT_MS,
      });
      return;
    }

    this.summaryWarmupScheduleMode = 'timeout';
    this.summaryWarmupHandle = window.setTimeout(
      executeWarmup,
      SUMMARY_WARMUP_FALLBACK_DELAY_MS
    );
  }

  private async runSummaryWarmup(
    token: number,
    date: Date,
    snapshot: AgendaSummaryWarmupSnapshot
  ): Promise<void> {
    const nowTimestamp = Date.now();
    if (this.shouldWarmMonthSummary(snapshot) && this.canRunSummaryWarmup(token)) {
      const monthScopeKey = this.summaryRefreshScopeKey('month', snapshot.monthKey);
      this.recordSummaryWarmupAttempt(monthScopeKey, nowTimestamp);
      const loadedMonth = await this.ensureMonthSummaryForDate(date);
      if (!loadedMonth && this.canRunSummaryWarmup(token)) {
        this.recordSummaryWarmupFailure(monthScopeKey, nowTimestamp);
      }
    }

    if (this.shouldWarmYearSummary(snapshot) && this.canRunSummaryWarmup(token)) {
      const yearScopeKey = this.summaryRefreshScopeKey('year', snapshot.yearKey);
      this.recordSummaryWarmupAttempt(yearScopeKey, nowTimestamp);
      const loadedYear = await this.ensureYearSummaryForDate(date);
      if (!loadedYear && this.canRunSummaryWarmup(token)) {
        this.recordSummaryWarmupFailure(yearScopeKey, nowTimestamp);
      }
    }
  }

  private canRunSummaryWarmup(token: number): boolean {
    return (
      token === this.summaryWarmupToken &&
      !this.isDestroyed &&
      !this.scopeLoadInFlight &&
      !this.pendingScopeReload
    );
  }

  private cancelScheduledSummaryWarmup(): void {
    if (this.summaryWarmupHandle === null) {
      return;
    }

    const handle = this.summaryWarmupHandle;
    const scheduleMode = this.summaryWarmupScheduleMode;
    this.summaryWarmupHandle = null;
    this.summaryWarmupScheduleMode = null;

    if (scheduleMode === 'idle') {
      const idleWindow = window as Window & {
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(handle);
        return;
      }
    }

    window.clearTimeout(handle);
  }

  private buildSummaryWarmupSnapshot(date: Date): AgendaSummaryWarmupSnapshot {
    const normalizedDate = this.dateAtLocalNoon(date);
    return {
      monthKey: this.monthSummaryKey(normalizedDate),
      yearKey: this.yearSummaryKey(normalizedDate),
      todayKey: this.dateKey(this.dateAtLocalNoon(new Date())),
    };
  }

  private shouldWarmAnySummary(snapshot: AgendaSummaryWarmupSnapshot): boolean {
    return (
      this.shouldWarmMonthSummary(snapshot) || this.shouldWarmYearSummary(snapshot)
    );
  }

  private shouldWarmMonthSummary(snapshot: AgendaSummaryWarmupSnapshot): boolean {
    if (this.monthSummaryLoading.has(snapshot.monthKey)) {
      return false;
    }
    const monthScopeKey = this.summaryRefreshScopeKey('month', snapshot.monthKey);
    if (this.isSummaryWarmupThrottled(monthScopeKey, Date.now())) {
      return false;
    }

    const immutableMonth = this.isMonthKeyImmutable(
      snapshot.monthKey,
      snapshot.todayKey
    );
    if (immutableMonth) {
      return (
        !this.monthSummaryCache.has(snapshot.monthKey) &&
        !this.persistedMonthSummaryCache.has(snapshot.monthKey)
      );
    }

    if (!this.monthSummaryCache.has(snapshot.monthKey)) {
      return true;
    }

    return (
      this.summaryRefreshDayByScope.get(monthScopeKey) !== snapshot.todayKey
    );
  }

  private shouldWarmYearSummary(snapshot: AgendaSummaryWarmupSnapshot): boolean {
    if (this.yearSummaryLoading.has(snapshot.yearKey)) {
      return false;
    }
    const yearScopeKey = this.summaryRefreshScopeKey('year', snapshot.yearKey);
    if (this.isSummaryWarmupThrottled(yearScopeKey, Date.now())) {
      return false;
    }

    if (this.isYearKeyImmutable(snapshot.yearKey, snapshot.todayKey)) {
      return (
        !this.yearSummaryCache.has(snapshot.yearKey) &&
        !this.persistedYearSummaryCache.has(snapshot.yearKey)
      );
    }

    if (!this.yearSummaryCache.has(snapshot.yearKey)) {
      return true;
    }

    return (
      this.summaryRefreshDayByScope.get(yearScopeKey) !== snapshot.todayKey
    );
  }

  private summaryRefreshScopeKey(
    scope: AgendaSummaryWarmupScope,
    scopeKey: string
  ): string {
    return `${scope}:${scopeKey}`;
  }

  private markSummaryRefreshedToday(
    scope: AgendaSummaryWarmupScope,
    scopeKey: string
  ): void {
    const compositeScopeKey = this.summaryRefreshScopeKey(scope, scopeKey);
    this.setRecencyMapValue(
      this.summaryRefreshDayByScope,
      compositeScopeKey,
      this.dateKey(this.dateAtLocalNoon(new Date()))
    );
    this.summaryWarmupBlockedUntilByScope.delete(compositeScopeKey);
    this.pruneSummaryWarmupState();
  }

  private isSummaryWarmupThrottled(
    compositeScopeKey: string,
    nowTimestamp: number
  ): boolean {
    const blockedUntil = this.summaryWarmupBlockedUntilByScope.get(compositeScopeKey);
    if (blockedUntil && blockedUntil > nowTimestamp) {
      return true;
    }
    if (blockedUntil && blockedUntil <= nowTimestamp) {
      this.summaryWarmupBlockedUntilByScope.delete(compositeScopeKey);
    }

    const lastAttempt = this.summaryWarmupAttemptAtByScope.get(compositeScopeKey);
    return (
      typeof lastAttempt === 'number' &&
      nowTimestamp - lastAttempt < SUMMARY_WARMUP_MIN_INTERVAL_MS
    );
  }

  private recordSummaryWarmupAttempt(
    compositeScopeKey: string,
    nowTimestamp: number
  ): void {
    this.setRecencyMapValue(
      this.summaryWarmupAttemptAtByScope,
      compositeScopeKey,
      nowTimestamp
    );
    this.pruneSummaryWarmupState();
  }

  private recordSummaryWarmupFailure(
    compositeScopeKey: string,
    nowTimestamp: number
  ): void {
    this.setRecencyMapValue(
      this.summaryWarmupBlockedUntilByScope,
      compositeScopeKey,
      nowTimestamp + SUMMARY_WARMUP_FAILURE_BACKOFF_MS
    );
    this.pruneSummaryWarmupState();
  }

  private setRecencyMapValue<T>(map: Map<string, T>, key: string, value: T): void {
    if (map.has(key)) {
      map.delete(key);
    }
    map.set(key, value);
  }

  private pruneSummaryWarmupState(): void {
    this.pruneMapToLimit(this.summaryRefreshDayByScope, SUMMARY_WARMUP_STATE_KEY_LIMIT);
    this.pruneMapToLimit(this.summaryWarmupAttemptAtByScope, SUMMARY_WARMUP_STATE_KEY_LIMIT);
    this.pruneMapToLimit(
      this.summaryWarmupBlockedUntilByScope,
      SUMMARY_WARMUP_STATE_KEY_LIMIT
    );
  }

  private pruneMapToLimit<T>(map: Map<string, T>, limit: number): void {
    while (map.size > limit) {
      const oldestKey = map.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      map.delete(oldestKey);
    }
  }

  private refreshActiveTimerMutableScopes(referenceNow: Date): boolean {
    const normalizedNow = new Date(referenceNow);
    const nowTimestamp = normalizedNow.getTime();
    if (!Number.isFinite(nowTimestamp)) {
      return false;
    }

    const mutableDateKeys = new Set<string>();
    const mutableMonthKeys = new Set<string>();
    const mutableYearKeys = new Set<string>();
    const timerWindows = this.readActiveTimerWindowRecords();

    for (const timerWindow of timerWindows) {
      const mutableRange = this.resolveActiveTimerWindowDateRange(
        timerWindow,
        normalizedNow
      );
      if (!mutableRange) {
        continue;
      }

      this.collectMutableDateKeysFromRange(
        mutableRange.startDate,
        mutableRange.endDate,
        mutableDateKeys,
        mutableMonthKeys,
        mutableYearKeys
      );
    }

    const nextSignature = [...mutableDateKeys].sort().join('|');
    if (nextSignature === this.activeTimerMutableScopesSignature) {
      return false;
    }

    this.activeTimerMutableScopesSignature = nextSignature;
    this.replaceSet(this.activeTimerMutableDateKeys, mutableDateKeys);
    this.replaceSet(this.activeTimerMutableMonthKeys, mutableMonthKeys);
    this.replaceSet(this.activeTimerMutableYearKeys, mutableYearKeys);
    return true;
  }

  private readActiveTimerWindowRecords(): AgendaActiveTimerWindowRecord[] {
    try {
      const rawPayload = window.localStorage.getItem(ACTIVE_TIMER_WINDOWS_STORAGE_KEY);
      if (!rawPayload) {
        return [];
      }

      const parsedPayload = JSON.parse(rawPayload) as unknown;
      const records = this.normalizeActiveTimerWindowPayload(parsedPayload);
      return records.filter((record) => this.isAgendaActiveTimerWindowRecord(record));
    } catch {
      return [];
    }
  }

  private normalizeActiveTimerWindowPayload(
    payload: unknown
  ): AgendaActiveTimerWindowRecord[] {
    if (Array.isArray(payload)) {
      return payload as AgendaActiveTimerWindowRecord[];
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const container = payload as {
      windows?: unknown;
      items?: unknown;
      active?: unknown;
    } & AgendaActiveTimerWindowRecord;
    if (Array.isArray(container.windows)) {
      return container.windows as AgendaActiveTimerWindowRecord[];
    }
    if (Array.isArray(container.items)) {
      return container.items as AgendaActiveTimerWindowRecord[];
    }
    if (Array.isArray(container.active)) {
      return container.active as AgendaActiveTimerWindowRecord[];
    }

    return [container];
  }

  private isAgendaActiveTimerWindowRecord(
    value: unknown
  ): value is AgendaActiveTimerWindowRecord {
    return !!value && typeof value === 'object' && 'startedAt' in value;
  }

  private resolveActiveTimerWindowDateRange(
    timerWindow: AgendaActiveTimerWindowRecord,
    now: Date
  ): { startDate: Date; endDate: Date } | null {
    const startTimestamp = this.parseTimestamp(timerWindow.startedAt);
    if (startTimestamp === null || startTimestamp > now.getTime()) {
      return null;
    }

    const status = (timerWindow.status ?? '').trim().toLowerCase();
    if (
      status === 'completed' ||
      status === 'done' ||
      status === 'stopped' ||
      status === 'cancelled' ||
      status === 'canceled'
    ) {
      return null;
    }

    const completedAtTimestamp = this.parseTimestamp(timerWindow.completedAt ?? null);
    if (completedAtTimestamp !== null && completedAtTimestamp <= now.getTime()) {
      return null;
    }

    const endedAtTimestamp = this.parseTimestamp(timerWindow.endedAt ?? null);
    if (endedAtTimestamp !== null && endedAtTimestamp <= now.getTime()) {
      return null;
    }

    const expectedEndTimestamp = this.parseTimestamp(timerWindow.expectedEndAt ?? null);
    if (expectedEndTimestamp !== null && expectedEndTimestamp <= now.getTime()) {
      return null;
    }

    return {
      startDate: new Date(startTimestamp),
      endDate: now,
    };
  }

  private collectMutableDateKeysFromRange(
    startDate: Date,
    endDate: Date,
    mutableDateKeys: Set<string>,
    mutableMonthKeys: Set<string>,
    mutableYearKeys: Set<string>
  ): void {
    let cursor = this.dateAtLocalNoon(startDate);
    const normalizedEnd = this.dateAtLocalNoon(endDate);
    let guard = 0;
    while (cursor.getTime() <= normalizedEnd.getTime() && guard < MAX_ACTIVE_TIMER_SPAN_DAYS) {
      const dateKey = this.dateKey(cursor);
      mutableDateKeys.add(dateKey);
      mutableMonthKeys.add(dateKey.slice(0, 7));
      mutableYearKeys.add(dateKey.slice(0, 4));
      cursor = this.addDays(cursor, 1);
      guard += 1;
    }
  }

  private replaceSet(target: Set<string>, source: Set<string>): void {
    target.clear();
    for (const item of source) {
      target.add(item);
    }
  }

  private parseTimestamp(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isMonthKeyImmutable(monthKey: string, todayKey: string): boolean {
    return (
      monthKey < todayKey.slice(0, 7) &&
      !this.activeTimerMutableMonthKeys.has(monthKey)
    );
  }

  private isYearKeyImmutable(yearKey: string, todayKey: string): boolean {
    return (
      yearKey < todayKey.slice(0, 4) &&
      !this.activeTimerMutableYearKeys.has(yearKey)
    );
  }

  private mergeScopeReloadOptions(
    current: ScopeReloadOptions | null,
    incoming?: ScopeReloadOptions
  ): ScopeReloadOptions {
    return {
      scrollNearNow: Boolean(current?.scrollNearNow || incoming?.scrollNearNow),
      scrollRailToToday: Boolean(
        current?.scrollRailToToday || incoming?.scrollRailToToday
      ),
    };
  }

  private async loadDataForCurrentScope(date: Date): Promise<void> {
    if (this.currentView === 'day') {
      await this.ensureDayTasksForDate(date);
      return;
    }

    if (this.currentView === 'month') {
      await this.ensureMonthSummaryForDate(date);
      return;
    }

    await this.ensureYearSummaryForDate(date);
  }

  private async ensureDayTasksForDate(date: Date): Promise<void> {
    const dayTaskLoader = (
      this.taskRepository as Partial<TaskRepository>
    ).listTaskAggregatesForDate;

    if (typeof dayTaskLoader === 'function') {
      const dayTasks = await dayTaskLoader.call(
        this.taskRepository,
        this.dateKey(date)
      );
      if (dayTasks) {
        this.scheduledTasks = dayTasks;
        return;
      }
    }

    this.scheduledTasks = await this.loadDayTasksFallback(date);
  }

  private async loadDayTasksFallback(date: Date): Promise<PersistedTaskAggregate[]> {
    const taskRows = await this.taskRepository.listTasks();
    if (taskRows.length === 0) {
      return [];
    }

    const aggregates = await Promise.all(
      taskRows.map((task) => this.taskRepository.getTaskAggregate(task.id))
    );

    return aggregates.filter(
      (task): task is PersistedTaskAggregate =>
        !!task &&
        task.isActive &&
        !task.isArchived &&
        task.deletedAt === null &&
        (task.scheduleType === 'one_time' || !!task.recurrence) &&
        this.taskOccursOnDate(task, date)
    );
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
    this.cancelScheduledSummaryWarmup();
    this.isLoading = true;
    this.destroyRenderedView();
  }

  private endLoadingOverlay(): void {
    this.isLoading = false;
    this.renderCurrentView();
    this.scheduleDayRenderRecovery();
  }

  private async ensureMonthSummaryForDate(date: Date): Promise<boolean> {
    const monthSummaryLoader = (
      this.taskRepository as Partial<TaskRepository>
    ).listMonthDayCategorySummaries;

    if (typeof monthSummaryLoader !== 'function') {
      return false;
    }

    const monthKey = this.monthSummaryKey(date);
    const immutableMonth = this.isImmutableMonth(date);
    if (
      (immutableMonth && this.monthSummaryCache.has(monthKey)) ||
      this.monthSummaryLoading.has(monthKey)
    ) {
      return true;
    }

    this.monthSummaryLoading.add(monthKey);

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthStart = this.dateKey(this.createDate(year, month, 1));
    const monthEnd = this.dateKey(this.createDate(year, month, this.daysInMonth(year, month)));

    try {
      const persistedSummary = this.persistedMonthSummaryCache.get(monthKey);
      if (immutableMonth && persistedSummary) {
        this.monthSummaryCache.set(monthKey, this.cloneMonthSummaryMap(persistedSummary));
        return true;
      }

      let monthSummary = new Map<string, AgendaMonthDayTaskSummary>();
      if (this.isCurrentMonth(date) && persistedSummary) {
        monthSummary = this.cloneMonthSummaryMap(persistedSummary);
      }

      const todayKey = this.dateKey(this.dateAtLocalNoon(new Date()));
      const isTargetCurrentMonth = todayKey.slice(0, 7) === monthKey;
      if (isTargetCurrentMonth && !immutableMonth) {
        const todayDay = Number(todayKey.slice(8, 10));
        if (todayDay > 1 && monthSummary.size === 0) {
          const previousDay = this.dateKey(this.createDate(year, month, todayDay - 1));
          const pastRows = await monthSummaryLoader.call(
            this.taskRepository,
            monthStart,
            previousDay
          );
          if (pastRows && !this.isDestroyed) {
            const pastSummary = this.mapMonthSummaryRows(pastRows);
            monthSummary = this.mergeMonthSummaryMaps(monthSummary, pastSummary);
            this.persistMonthSummary(monthKey, pastSummary);
          }
        }

        const dynamicRows = await monthSummaryLoader.call(
          this.taskRepository,
          todayKey,
          monthEnd
        );
        if (!dynamicRows || this.isDestroyed) {
          return false;
        }

        const dynamicSummary = this.mapMonthSummaryRows(dynamicRows);
        monthSummary = this.mergeMonthSummaryMaps(monthSummary, dynamicSummary);
        const immutableSlice = this.extractImmutableMonthDays(monthKey, monthSummary);
        if (immutableSlice.size > 0) {
          this.persistMonthSummary(monthKey, immutableSlice);
        }
      } else {
        const rows = await monthSummaryLoader.call(
          this.taskRepository,
          monthStart,
          monthEnd
        );
        if (!rows || this.isDestroyed) {
          return false;
        }

        monthSummary = this.mapMonthSummaryRows(rows);
      }

      if (
        !(await this.ensureCategoryColorsForIds(
          this.collectCategoryIdsFromMonthSummary(monthSummary)
        ))
      ) {
        return false;
      }

      this.monthSummaryCache.set(monthKey, monthSummary);
      if (immutableMonth) {
        this.persistMonthSummary(monthKey, monthSummary);
      }
      this.markSummaryRefreshedToday('month', monthKey);

      if (this.monthSummaryKey(this.selectedDate) === monthKey) {
        this.monthCells = this.buildMonthCells(this.selectedDate);
        if (this.currentView === 'month') {
          this.renderCurrentView();
        }
      }
      return true;
    } catch {
      if (immutableMonth) {
        this.monthSummaryCache.delete(monthKey);
      }
      return false;
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

      mapped.set(dateKey, {
        taskCount: Math.max(0, Math.round(row.taskCount)),
        categoryIds: this.normalizeUniqueCategoryIds(row.categoryIds),
      });
    }

    return mapped;
  }

  private collectCategoryIdsFromMonthSummary(
    summary: ReadonlyMap<string, AgendaMonthDayTaskSummary>
  ): string[] {
    const categoryIds: string[] = [];
    for (const row of summary.values()) {
      categoryIds.push(...row.categoryIds);
    }
    return this.normalizeUniqueCategoryIds(categoryIds);
  }

  private async ensureYearSummaryForDate(date: Date): Promise<boolean> {
    const yearSummaryLoader = (
      this.taskRepository as Partial<TaskRepository>
    ).listYearMonthCategorySummaries;

    if (typeof yearSummaryLoader !== 'function') {
      return false;
    }

    const yearKey = this.yearSummaryKey(date);
    const immutableYear = this.isImmutableYear(date);
    if (
      (immutableYear && this.yearSummaryCache.has(yearKey)) ||
      this.yearSummaryLoading.has(yearKey)
    ) {
      return true;
    }

    this.yearSummaryLoading.add(yearKey);

    const year = date.getFullYear();
    const yearStart = this.dateKey(this.createDate(year, 0, 1));
    const yearEnd = this.dateKey(this.createDate(year, 11, this.daysInMonth(year, 11)));

    try {
      const persistedSummary = this.persistedYearSummaryCache.get(yearKey);
      if (immutableYear && persistedSummary) {
        this.yearSummaryCache.set(yearKey, this.cloneYearSummaryMap(persistedSummary));
        return true;
      }

      let yearSummary = new Map<number, AgendaYearMonthTaskSummary>();
      if (this.isCurrentYear(date) && persistedSummary) {
        yearSummary = this.cloneYearSummaryMap(persistedSummary);
      }

      const currentDate = this.dateAtLocalNoon(new Date());
      const currentYear = currentDate.getFullYear();
      const currentMonthIndex = currentDate.getMonth();
      const shouldSplitCurrentYear =
        !immutableYear &&
        this.isCurrentYear(date) &&
        currentYear === year;

      if (shouldSplitCurrentYear) {
        if (currentMonthIndex > 0 && yearSummary.size === 0) {
          const pastYearEnd = this.dateKey(
            this.createDate(year, currentMonthIndex - 1, this.daysInMonth(year, currentMonthIndex - 1))
          );
          const pastRows = await yearSummaryLoader.call(
            this.taskRepository,
            yearStart,
            pastYearEnd
          );
          if (pastRows && !this.isDestroyed) {
            const pastSummary = this.mapYearSummaryRows(pastRows, year);
            yearSummary = this.mergeYearSummaryMaps(yearSummary, pastSummary);
            this.persistYearSummary(yearKey, pastSummary);
          }
        }

        const dynamicYearStart = this.dateKey(this.createDate(year, currentMonthIndex, 1));
        const dynamicRows = await yearSummaryLoader.call(
          this.taskRepository,
          dynamicYearStart,
          yearEnd
        );
        if (!dynamicRows || this.isDestroyed) {
          return false;
        }

        const dynamicSummary = this.mapYearSummaryRows(dynamicRows, year);
        yearSummary = this.mergeYearSummaryMaps(yearSummary, dynamicSummary);
        const immutableSlice = this.extractImmutableYearMonths(yearSummary);
        if (immutableSlice.size > 0) {
          this.persistYearSummary(yearKey, immutableSlice);
        }
      } else {
        const rows = await yearSummaryLoader.call(
          this.taskRepository,
          yearStart,
          yearEnd
        );
        if (!rows || this.isDestroyed) {
          return false;
        }

        yearSummary = this.mapYearSummaryRows(rows, year);
      }

      if (
        !(await this.ensureCategoryColorsForIds(
          this.collectCategoryIdsFromYearSummary(yearSummary)
        ))
      ) {
        return false;
      }

      this.yearSummaryCache.set(yearKey, yearSummary);
      if (immutableYear) {
        this.persistYearSummary(yearKey, yearSummary);
      }
      this.markSummaryRefreshedToday('year', yearKey);

      if (this.yearSummaryKey(this.selectedDate) === yearKey) {
        this.yearMonths = this.buildYearMonths(this.selectedDate);
        if (this.currentView === 'year') {
          this.renderCurrentView();
        }
      }
      return true;
    } catch {
      if (immutableYear) {
        this.yearSummaryCache.delete(yearKey);
      }
      return false;
    } finally {
      this.yearSummaryLoading.delete(yearKey);
    }
  }

  private mapYearSummaryRows(
    rows: readonly TaskYearMonthCategorySummary[],
    expectedYear: number
  ): Map<number, AgendaYearMonthTaskSummary> {
    const mapped = new Map<number, AgendaYearMonthTaskSummary>();

    for (const row of rows) {
      const parsedMonth = this.parseYearMonthKey(row.monthKey);
      if (!parsedMonth || parsedMonth.year !== expectedYear) {
        continue;
      }

      mapped.set(parsedMonth.monthIndex, {
        taskCount: Math.max(0, Math.round(row.taskCount)),
        categoryIds: this.normalizeUniqueCategoryIds(row.categoryIds),
      });
    }

    return mapped;
  }

  private collectCategoryIdsFromYearSummary(
    summary: ReadonlyMap<number, AgendaYearMonthTaskSummary>
  ): string[] {
    const categoryIds: string[] = [];
    for (const row of summary.values()) {
      categoryIds.push(...row.categoryIds);
    }
    return this.normalizeUniqueCategoryIds(categoryIds);
  }

  private async ensureCategoryColorsForIds(
    categoryIds: readonly string[]
  ): Promise<boolean> {
    const normalizedCategoryIds = this.normalizeUniqueCategoryIds(
      categoryIds.map((categoryId) => categoryId.trim().toLowerCase())
    );
    if (normalizedCategoryIds.length === 0) {
      return true;
    }

    const hasMissingColor = normalizedCategoryIds.some(
      (categoryId) => !this.categoryColorById.has(categoryId)
    );
    if (!hasMissingColor) {
      return true;
    }

    await this.loadCategoryColorMap();

    const unresolvedCategoryIds = normalizedCategoryIds.filter(
      (categoryId) => !this.categoryColorById.has(categoryId)
    );
    if (unresolvedCategoryIds.length > 0) {
      for (const categoryId of unresolvedCategoryIds) {
        this.categoryColorById.set(
          categoryId,
          this.resolveCategoryColorFallback(categoryId)
        );
      }
      this.writePersistedCategoryColorMap();
    }

    return true;
  }

  private parseYearMonthKey(
    monthKey: string
  ): { year: number; monthIndex: number } | null {
    const normalizedMonthKey = monthKey.trim();
    const monthKeyMatch = /^(\d{4})-(\d{2})$/.exec(normalizedMonthKey);
    if (!monthKeyMatch) {
      return null;
    }

    const year = Number(monthKeyMatch[1]);
    const month = Number(monthKeyMatch[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return null;
    }

    return {
      year,
      monthIndex: month - 1,
    };
  }

  private normalizeUniqueColors(colors: readonly string[]): string[] {
    const uniqueColors: string[] = [];
    const seenColors = new Set<string>();
    for (const rawColor of colors) {
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

    return uniqueColors;
  }

  private normalizeUniqueCategoryIds(categoryIds: readonly string[]): string[] {
    const uniqueCategoryIds: string[] = [];
    const seenCategoryIds = new Set<string>();
    for (const rawCategoryId of categoryIds) {
      const categoryId = rawCategoryId.trim();
      if (categoryId.length === 0 || seenCategoryIds.has(categoryId)) {
        continue;
      }

      seenCategoryIds.add(categoryId);
      uniqueCategoryIds.push(categoryId);
    }

    return uniqueCategoryIds;
  }

  private resolveCategoryColorsFromIds(categoryIds: readonly string[]): string[] {
    const resolvedColors: string[] = [];
    const seenColors = new Set<string>();
    for (const categoryId of categoryIds) {
      const normalizedCategoryId = categoryId.trim().toLowerCase();
      let color = this.categoryColorById.get(normalizedCategoryId)?.trim() ?? '';
      if (!color) {
        color = this.resolveCategoryColorFromLoadedTasks(normalizedCategoryId) ?? '';
      }
      if (!color && normalizedCategoryId) {
        color = this.resolveCategoryColorFallback(normalizedCategoryId);
      }
      if (color && normalizedCategoryId) {
        this.categoryColorById.set(normalizedCategoryId, color);
        this.writePersistedCategoryColorMap();
      }
      if (!color) {
        continue;
      }

      const colorKey = color.toLowerCase();
      if (seenColors.has(colorKey)) {
        continue;
      }

      seenColors.add(colorKey);
      resolvedColors.push(color);
    }

    return resolvedColors;
  }

  private resolveCategoryColorFallback(categoryId: string): string {
    let hash = 0;
    for (let index = 0; index < categoryId.length; index += 1) {
      hash = (hash * 31 + categoryId.charCodeAt(index)) >>> 0;
    }

    return CATEGORY_COLOR_FALLBACK_PALETTE[
      hash % CATEGORY_COLOR_FALLBACK_PALETTE.length
    ];
  }

  private resolveCategoryColorFromLoadedTasks(categoryId: string): string | null {
    if (!categoryId) {
      return null;
    }

    for (const task of this.scheduledTasks) {
      const taskCategoryId = task.categoryId?.trim().toLowerCase() ?? '';
      if (!taskCategoryId || taskCategoryId !== categoryId) {
        continue;
      }

      const taskColor = this.resolveTaskColor(task).trim();
      if (taskColor) {
        return taskColor;
      }
    }

    return null;
  }

  private loadPersistedCategoryColorMap(): void {
    try {
      const rawPayload = window.localStorage.getItem(CATEGORY_COLOR_CACHE_STORAGE_KEY);
      if (!rawPayload) {
        return;
      }

      const parsedPayload = JSON.parse(rawPayload) as Record<string, string>;
      const mappedColors = new Map<string, string>();
      for (const [rawCategoryId, rawColor] of Object.entries(parsedPayload)) {
        const categoryId = rawCategoryId.trim().toLowerCase();
        const color = `${rawColor ?? ''}`.trim();
        if (!categoryId || !color) {
          continue;
        }

        mappedColors.set(categoryId, color);
        if (mappedColors.size >= CATEGORY_COLOR_CACHE_MAX_ENTRIES) {
          break;
        }
      }

      if (mappedColors.size > 0) {
        this.categoryColorById = mappedColors;
      }
    } catch {
      // ignore malformed storage payload
    }
  }

  private writePersistedCategoryColorMap(): void {
    try {
      const serializable: Record<string, string> = {};
      let count = 0;
      for (const [categoryId, color] of this.categoryColorById.entries()) {
        const normalizedCategoryId = categoryId.trim().toLowerCase();
        const normalizedColor = color.trim();
        if (!normalizedCategoryId || !normalizedColor) {
          continue;
        }

        serializable[normalizedCategoryId] = normalizedColor;
        count += 1;
        if (count >= CATEGORY_COLOR_CACHE_MAX_ENTRIES) {
          break;
        }
      }

      window.localStorage.setItem(
        CATEGORY_COLOR_CACHE_STORAGE_KEY,
        JSON.stringify(serializable)
      );
    } catch {
      // ignore storage write failures
    }
  }

  private loadPersistedSummaryCaches(): void {
    this.persistedMonthSummaryCache.clear();
    this.persistedYearSummaryCache.clear();

    try {
      const monthRaw = window.localStorage.getItem(MONTH_SUMMARY_CACHE_STORAGE_KEY);
      if (monthRaw) {
        const parsed = JSON.parse(monthRaw) as Record<
          string,
          Record<string, { taskCount: number; categoryIds?: string[] }>
        >;
        for (const [monthKey, monthEntry] of Object.entries(parsed)) {
          const mappedMonth = new Map<string, AgendaMonthDayTaskSummary>();
          for (const [dateKey, summary] of Object.entries(monthEntry ?? {})) {
            if (!Array.isArray(summary.categoryIds)) {
              continue;
            }

            mappedMonth.set(dateKey, {
              taskCount: Math.max(0, Math.round(Number(summary.taskCount) || 0)),
              categoryIds: this.normalizeUniqueCategoryIds(summary.categoryIds),
            });
          }
          if (mappedMonth.size > 0) {
            this.persistedMonthSummaryCache.set(monthKey, mappedMonth);
          }
        }
      }
    } catch {
      this.persistedMonthSummaryCache.clear();
    }

    try {
      const yearRaw = window.localStorage.getItem(YEAR_SUMMARY_CACHE_STORAGE_KEY);
      if (yearRaw) {
        const parsed = JSON.parse(yearRaw) as Record<
          string,
          Record<string, { taskCount: number; categoryIds?: string[] }>
        >;
        for (const [yearKey, yearEntry] of Object.entries(parsed)) {
          const mappedYear = new Map<number, AgendaYearMonthTaskSummary>();
          for (const [monthIndexKey, summary] of Object.entries(yearEntry ?? {})) {
            const monthIndex = Number(monthIndexKey);
            if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
              continue;
            }
            if (!Array.isArray(summary.categoryIds)) {
              continue;
            }

            mappedYear.set(monthIndex, {
              taskCount: Math.max(0, Math.round(Number(summary.taskCount) || 0)),
              categoryIds: this.normalizeUniqueCategoryIds(summary.categoryIds),
            });
          }
          if (mappedYear.size > 0) {
            this.persistedYearSummaryCache.set(yearKey, mappedYear);
          }
        }
      }
    } catch {
      this.persistedYearSummaryCache.clear();
    }
  }

  private persistMonthSummary(
    monthKey: string,
    monthSummary: ReadonlyMap<string, AgendaMonthDayTaskSummary>
  ): void {
    if (monthSummary.size === 0) {
      return;
    }

    const existing = this.persistedMonthSummaryCache.get(monthKey);
    const merged = existing
      ? this.mergeMonthSummaryMaps(existing, monthSummary)
      : this.cloneMonthSummaryMap(monthSummary);
    this.persistedMonthSummaryCache.set(monthKey, merged);
    this.writePersistedMonthSummaryCache();
  }

  private persistYearSummary(
    yearKey: string,
    yearSummary: ReadonlyMap<number, AgendaYearMonthTaskSummary>
  ): void {
    if (yearSummary.size === 0) {
      return;
    }

    const existing = this.persistedYearSummaryCache.get(yearKey);
    const merged = existing
      ? this.mergeYearSummaryMaps(existing, yearSummary)
      : this.cloneYearSummaryMap(yearSummary);
    this.persistedYearSummaryCache.set(yearKey, merged);
    this.writePersistedYearSummaryCache();
  }

  private writePersistedMonthSummaryCache(): void {
    try {
      const serializable: Record<
        string,
        Record<string, { taskCount: number; categoryIds: string[] }>
      > = {};
      for (const [monthKey, monthSummary] of this.persistedMonthSummaryCache.entries()) {
        serializable[monthKey] = {};
        for (const [dateKey, summary] of monthSummary.entries()) {
          serializable[monthKey][dateKey] = {
            taskCount: summary.taskCount,
            categoryIds: [...summary.categoryIds],
          };
        }
      }

      window.localStorage.setItem(
        MONTH_SUMMARY_CACHE_STORAGE_KEY,
        JSON.stringify(serializable)
      );
    } catch {
      // ignore storage write failures
    }
  }

  private writePersistedYearSummaryCache(): void {
    try {
      const serializable: Record<
        string,
        Record<string, { taskCount: number; categoryIds: string[] }>
      > = {};
      for (const [yearKey, yearSummary] of this.persistedYearSummaryCache.entries()) {
        serializable[yearKey] = {};
        for (const [monthIndex, summary] of yearSummary.entries()) {
          serializable[yearKey][`${monthIndex}`] = {
            taskCount: summary.taskCount,
            categoryIds: [...summary.categoryIds],
          };
        }
      }

      window.localStorage.setItem(
        YEAR_SUMMARY_CACHE_STORAGE_KEY,
        JSON.stringify(serializable)
      );
    } catch {
      // ignore storage write failures
    }
  }

  private mergeMonthSummaryMaps(
    base: ReadonlyMap<string, AgendaMonthDayTaskSummary>,
    patch: ReadonlyMap<string, AgendaMonthDayTaskSummary>
  ): Map<string, AgendaMonthDayTaskSummary> {
    const merged = this.cloneMonthSummaryMap(base);
    for (const [dateKey, summary] of patch.entries()) {
      merged.set(dateKey, {
        taskCount: summary.taskCount,
        categoryIds: [...summary.categoryIds],
      });
    }

    return merged;
  }

  private mergeYearSummaryMaps(
    base: ReadonlyMap<number, AgendaYearMonthTaskSummary>,
    patch: ReadonlyMap<number, AgendaYearMonthTaskSummary>
  ): Map<number, AgendaYearMonthTaskSummary> {
    const merged = this.cloneYearSummaryMap(base);
    for (const [monthIndex, summary] of patch.entries()) {
      merged.set(monthIndex, {
        taskCount: summary.taskCount,
        categoryIds: [...summary.categoryIds],
      });
    }

    return merged;
  }

  private cloneMonthSummaryMap(
    source: ReadonlyMap<string, AgendaMonthDayTaskSummary>
  ): Map<string, AgendaMonthDayTaskSummary> {
    const cloned = new Map<string, AgendaMonthDayTaskSummary>();
    for (const [dateKey, summary] of source.entries()) {
      cloned.set(dateKey, {
        taskCount: summary.taskCount,
        categoryIds: [...summary.categoryIds],
      });
    }

    return cloned;
  }

  private cloneYearSummaryMap(
    source: ReadonlyMap<number, AgendaYearMonthTaskSummary>
  ): Map<number, AgendaYearMonthTaskSummary> {
    const cloned = new Map<number, AgendaYearMonthTaskSummary>();
    for (const [monthIndex, summary] of source.entries()) {
      cloned.set(monthIndex, {
        taskCount: summary.taskCount,
        categoryIds: [...summary.categoryIds],
      });
    }

    return cloned;
  }

  private extractImmutableMonthDays(
    monthKey: string,
    monthSummary: ReadonlyMap<string, AgendaMonthDayTaskSummary>
  ): Map<string, AgendaMonthDayTaskSummary> {
    const immutableDays = new Map<string, AgendaMonthDayTaskSummary>();
    const todayKey = this.dateKey(this.dateAtLocalNoon(new Date()));
    if (todayKey.slice(0, 7) !== monthKey) {
      return immutableDays;
    }

    for (const [dateKey, summary] of monthSummary.entries()) {
      if (dateKey >= todayKey) {
        continue;
      }
      if (this.activeTimerMutableDateKeys.has(dateKey)) {
        continue;
      }

      immutableDays.set(dateKey, {
        taskCount: summary.taskCount,
        categoryIds: [...summary.categoryIds],
      });
    }

    return immutableDays;
  }

  private extractImmutableYearMonths(
    yearSummary: ReadonlyMap<number, AgendaYearMonthTaskSummary>
  ): Map<number, AgendaYearMonthTaskSummary> {
    const immutableMonths = new Map<number, AgendaYearMonthTaskSummary>();
    const now = this.dateAtLocalNoon(new Date());
    const currentMonthIndex = now.getMonth();
    const currentYear = now.getFullYear();
    for (const [monthIndex, summary] of yearSummary.entries()) {
      if (monthIndex >= currentMonthIndex) {
        continue;
      }
      const monthDate = this.createDate(currentYear, monthIndex, 1);
      const monthKey = this.monthSummaryKey(monthDate);
      if (this.activeTimerMutableMonthKeys.has(monthKey)) {
        continue;
      }

      immutableMonths.set(monthIndex, {
        taskCount: summary.taskCount,
        categoryIds: [...summary.categoryIds],
      });
    }

    return immutableMonths;
  }

  private isCurrentMonth(date: Date): boolean {
    const today = this.dateAtLocalNoon(new Date());
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth()
    );
  }

  private isImmutableMonth(date: Date): boolean {
    const todayKey = this.dateKey(this.dateAtLocalNoon(new Date()));
    return this.isMonthKeyImmutable(this.monthSummaryKey(date), todayKey);
  }

  private isCurrentYear(date: Date): boolean {
    return date.getFullYear() === this.dateAtLocalNoon(new Date()).getFullYear();
  }

  private isImmutableYear(date: Date): boolean {
    const todayKey = this.dateKey(this.dateAtLocalNoon(new Date()));
    return this.isYearKeyImmutable(this.yearSummaryKey(date), todayKey);
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
      const mutableScopeChanged = this.refreshActiveTimerMutableScopes(this.now);
      if (mutableScopeChanged) {
        void this.reloadCurrentScopeWithLoader();
        return;
      }

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
          timeLabel: segment.type === 'empty' ? null : segment.displayTimeLabel,
          durationLabel: segment.displayDurationLabel,
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
    return createEmptySegment(startMinutes, endMinutes, nowMinutes, {
      emptyHint: this.resolveEmptySegmentHint(),
      formatMinutes: (minutes) => this.formatMinutes(minutes),
      formatTimelineBoundaryMinutes: (minutes) =>
        this.formatTimelineBoundaryMinutes(minutes),
      formatDuration: (minutes) => this.formatDurationLabel(minutes),
    });
  }

  private createEventSegment(
    tasks: readonly AgendaTimelineTask[],
    startMinutes: number,
    endMinutes: number,
    nowMinutes: number | null
  ): AgendaDaySegment {
    return createEventSegment(tasks, startMinutes, endMinutes, nowMinutes, {
      emptyHint: this.resolveEmptySegmentHint(),
      formatMinutes: (minutes) => this.formatMinutes(minutes),
      formatTimelineBoundaryMinutes: (minutes) =>
        this.formatTimelineBoundaryMinutes(minutes),
      formatDuration: (minutes) => this.formatDurationLabel(minutes),
    });
  }

  private formatDurationLabel(durationMinutes: number): string | null {
    const safeMinutes = Math.max(0, Math.floor(durationMinutes));
    if (safeMinutes <= 0) {
      return null;
    }

    const hourShort =
      this.translate.instant('TODAY.OPPORTUNITIES.HOUR_SHORT') || 'h';
    const minuteShort = this.translate.instant('TASK_DETAIL.MINUTES_SHORT');
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;

    if (hours === 0) {
      return `${minutes} ${minuteShort}`;
    }

    if (minutes === 0) {
      return `${hours} ${hourShort}`;
    }

    return `${hours} ${hourShort} ${minutes} ${minuteShort}`;
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
    const cachedYearSummary = this.yearSummaryCache.get(this.yearSummaryKey(date));

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthDate = this.createDate(year, monthIndex, 1);
      const cachedMonthSummary = cachedYearSummary?.get(monthIndex);
      return {
        key: `${year}-${monthIndex + 1}`,
        monthIndex,
        monthLabel: new Intl.DateTimeFormat(this.activeLocale, {
          month: 'long',
        }).format(monthDate),
        densityLevel: this.toDensityLevel(cachedMonthSummary?.taskCount ?? 0),
        categoryBarGradient: this.buildCategoryBarGradient(
          cachedMonthSummary
            ? this.resolveCategoryColorsFromIds(cachedMonthSummary.categoryIds)
            : []
        ),
        isCurrentMonth:
          today.getFullYear() === year && today.getMonth() === monthIndex,
        isSelectedMonth:
          this.selectedDate.getFullYear() === year &&
          this.selectedDate.getMonth() === monthIndex,
      };
    });
  }

  private buildCategoryBarGradient(categoryBarColors: readonly string[]): string | null {
    const uniqueColors = this.normalizeUniqueColors(categoryBarColors);
    if (uniqueColors.length === 0) {
      return null;
    }

    if (uniqueColors.length === 1) {
      return uniqueColors[0];
    }

    const stopWidth = 100 / uniqueColors.length;
    const gradientStops = uniqueColors
      .map((color, index) => {
        const start = (index * stopWidth).toFixed(2);
        const end = ((index + 1) * stopWidth).toFixed(2);
        return `${color} ${start}%, ${color} ${end}%`;
      })
      .join(', ');

    return `linear-gradient(90deg, ${gradientStops})`;
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
          categoryDotColors: this.resolveCategoryColorsFromIds(
            cachedSummary.categoryIds
          ),
        };
      }

      return {
        taskCount: 0,
        categoryDotColors: [],
      };
    }
    return {
      taskCount: 0,
      categoryDotColors: [],
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

    if (
      recurrence.pattern === 'selected_weekdays' ||
      (recurrence.pattern === 'daily' && !recurrence.sameTimeForSelectedDays)
    ) {
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
    if (
      recurrence?.pattern === 'selected_weekdays' ||
      (recurrence?.pattern === 'daily' && !recurrence.sameTimeForSelectedDays)
    ) {
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

  private yearSummaryKey(date: Date): string {
    return `${date.getFullYear()}`;
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
        offsets: [15],
        soundName: null,
        ttsText: null,
        repeatIfMissed: false,
      },
    };
  }
}
