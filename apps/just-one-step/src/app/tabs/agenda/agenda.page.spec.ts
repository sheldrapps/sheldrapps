import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { AgendaPage } from './agenda.page';
import {
  PersistedTaskAggregate,
  TaskRepository,
} from '../../database/repositories/task.repository';
import { Router } from '@angular/router';
import { of } from 'rxjs';

function buildTask(overrides: Partial<PersistedTaskAggregate>): PersistedTaskAggregate {
  const nowIso = '2026-03-20T09:00:00.000Z';
  const scheduleType = overrides.scheduleType ?? 'recurring';
  const recurrenceValue =
    overrides.recurrence !== undefined
      ? overrides.recurrence
      : scheduleType === 'recurring'
        ? {
            pattern: 'daily' as const,
            hasTime: true,
            sameTimeForSelectedDays: true,
            commonTime: '09:00',
            startsToday: true,
            startDate: '2026-03-01T09:00:00.000Z',
            hasEndDate: false,
            endDate: null,
            dayOfMonth: null,
            yearMonth: null,
            yearDay: null,
            timezone: null,
            weekdays: [],
          }
        : undefined;

  return {
    id: overrides.id ?? 'task-default',
    title: overrides.title ?? 'Task',
    description: overrides.description ?? null,
    trackingMode: overrides.trackingMode ?? 'check',
    priority: overrides.priority ?? 'B',
    scheduleType,
    durationMode: overrides.durationMode ?? 'single',
    oneTimeDate: overrides.oneTimeDate ?? null,
    oneTimeTime: overrides.oneTimeTime ?? null,
    estimatedDurationMin:
      overrides.estimatedDurationMin === undefined
        ? null
        : overrides.estimatedDurationMin,
    categoryId: overrides.categoryId ?? null,
    categoryName: overrides.categoryName ?? null,
    categoryColor: overrides.categoryColor ?? '#64748B',
    isActive: overrides.isActive ?? true,
    isArchived: overrides.isArchived ?? false,
    deletedAt: overrides.deletedAt ?? null,
    recurrenceEnabled: overrides.recurrenceEnabled ?? scheduleType === 'recurring',
    notificationsEnabled: overrides.notificationsEnabled ?? false,
    createdAt: overrides.createdAt ?? nowIso,
    updatedAt: overrides.updatedAt ?? nowIso,
    recurrence: recurrenceValue,
    notification: overrides.notification,
  };
}

