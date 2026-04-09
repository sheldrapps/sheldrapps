import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { AlertController, NavController } from '@ionic/angular';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { CategoryRepository } from '../../database/repositories/category.repository';
import { PersistedTaskAggregate, TaskRepository } from '../../database/repositories/task.repository';
import { JustOneStepSettings } from '../../settings/just-one-step-settings.schema';
import { CreateTaskPage } from './create-task.page';

function buildAggregate(
  overrides: Partial<PersistedTaskAggregate>
): PersistedTaskAggregate {
  const nowIso = '2026-03-29T12:00:00.000Z';
  const scheduleType = overrides.scheduleType ?? 'one_time';
  const recurrence =
    scheduleType === 'recurring' ? overrides.recurrence ?? undefined : undefined;
  const recurrenceType =
    overrides.recurrenceType ??
    (scheduleType === 'recurring' ? recurrence?.pattern ?? 'daily' : 'none');
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Task',
    description: overrides.description ?? null,
    trackingMode: overrides.trackingMode ?? 'check',
    priority: overrides.priority ?? 'B',
    scheduleType,
    recurrenceType,
    durationMode: overrides.durationMode ?? 'single',
    oneTimeDate: overrides.oneTimeDate ?? nowIso,
    oneTimeTime: overrides.oneTimeTime ?? null,
    estimatedDurationMin:
      overrides.estimatedDurationMin === undefined
        ? null
        : overrides.estimatedDurationMin,
    categoryId: overrides.categoryId ?? null,
    categoryName: overrides.categoryName ?? null,
    categoryColor: overrides.categoryColor ?? null,
    isActive: overrides.isActive ?? true,
    isArchived: overrides.isArchived ?? false,
    deletedAt: overrides.deletedAt ?? null,
    recurrenceEnabled: overrides.recurrenceEnabled ?? false,
    notificationsEnabled: overrides.notificationsEnabled ?? false,
    createdAt: overrides.createdAt ?? nowIso,
    updatedAt: overrides.updatedAt ?? nowIso,
    recurrence,
    notification: overrides.notification,
  };
}