describe('AgendaPage day verification', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AgendaPage>>;
  let component: AgendaPage;

  beforeEach(async () => {
    const taskRepositoryMock: Pick<TaskRepository, 'listTasks' | 'getTaskAggregate'> = {
      listTasks: jasmine.createSpy('listTasks').and.resolveTo([]),
      getTaskAggregate: jasmine
        .createSpy('getTaskAggregate')
        .and.resolveTo(null),
    };

    const routerMock: Pick<Router, 'navigate'> = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    const translateMock: Partial<TranslateService> = {
      instant: (key: string) => {
        if (key === 'TASK_DETAIL.MINUTES_SHORT') {
          return 'min';
        }

        return key;
      },
      get: (key: string | string[]) => of(key),
      stream: (key: string | string[]) => of(key),
      getStreamOnTranslationChange: (key: string | string[]) => of(key),
      currentLang: 'es-MX',
      getDefaultLang: () => 'es-MX',
      onTranslationChange: of({ lang: 'es-MX', translations: {} }),
      onLangChange: of({ lang: 'es-MX', translations: {} }),
      onDefaultLangChange: of({ lang: 'es-MX', translations: {} }),
      onFallbackLangChange: of({ lang: 'es-MX', translations: {} }),
    };

    await TestBed.configureTestingModule({
      imports: [AgendaPage],
      providers: [
        { provide: TaskRepository, useValue: taskRepositoryMock },
        { provide: Router, useValue: routerMock },
        { provide: TranslateService, useValue: translateMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgendaPage);
    component = fixture.componentInstance;
  });

  function renderDay(tasks: PersistedTaskAggregate[], date: Date): void {
    component.scheduledTasks = tasks;
    component.selectedDate = date;
    (component as unknown as { refreshViewModels: () => void }).refreshViewModels();
    fixture.detectChanges();
  }

  function timelineCardText(): string {
    const card = fixture.nativeElement.querySelector('.agenda-task-block') as HTMLElement | null;
    return card?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function fullAgendaText(): string {
    return fixture.nativeElement.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function timelineColumnText(): string {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.agenda-segment-time sh-time-display')
    ) as HTMLElement[];
    return labels
      .map((label) => label.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((label) => label.length > 0)
      .join(' ');
  }

  function boundaryLabels(): string[] {
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.agenda-day-timeline__boundary-row .agenda-day-timeline__time sh-time-display'
      )
    ) as HTMLElement[];

    return labels
      .map((label) => label.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((label) => label.length > 0);
  }

  it('keeps monthly check with time as point event on 2026-03-28', () => {
    const monthlyCheck = buildTask({
      id: 'task-monthly-check-2111',
      title: 'Task mensual check 21:11',
      trackingMode: 'check',
      estimatedDurationMin: null,
      recurrence: {
        pattern: 'monthly',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '21:11',
        startsToday: true,
        startDate: '2026-03-28T00:00:00.000Z',
        hasEndDate: true,
        endDate: '2026-04-28T00:00:00.000Z',
        dayOfMonth: 28,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([monthlyCheck], new Date(2026, 2, 28, 12, 0, 0, 0));

    const timelineEvent = component.daySegments.find(
      (segment) => segment.type === 'event' && segment.task?.taskId === monthlyCheck.id
    );

    expect(timelineEvent).toBeDefined();
    expect(timelineEvent?.startMinutes).toBe(1271);
    expect(timelineEvent?.endMinutes).toBe(1271);
    expect(component.dayUntimedTasks.some((task) => task.taskId === monthlyCheck.id)).toBeFalse();
    expect(component.dayOpenMessageVisible).toBeFalse();
  });

  it('does not show day-open state when there is at least one applicable task', () => {
    const timedDuration = buildTask({
      id: 'task-duration-27',
      title: 'Task con duracion',
      trackingMode: 'duration',
      estimatedDurationMin: 45,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '10:00',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([timedDuration], new Date(2026, 2, 27, 12, 0, 0, 0));

    expect(component.daySegments.some((segment) => segment.type === 'event')).toBeTrue();
    expect(component.dayUntimedTasks.length).toBe(0);
    expect(component.dayOpenMessageVisible).toBeFalse();
  });

  it('renders one-time timed task as timeline event on its date', () => {
    const oneTimeTimed = buildTask({
      id: 'task-one-time-timed',
      title: 'Cita medica',
      scheduleType: 'one_time',
      recurrenceEnabled: false,
      recurrence: undefined,
      oneTimeDate: '2026-03-28T12:00:00.000Z',
      oneTimeTime: '16:00',
      trackingMode: 'duration',
      estimatedDurationMin: 45,
    });

    renderDay([oneTimeTimed], new Date(2026, 2, 28, 12, 0, 0, 0));

    expect(
      component.daySegments.some(
        (segment) => segment.type === 'event' && segment.items?.some((item) => item.taskId === oneTimeTimed.id)
      )
    ).toBeTrue();
    expect(component.dayUntimedTasks.some((task) => task.taskId === oneTimeTimed.id)).toBeFalse();
  });

  it('maps task priority into timeline task VM without affecting tier logic yet', () => {
    const priorityTask = buildTask({
      id: 'task-priority-vm',
      title: 'Prioridad S',
      priority: 'S',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([priorityTask], new Date(2026, 2, 29, 12, 0, 0, 0));

    const eventSegment = component.daySegments.find((segment) => segment.type === 'event');
    expect(eventSegment?.task?.priority).toBe('S');
    expect(eventSegment?.visualHeightPx).toBe(32);
  });

  it('renders one-time task without hour in untimed section on its date', () => {
    const oneTimeUntimed = buildTask({
      id: 'task-one-time-untimed',
      title: 'Lavar coche',
      scheduleType: 'one_time',
      recurrenceEnabled: false,
      recurrence: undefined,
      oneTimeDate: '2026-03-28T12:00:00.000Z',
      oneTimeTime: null,
      trackingMode: 'check',
    });

    renderDay([oneTimeUntimed], new Date(2026, 2, 28, 12, 0, 0, 0));

    expect(component.dayUntimedTasks.some((task) => task.taskId === oneTimeUntimed.id)).toBeTrue();
  });

  it('degrades overlap rendering to +N when 4 tasks share the same interval', () => {
    const baseDate = '2026-03-28T12:00:00.000Z';
    const tasks = [1, 2, 3, 4].map((index) =>
      buildTask({
        id: `task-overlap-${index}`,
        title: `Overlap ${index}`,
        trackingMode: 'duration',
        estimatedDurationMin: 30,
        recurrence: {
          pattern: 'daily',
          hasTime: true,
          sameTimeForSelectedDays: true,
          commonTime: '09:00',
          startsToday: true,
          startDate: baseDate,
          hasEndDate: false,
          endDate: null,
          dayOfMonth: null,
          yearMonth: null,
          yearDay: null,
          timezone: null,
          weekdays: [],
        },
      })
    );

    renderDay(tasks, new Date(2026, 2, 28, 12, 0, 0, 0));

    const overflow = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__overflow'
    ) as HTMLElement | null;

    expect(overflow).not.toBeNull();
    expect(overflow?.textContent?.replace(/\s+/g, ' ').trim()).toContain('+2');
  });
  
  it('monthly check without time appears as day task', () => {
    const noTimeTask = buildTask({
      id: 'task-no-time',
      title: 'Uma tarefina',
      trackingMode: 'check',
      estimatedDurationMin: null,
      recurrence: {
        pattern: 'monthly',
        hasTime: false,
        sameTimeForSelectedDays: true,
        commonTime: null,
        startsToday: false,
        startDate: '2026-03-28T00:00:00.000Z',
        hasEndDate: true,
        endDate: '2026-04-28T00:00:00.000Z',
        dayOfMonth: 28,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([noTimeTask], new Date(2026, 2, 28, 12, 0, 0, 0));

    expect(component.dayUntimedTasks.some((task) => task.taskId === noTimeTask.id)).toBeTrue();
    expect(component.daySegments.length).toBe(0);
    expect(component.daySegments.find((segment) => segment.type === 'event' && segment.task?.taskId === noTimeTask.id)).toBeUndefined();
    expect(component.dayOpenMessageVisible).toBeFalse();
  });

  it('interval event card shows only title and no secondary details', () => {
    const task = buildTask({
      id: 'task-interval-chaqueton',
      title: 'Chaquetón',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const cardText = timelineCardText();
    expect(cardText).toContain('Chaquetón');
    expect(cardText).not.toContain('15 min');
    expect(cardText).not.toContain('12:15');
    expect(cardText).not.toContain('12:30');
    expect(cardText).not.toContain('-');
  });

  it('renders strict temporal sequence for 12:15-12:30 event block', () => {
    const task = buildTask({
      id: 'task-strict-sequence',
      title: 'Chaquetón',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    expect(component.daySegments.length).toBe(3);
    expect(component.daySegments[0].type).toBe('empty');
    expect(component.daySegments[0].startMinutes).toBe(0);
    expect(component.daySegments[0].endMinutes).toBe(12 * 60 + 15);
    expect(component.daySegments[1].type).toBe('event');
    expect(component.daySegments[1].startMinutes).toBe(12 * 60 + 15);
    expect(component.daySegments[1].endMinutes).toBe(12 * 60 + 30);
    expect(component.daySegments[1].visualHeightPx).toBe(32);
    expect(component.daySegments[2].type).toBe('empty');
    expect(component.daySegments[2].startMinutes).toBe(12 * 60 + 30);
    expect(component.daySegments[2].endMinutes).toBe(24 * 60);

    const eventCard = fixture.nativeElement.querySelector('.agenda-task-block') as HTMLElement | null;
    expect(eventCard).not.toBeNull();
    expect(eventCard?.style.top).toBe('');
    expect(eventCard?.style.height).toBe('');

    const renderedText = fullAgendaText();
    const startIndex = renderedText.indexOf('12:15');
    const titleIndex = renderedText.indexOf(task.title);
    const endIndex = renderedText.indexOf('12:30');
    expect(startIndex).toBeGreaterThan(-1);
    expect(titleIndex).toBeGreaterThan(startIndex);
    expect(endIndex).toBeGreaterThan(titleIndex);
  });

  it('builds unique day boundaries for empty-event-empty sequence', () => {
    const task = buildTask({
      id: 'task-middle-slot-bounds',
      title: 'Chaqueton',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        commonDurationMin: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const labels = boundaryLabels();
    const bodyRows = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__body-row'
    );

    expect(labels).toEqual(['00:00', '12:15', '12:30', '23:59']);
    expect(bodyRows.length).toBe(3);
  });

  it('keeps first visible boundary at 00:00 without duplicate shared labels', () => {
    const task = buildTask({
      id: 'task-first-top-only',
      title: 'Chaqueton',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const labels = boundaryLabels();
    expect(labels[0]).toBe('00:00');
    expect(labels.filter((label) => label === '12:15').length).toBe(1);
  });

  it('keeps last visible boundary at 23:59 without duplicate trailing labels', () => {
    const task = buildTask({
      id: 'task-last-bottom-only',
      title: 'Chaqueton',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const labels = boundaryLabels();
    expect(labels[labels.length - 1]).toBe('23:59');
    expect(labels.filter((label) => label === '12:30').length).toBe(1);
  });

  it('single empty day still shows both boundaries', () => {
    renderDay([], new Date(2026, 2, 29, 12, 0, 0, 0));
    const labels = boundaryLabels();
    expect(component.daySegments.length).toBe(1);
    expect(labels).toEqual(['00:00', '23:59']);
  });

  it('keeps unique shared boundaries for consecutive events in the same day grid', () => {
    const first = buildTask({
      id: 'task-consecutive-a',
      title: 'Evento A',
      trackingMode: 'duration',
      estimatedDurationMin: 30,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '09:00',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });
    const second = buildTask({
      id: 'task-consecutive-b',
      title: 'Evento B',
      trackingMode: 'duration',
      estimatedDurationMin: 30,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '09:30',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([first, second], new Date(2026, 2, 29, 9, 0, 0, 0));

    const labels = boundaryLabels();
    expect(labels.filter((label) => label === '09:30').length).toBe(1);
    expect(labels).toContain('09:00');
    expect(labels).toContain('10:00');
  });

  it('point event card never shows time text', () => {
    const task = buildTask({
      id: 'task-point-agua',
      title: 'Tomar agua',
      trackingMode: 'check',
      estimatedDurationMin: null,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const cardText = timelineCardText();
    expect(cardText).toContain('Tomar agua');
    expect(cardText).not.toMatch(/\b\d{2}:\d{2}\b/);
  });

  it('regression guard: keeps empty-event-empty flow and untimed section separated', () => {
    const timedTask = buildTask({
      id: 'task-flow-timed',
      title: 'ChaquetÃ³n',
      description: 'Descripcion que no debe verse',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    const untimedTask = buildTask({
      id: 'task-flow-untimed',
      title: 'Uma tarefina',
      trackingMode: 'check',
      estimatedDurationMin: null,
      recurrence: {
        pattern: 'daily',
        hasTime: false,
        sameTimeForSelectedDays: true,
        commonTime: null,
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([timedTask, untimedTask], new Date(2026, 2, 29, 12, 0, 0, 0));

    expect(component.daySegments.length).toBe(3);
    expect(component.daySegments[0].type).toBe('empty');
    expect(component.daySegments[1].type).toBe('event');
    expect(component.daySegments[2].type).toBe('empty');

    const timeline = fixture.nativeElement.querySelector('.agenda-timeline') as HTMLElement | null;
    const untimedSection = fixture.nativeElement.querySelector('.agenda-untimed-section') as HTMLElement | null;
    expect(timeline).not.toBeNull();
    expect(untimedSection).not.toBeNull();
    const relation = (timeline as HTMLElement).compareDocumentPosition(untimedSection as Node);
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const emptyBodies = fixture.nativeElement.querySelectorAll('.agenda-empty-body');
    expect(emptyBodies.length).toBe(2);
    expect(emptyBodies[0].querySelector('.agenda-empty-microcopy')).not.toBeNull();

    const timedCardText = timelineCardText();
    expect(timedCardText).toContain('ChaquetÃ³n');
    expect(timedCardText).not.toContain('15 min');
    expect(timedCardText).not.toContain('Descripcion que no debe verse');
  });

  it('anchors short event card to its segment body without detached wrappers', () => {
    const task = buildTask({
      id: 'task-anchor-1215',
      title: 'Chaquetón',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const eventRow = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body-row--event'
    ) as HTMLElement | null;
    const eventBody = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body-row--event .agenda-event-body'
    ) as HTMLElement | null;
    const eventContent = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body-row--event .agenda-day-timeline__content'
    ) as HTMLElement | null;
    const eventGrid = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body-row--event .agenda-day-timeline__event-grid'
    ) as HTMLElement | null;

    expect(eventRow).not.toBeNull();
    expect(eventBody).not.toBeNull();
    expect(eventContent).not.toBeNull();
    expect(eventGrid).not.toBeNull();
    expect(eventContent?.firstElementChild).toBe(eventGrid);
    expect(eventGrid?.querySelector('.agenda-event-body')).toBe(eventBody);
    expect(eventBody?.classList.contains('agenda-task-block')).toBeTrue();
    const eventStyle = eventBody?.getAttribute('style') ?? '';
    expect(eventStyle.includes('--app-accent-border-color')).toBeTrue();
    const borderLeftWidth = Number.parseFloat(
      window.getComputedStyle(eventBody as HTMLElement).borderLeftWidth || '0'
    );
    expect(borderLeftWidth).toBeGreaterThanOrEqual(3);
  });

  it('uses sh-day-agenda-timeline as the only timeline renderer for day view', () => {
    const task = buildTask({
      id: 'task-renderer-single',
      title: 'Renderer check',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    expect(fixture.nativeElement.querySelector('sh-day-agenda-timeline')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('sh-agenda-slot')).toBeNull();
  });

  it('renders sh-day-agenda-timeline with boundary rulers and body dividers without cross joints', () => {
    const task = buildTask({
      id: 'task-divider-1215',
      title: 'Chaqueton',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const timeline = fixture.nativeElement.querySelector('sh-day-agenda-timeline');
    const boundaryLines = fixture.nativeElement.querySelectorAll(
      'sh-day-agenda-timeline .agenda-day-timeline__boundary-line'
    );
    const dividers = fixture.nativeElement.querySelectorAll(
      'sh-day-agenda-timeline .agenda-day-timeline__divider-line'
    );
    const joints = fixture.nativeElement.querySelectorAll(
      'sh-day-agenda-timeline .agenda-day-timeline__joint'
    );

    expect(timeline).not.toBeNull();
    expect(boundaryLines.length).toBe(4);
    expect(dividers.length).toBe(component.daySegments.length);
    expect(joints.length).toBe(0);
    expect(component.daySegments.length).toBe(3);
    expect(component.daySegments[0].type).toBe('empty');
    expect(component.daySegments[1].type).toBe('event');
    expect(component.daySegments[2].type).toBe('empty');
    expect(fixture.nativeElement.querySelector('sh-agenda-slot')).toBeNull();
  });

  it('shows unique boundaries 00:00 -> 12:15 -> 12:30 -> 23:59 without duplicates', () => {
    const task = buildTask({
      id: 'task-unique-boundaries',
      title: 'ChaquetÃ³n',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const text = fullAgendaText();
    expect((text.match(/00:00/g) ?? []).length).toBe(1);
    expect((text.match(/12:15/g) ?? []).length).toBe(1);
    expect((text.match(/12:30/g) ?? []).length).toBe(1);
    expect((text.match(/23:59/g) ?? []).length).toBe(1);
  });

  it('all empty segments use the same standardized free-time hint', () => {
    const task = buildTask({
      id: 'task-empty-hint-standardized',
      title: 'Evento mediodia',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const emptySegments = component.daySegments.filter(
      (segment) => segment.type === 'empty'
    );
    expect(emptySegments.length).toBe(2);
    expect(emptySegments.every((segment) => segment.displayHint === 'AGENDA.EMPTY_HINT_FREE_TIME')).toBeTrue();

    const hintNodes = Array.from(
      fixture.nativeElement.querySelectorAll('.agenda-empty-microcopy')
    ) as HTMLElement[];
    const hintTexts = hintNodes
      .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((text) => text.length > 0);

    expect(hintTexts.length).toBe(2);
    expect(new Set(hintTexts).size).toBe(1);
    expect(hintTexts[0]).toBe('AGENDA.EMPTY_HINT_FREE_TIME');
  });

  it('does not use legacy empty hint variants in day timeline', () => {
    const task = buildTask({
      id: 'task-empty-hint-no-variants',
      title: 'Evento tarde',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '18:30',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const renderedText = fullAgendaText();
    expect(renderedText).not.toContain('AGENDA.EMPTY_HINT_NO_RUSH');
    expect(renderedText).not.toContain('AGENDA.EMPTY_HINT_GOOD_START');
  });

  it('renders fully empty day as one compact empty segment with 00:00 and 23:59', () => {
    renderDay([], new Date(2026, 2, 29, 12, 0, 0, 0));

    expect(component.daySegments.length).toBe(1);
    expect(component.daySegments[0].type).toBe('empty');
    expect(component.daySegments[0].heightTier).toBe('empty-lg');
    expect(component.daySegments[0].visualHeightPx).toBe(48);
    expect(component.daySegments[0].timeTopLabel).toBe('00:00');
    expect(component.daySegments[0].timeBottomLabel).toBe('23:59');

    const text = fullAgendaText();
    expect(text).toContain('00:00');
    expect(text).toContain('23:59');
    const emptyBody = fixture.nativeElement.querySelector('.agenda-empty-body') as HTMLElement | null;
    expect(emptyBody).not.toBeNull();
    expect(emptyBody?.querySelector('.agenda-empty-microcopy')).not.toBeNull();
  });

  it('renders only events without unnecessary empty segments', () => {
    const fullDayEvent = buildTask({
      id: 'task-only-events-full-day',
      title: 'Evento todo el dÃ­a',
      trackingMode: 'duration',
      estimatedDurationMin: 1440,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '00:00',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([fullDayEvent], new Date(2026, 2, 29, 12, 0, 0, 0));

    expect(component.daySegments.length).toBe(1);
    expect(component.daySegments[0].type).toBe('event');
    expect(component.daySegments.some((segment) => segment.type === 'empty')).toBeFalse();
  });

  it('keeps empty segments compact and uses slot tiers for heights', () => {
    const task = buildTask({
      id: 'task-empty-compact-regression',
      title: 'Evento breve',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    expect(component.daySegments.length).toBe(3);
    expect(component.daySegments[0].type).toBe('empty');
    expect(component.daySegments[1].type).toBe('event');
    expect(component.daySegments[2].type).toBe('empty');
    expect(component.daySegments[0].heightTier).toBe('empty-lg');
    expect(component.daySegments[1].heightTier).toBe('event-sm');
    expect(component.daySegments[2].heightTier).toBe('empty-lg');
    expect(component.daySegments[0].visualHeightPx).toBe(48);
    expect(component.daySegments[1].visualHeightPx).toBe(32);
    expect(component.daySegments[2].visualHeightPx).toBe(48);
  });

  it('day task card keeps title and does not render any time format', () => {
    const task = buildTask({
      id: 'task-day-libre',
      title: 'Planear semana',
      trackingMode: 'check',
      estimatedDurationMin: null,
      recurrence: {
        pattern: 'daily',
        hasTime: false,
        sameTimeForSelectedDays: true,
        commonTime: null,
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const untimedCard = fixture.nativeElement.querySelector('.agenda-untimed-item') as HTMLElement | null;
    const untimedText = untimedCard?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(untimedText).toContain('Planear semana');
    expect(untimedText).not.toMatch(/\b\d{2}:\d{2}\b/);
  });

  it('left timeline column keeps time labels for interval events', () => {
    const task = buildTask({
      id: 'task-interval-column',
      title: 'Chaquetón',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const columnText = timelineColumnText();
    expect(columnText).toContain('12:15');
    expect(fullAgendaText()).toContain('12:30');
  });

  it('renders each timestamp once in timeline and never duplicates in card', () => {
    const task = buildTask({
      id: 'task-interval-once',
      title: 'Chaquetón',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const cardText = timelineCardText();
    const fullText = fullAgendaText();
    const count1215 = (fullText.match(/12:15/g) ?? []).length;
    const count1230 = (fullText.match(/12:30/g) ?? []).length;

    expect(count1215).toBe(1);
    expect(count1230).toBe(1);
    expect(cardText).not.toContain('12:15');
    expect(cardText).not.toContain('12:30');
  });

  it('regression guard: never renders "12:15 - 12:30" in agenda DOM', () => {
    const task = buildTask({
      id: 'task-chaqueton-regression',
      title: 'Chaquetón',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));
    expect(fullAgendaText()).not.toContain('12:15 - 12:30');
  });

  it('closes final visible day boundary at 23:59 instead of 00:00', () => {
    const task = buildTask({
      id: 'task-end-boundary-guard',
      title: 'Boundary guard',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const lastSegment = component.daySegments[component.daySegments.length - 1];

    expect(lastSegment.endMinutes).toBe(24 * 60);
    expect(lastSegment.timeBottomLabel).toBe('23:59');
    expect(fullAgendaText()).toContain('23:59');
  });

  it('does not render static decorative event dot when no current-time marker applies', () => {
    const task = buildTask({
      id: 'task-dot-regression',
      title: 'Chaquetón',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 20, 7, 0, 0, 0));

    expect(fixture.nativeElement.querySelector('.agenda-segment-axis-dot')).toBeNull();
    expect(fixture.nativeElement.querySelector('.agenda-segment-now-marker')).toBeNull();
  });
});

describe('Digital Clock recipe regression in Agenda', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AgendaPage>>;
  let component: AgendaPage;

  beforeEach(async () => {
    const taskRepositoryMock: Pick<TaskRepository, 'listTasks' | 'getTaskAggregate'> = {
      listTasks: jasmine.createSpy('listTasks').and.resolveTo([]),
      getTaskAggregate: jasmine
        .createSpy('getTaskAggregate')
        .and.resolveTo(null),
    };

    const routerMock: Pick<Router, 'navigate'> = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    const translateMock: Partial<TranslateService> = {
      instant: (key: string) => {
        if (key === 'TASK_DETAIL.MINUTES_SHORT') {
          return 'min';
        }
        return key;
      },
      get: (key: string | string[]) => of(key),
      stream: (key: string | string[]) => of(key),
      getStreamOnTranslationChange: (key: string | string[]) => of(key),
      currentLang: 'es-MX',
      getDefaultLang: () => 'es-MX',
      onTranslationChange: of({ lang: 'es-MX', translations: {} }),
      onLangChange: of({ lang: 'es-MX', translations: {} }),
      onDefaultLangChange: of({ lang: 'es-MX', translations: {} }),
      onFallbackLangChange: of({ lang: 'es-MX', translations: {} }),
    };

    await TestBed.configureTestingModule({
      imports: [AgendaPage],
      providers: [
        { provide: TaskRepository, useValue: taskRepositoryMock },
        { provide: Router, useValue: routerMock },
        { provide: TranslateService, useValue: translateMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgendaPage);
    component = fixture.componentInstance;
  });

  function renderDay(tasks: PersistedTaskAggregate[], date: Date): void {
    component.scheduledTasks = tasks;
    component.selectedDate = date;
    (component as unknown as { refreshViewModels: () => void }).refreshViewModels();
    fixture.detectChanges();
  }

  it('renders shared time-display component in timeline labels', () => {
    const task = buildTask({
      title: 'Chaquetón',
      trackingMode: 'check',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const labels = fixture.nativeElement.querySelectorAll(
      '.agenda-day-timeline__time sh-time-display'
    ) as NodeListOf<HTMLElement>;

    expect(labels.length).withContext('Missing timeline time labels').toBeGreaterThan(1);
    expect(labels[0]?.querySelector('.app-time-display')).not.toBeNull();
    expect(labels[1]?.querySelector('.app-time-display')).not.toBeNull();
  });

  it('keeps digital visual identity and tabular metrics in computed styles', () => {
    const task = buildTask({
      title: 'Morning meeting',
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '09:00',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 9, 0, 0, 0));

    const elem = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__time sh-time-display .app-time-display'
    ) as HTMLElement | null;

    expect(elem).not.toBeNull();

    const styles = window.getComputedStyle(elem as HTMLElement);
    const fontVariantNumeric = styles.fontVariantNumeric || '';
    const featureSettings = styles.fontFeatureSettings || '';
    const fontFamily = (styles.fontFamily || '').toLowerCase();

    expect(fontVariantNumeric.includes('tabular-nums')).toBe(true);
    expect(featureSettings.includes('tnum')).toBe(true);
    expect(fontFamily.includes('e1234')).toBe(true);
  });

  it('keeps equal widths for 00:00, 11:11, 12:15 and 23:59', () => {
    const measure = (time: string): number => {
      const task = buildTask({
        id: `task-${time}`,
        title: `Task at ${time}`,
        recurrence: {
          pattern: 'daily',
          hasTime: true,
          sameTimeForSelectedDays: true,
          commonTime: time,
          startsToday: true,
          startDate: '2026-03-01T00:00:00.000Z',
          hasEndDate: false,
          endDate: null,
          dayOfMonth: null,
          yearMonth: null,
          yearDay: null,
          timezone: null,
          weekdays: [],
        },
      });

      renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

      const label = fixture.nativeElement.querySelector(
        '.agenda-day-timeline__time sh-time-display .app-time-display'
      ) as HTMLElement | null;

      expect(label).withContext(`Missing rendered label for ${time}`).not.toBeNull();
      return (label as HTMLElement).getBoundingClientRect().width;
    };

    const w00 = measure('00:00');
    const w11 = measure('11:11');
    const w12 = measure('12:15');
    const w23 = measure('23:59');
    const tolerance = 1;

    expect(w00).toBeGreaterThan(0);
    expect(Math.abs(w00 - w11)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(w11 - w12)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(w12 - w23)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(w00 - w23)).toBeLessThanOrEqual(tolerance);
  });

  it('keeps Agenda labels on digital display class after refactors', () => {
    const task = buildTask({
      id: 'task-visual-regression',
      title: 'Visual regression guard',
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '10:10',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 10, 0, 0, 0));

    const labels = fixture.nativeElement.querySelectorAll(
      '.agenda-segment-time sh-time-display .app-time-display'
    );

    expect(labels.length).toBeGreaterThan(0);
  });

  it('renders every agenda time label as five fixed slots', () => {
    const task = buildTask({
      id: 'task-five-slots',
      title: 'Five slots',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('sh-time-display .app-time-display')
    ) as HTMLElement[];

    expect(labels.length).toBeGreaterThan(0);

    for (const label of labels) {
      const slots = label.querySelectorAll('.app-time-display__slot');
      expect(slots.length).toBe(5);
    }
  });

  it('keeps fixed timeline columns and aligned content start for empty and event bodies', () => {
    const task = buildTask({
      id: 'task-alignment',
      title: 'Chaqueton',
      trackingMode: 'duration',
      estimatedDurationMin: 15,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: true,
        commonTime: '12:15',
        startsToday: true,
        startDate: '2026-03-01T00:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        timezone: null,
        weekdays: [],
      },
    });

    renderDay([task], new Date(2026, 2, 29, 12, 0, 0, 0));

    const bodyRows = Array.from(
      fixture.nativeElement.querySelectorAll('.agenda-day-timeline__body-row')
    ) as HTMLElement[];
    const timeWidths = bodyRows.map((bodyRow) =>
      (bodyRow.querySelector('.agenda-day-timeline__time-spacer') as HTMLElement).getBoundingClientRect().width
    );
    const tolerance = 1;

    expect(bodyRows.length).toBeGreaterThanOrEqual(3);
    expect(timeWidths[0]).toBeGreaterThan(0);
    expect(Math.abs(timeWidths[0] - timeWidths[1])).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(timeWidths[1] - timeWidths[2])).toBeLessThanOrEqual(tolerance);

    const emptyContent = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body-row--empty .agenda-day-timeline__content'
    ) as HTMLElement | null;
    const eventContent = fixture.nativeElement.querySelector(
      '.agenda-day-timeline__body-row--event .agenda-day-timeline__content'
    ) as HTMLElement | null;

    expect(emptyContent).not.toBeNull();
    expect(eventContent).not.toBeNull();

    const emptyLeft = (emptyContent as HTMLElement).getBoundingClientRect().left;
    const eventLeft = (eventContent as HTMLElement).getBoundingClientRect().left;
    expect(Math.abs(emptyLeft - eventLeft)).toBeLessThanOrEqual(tolerance);
  });
});