describe('CreateTaskPage priority', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CreateTaskPage>>;
  let component: CreateTaskPage;

  beforeEach(async () => {
    const routeParamMap$ = new BehaviorSubject(convertToParamMap({}));
    const routeQueryMap$ = new BehaviorSubject(convertToParamMap({}));

    const taskRepositoryMock: Pick<
      TaskRepository,
      'createTask' | 'createTaskWithCustomCategory' | 'updateTask' | 'getTaskAggregate'
    > = {
      createTask: jasmine.createSpy('createTask').and.resolveTo('task-created'),
      createTaskWithCustomCategory: jasmine
        .createSpy('createTaskWithCustomCategory')
        .and.resolveTo('task-created'),
      updateTask: jasmine.createSpy('updateTask').and.resolveTo(undefined),
      getTaskAggregate: jasmine.createSpy('getTaskAggregate').and.resolveTo(null),
    };

    const categoryRepositoryMock: Pick<
      CategoryRepository,
      'ensureDefaultCategories' | 'createCategory'
    > = {
      ensureDefaultCategories: jasmine
        .createSpy('ensureDefaultCategories')
        .and.resolveTo([]),
      createCategory: jasmine.createSpy('createCategory').and.resolveTo({
        id: 'cat-1',
        name: 'Personal',
        color: '#64748B',
        icon: null,
        description: null,
        sortOrder: 0,
        isArchived: false,
        origin: 'user',
        seedKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }),
    };

    const alertControllerMock: Pick<AlertController, 'create'> = {
      create: jasmine.createSpy('create').and.resolveTo({
        present: jasmine.createSpy('present').and.resolveTo(undefined),
        onDidDismiss: jasmine
          .createSpy('onDidDismiss')
          .and.resolveTo({ role: 'cancel' }),
      } as never),
    };

    const translateMock: Partial<TranslateService> = {
      instant: (key: string) => key,
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

    const settingsMock: Pick<
      SettingsStore<JustOneStepSettings>,
      'load' | 'get' | 'set'
    > = {
      load: jasmine.createSpy('load').and.resolveTo(undefined),
      get: jasmine.createSpy('get').and.returnValue({
        userPreferences: {},
      }),
      set: jasmine.createSpy('set').and.resolveTo(undefined),
    };

    const routerMock: Pick<Router, 'navigate'> = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    await TestBed.configureTestingModule({
      imports: [CreateTaskPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParamMap$.asObservable(),
            queryParamMap: routeQueryMap$.asObservable(),
            snapshot: { paramMap: convertToParamMap({}) },
          },
        },
        { provide: TaskRepository, useValue: taskRepositoryMock },
        { provide: CategoryRepository, useValue: categoryRepositoryMock },
        { provide: AlertController, useValue: alertControllerMock },
        {
          provide: NavController,
          useValue: {
            navigateForward: jasmine.createSpy('navigateForward'),
            navigateBack: jasmine.createSpy('navigateBack'),
            navigateRoot: jasmine.createSpy('navigateRoot'),
            back: jasmine.createSpy('back'),
          },
        },
        { provide: TranslateService, useValue: translateMock },
        { provide: SettingsStore, useValue: settingsMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateTaskPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('defaults priority control to B', () => {
    expect(component.form.controls.priority.value).toBe('B');
  });

  it('includes selected priority in create payload', () => {
    component.form.controls.title.setValue('Task with priority');
    component.form.controls.priority.setValue('S');

    const payload = (component as unknown as { buildCreateTaskInput: () => unknown })
      .buildCreateTaskInput() as { priority?: string };

    expect(payload.priority).toBe('S');
  });

  it('preloads priority when editing existing task aggregate', () => {
    const aggregate = buildAggregate({
      id: 'task-edit',
      title: 'Task edit',
      priority: 'A',
      scheduleType: 'one_time',
      recurrenceEnabled: false,
      oneTimeDate: '2026-03-29T12:00:00.000Z',
      oneTimeTime: '10:00',
    });

    (component as unknown as { applyTaskAggregateToForm: (task: PersistedTaskAggregate) => void })
      .applyTaskAggregateToForm(aggregate);

    expect(component.form.controls.priority.value).toBe('A');
  });

  it('shows the pressed priority tier hint on long press', fakeAsync(() => {
    component.onPriorityLongPressStart('A', new MouseEvent('pointerdown'));
    tick(421);

    expect(component.priorityHintTier).toBe('A');
  }));

  it('hides the priority hint automatically after reveal window', fakeAsync(() => {
    component.onPriorityLongPressStart('S', new MouseEvent('pointerdown'));
    tick(421);
    expect(component.priorityHintTier).toBe('S');

    tick(2501);
    expect(component.priorityHintTier).toBeNull();
  }));

  it('clears tier and anchor when popover is dismissed', fakeAsync(() => {
    component.onPriorityLongPressStart('B', new MouseEvent('pointerdown'));
    tick(421);
    expect(component.priorityHintTier).toBe('B');
    expect(component.priorityHintAnchorEvent).not.toBeNull();

    component.onPriorityHintDismissed();

    expect(component.priorityHintTier).toBeNull();
    expect(component.priorityHintAnchorEvent).toBeNull();
  }));

  it('keeps daily recurrence as simple mode when using a common time', () => {
    component.form.controls.title.setValue('Daily simple');
    component.form.controls.recurrenceEnabled.setValue(true);
    component.form.controls.recurrencePattern.setValue('daily');
    component.form.controls.recurrenceHasTime.setValue(true);
    component.form.controls.recurrenceSameTimeForSelectedDays.setValue(true);
    component.form.controls.recurrenceTime.setValue('09:15');

    const payload = (
      component as unknown as { buildCreateTaskInput: () => Record<string, unknown> }
    ).buildCreateTaskInput() as {
      recurrence?: {
        mode: string;
        simpleType?: string;
        timeOfDay?: string | null;
      };
    };

    expect(component.form.controls.recurrenceSameTimeForSelectedDays.enabled).toBeTrue();
    expect(payload.recurrence?.mode).toBe('simple');
    expect(payload.recurrence?.simpleType).toBe('daily');
    expect(payload.recurrence?.timeOfDay).toBe('09:15');
  });

  it('builds daily recurrence with per-day times as weekly schedule for all days', () => {
    component.form.controls.title.setValue('Daily per-day');
    component.form.controls.recurrenceEnabled.setValue(true);
    component.form.controls.recurrencePattern.setValue('daily');
    component.form.controls.recurrenceHasTime.setValue(true);
    component.form.controls.recurrenceSameTimeForSelectedDays.setValue(false);

    component.form.controls.recurrenceDayTimeMon.setValue('08:00');
    component.form.controls.recurrenceDayTimeTue.setValue('08:05');
    component.form.controls.recurrenceDayTimeWed.setValue('08:10');
    component.form.controls.recurrenceDayTimeThu.setValue('08:15');
    component.form.controls.recurrenceDayTimeFri.setValue('08:20');
    component.form.controls.recurrenceDayTimeSat.setValue('08:25');
    component.form.controls.recurrenceDayTimeSun.setValue('08:30');

    const payload = (
      component as unknown as { buildCreateTaskInput: () => Record<string, unknown> }
    ).buildCreateTaskInput() as {
      recurrence?: {
        mode: string;
        simpleType?: string;
        weeklyDayTimes?: Array<{ dayOfWeek: number; time: string }>;
      };
    };

    expect(component.form.controls.recurrenceTime.disabled).toBeTrue();
    expect(component.form.controls.recurrenceDayTimeMon.enabled).toBeTrue();
    expect(payload.recurrence?.mode).toBe('weekly_schedule');
    expect(payload.recurrence?.simpleType).toBe('daily');
    expect(payload.recurrence?.weeklyDayTimes?.length).toBe(7);
    expect(payload.recurrence?.weeklyDayTimes?.map((slot) => slot.dayOfWeek)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(payload.recurrence?.weeklyDayTimes?.map((slot) => slot.time)).toEqual([
      '08:00',
      '08:05',
      '08:10',
      '08:15',
      '08:20',
      '08:25',
      '08:30',
    ]);
  });

  it('requires one time per day when daily recurrence uses different times', () => {
    component.form.controls.recurrenceEnabled.setValue(true);
    component.form.controls.recurrencePattern.setValue('daily');
    component.form.controls.recurrenceHasTime.setValue(true);
    component.form.controls.recurrenceSameTimeForSelectedDays.setValue(false);

    expect(component.form.controls.recurrenceDayTimeMon.hasError('required')).toBeTrue();
    expect(component.form.controls.recurrenceDayTimeSun.hasError('required')).toBeTrue();
    expect(component.form.invalid).toBeTrue();
  });

  it('loads all-week per-day recurrence as daily when editing', () => {
    const aggregate = buildAggregate({
      id: 'task-daily-per-day',
      title: 'Daily persisted',
      scheduleType: 'recurring',
      recurrenceEnabled: true,
      recurrence: {
        pattern: 'daily',
        hasTime: true,
        sameTimeForSelectedDays: false,
        commonTime: null,
        startsToday: true,
        startDate: '2026-03-29T12:00:00.000Z',
        hasEndDate: false,
        endDate: null,
        dayOfMonth: null,
        yearMonth: null,
        yearDay: null,
        commonDurationMin: null,
        timezone: 'America/Mexico_City',
        weekdays: [
          { dayOfWeek: 1, weekdayBit: 1, timeValue: '08:00', durationMin: null },
          { dayOfWeek: 2, weekdayBit: 2, timeValue: '08:05', durationMin: null },
          { dayOfWeek: 3, weekdayBit: 4, timeValue: '08:10', durationMin: null },
          { dayOfWeek: 4, weekdayBit: 8, timeValue: '08:15', durationMin: null },
          { dayOfWeek: 5, weekdayBit: 16, timeValue: '08:20', durationMin: null },
          { dayOfWeek: 6, weekdayBit: 32, timeValue: '08:25', durationMin: null },
          { dayOfWeek: 7, weekdayBit: 64, timeValue: '08:30', durationMin: null },
        ],
      },
    });

    (component as unknown as { applyTaskAggregateToForm: (task: PersistedTaskAggregate) => void })
      .applyTaskAggregateToForm(aggregate);

    expect(component.form.controls.recurrencePattern.value).toBe('daily');
    expect(component.form.controls.recurrenceHasTime.value).toBeTrue();
    expect(component.form.controls.recurrenceSameTimeForSelectedDays.value).toBeFalse();
    expect(component.form.controls.recurrenceDayTimeMon.value).toBe('08:00');
    expect(component.form.controls.recurrenceDayTimeSun.value).toBe('08:30');
  });

  it('maps weekly_schedule with daily type to daily reminder presets context', () => {
    const resolveReminderPatternFromRecurrence = (
      component as unknown as {
        resolveReminderPatternFromRecurrence: (recurrence: unknown) => string;
      }
    ).resolveReminderPatternFromRecurrence.bind(component);

    const pattern = resolveReminderPatternFromRecurrence({
      mode: 'weekly_schedule',
      simpleType: 'daily',
      weeklyDayTimes: [
        { dayOfWeek: 1, time: '08:00' },
      ],
    });

    expect(pattern).toBe('daily');
  });
});
