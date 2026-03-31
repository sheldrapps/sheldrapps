import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import {
  NativeSqliteManager,
  SqliteTransactionContext,
} from '@sheldrapps/native-sqlite-kit';
import { TaskRepository } from './task.repository';

describe('TaskRepository', () => {
  let repository: TaskRepository;
  let executeSpy: jasmine.Spy;
  let sqliteManagerMock: {
    isReady: jasmine.Spy;
    initialize: jasmine.Spy;
    runInTransaction: jasmine.Spy;
    query: jasmine.Spy;
    execute: jasmine.Spy;
  };

  beforeEach(() => {
    executeSpy = jasmine.createSpy('execute').and.resolveTo(undefined);
    const tx = { execute: executeSpy } as unknown as SqliteTransactionContext;

    sqliteManagerMock = {
      isReady: jasmine.createSpy('isReady').and.returnValue(true),
      initialize: jasmine.createSpy('initialize').and.resolveTo(undefined),
      runInTransaction: jasmine
        .createSpy('runInTransaction')
        .and.callFake(async (fn: (tx: SqliteTransactionContext) => Promise<void>) => {
          await fn(tx);
        }),
      query: jasmine.createSpy('query').and.resolveTo([]),
      execute: executeSpy,
    };

    spyOn(Capacitor, 'getPlatform').and.returnValue('android');

    TestBed.configureTestingModule({
      providers: [
        TaskRepository,
        { provide: NativeSqliteManager, useValue: sqliteManagerMock },
      ],
    });

    repository = TestBed.inject(TaskRepository);
  });

  it('creates a simple task without recurrence or notifications branches', async () => {
    await repository.createTask({
      title: 'Task A',
      mode: 'check',
    });

    const calls = executeSpy.calls.allArgs().map((args) => String(args[0]));
    expect(calls.some((sql) => sql.includes('INSERT INTO tasks'))).toBeTrue();
    expect(calls.some((sql) => sql.includes('INSERT INTO task_recurrence'))).toBeFalse();
    expect(calls.some((sql) => sql.includes('INSERT INTO task_notifications'))).toBeFalse();
  });

  it('persists one-time schedule fields when recurrence is disabled', async () => {
    await repository.createTask({
      title: 'One-time call',
      mode: 'check',
      priority: 'A',
      scheduleType: 'one_time',
      oneTimeDate: '2026-03-28T12:00:00.000Z',
      oneTimeTime: '12:30',
    });

    const taskInsert = executeSpy.calls
      .allArgs()
      .find((args) => String(args[0]).includes('INSERT INTO tasks'));
    expect(taskInsert).toBeDefined();

    const params = taskInsert?.[1] as unknown[];
    expect(params[5]).toBe('A');
    expect(params[6]).toBe('one_time');
    expect(params[8]).toBe('2026-03-28');
    expect(params[12]).toBe('2026-03-28T12:00:00.000Z');
    expect(params[13]).toBe('12:30');
    expect(params[18]).toBe(0);
  });

  it('keeps one-time local date stable when payload uses YYYY-MM-DD', async () => {
    await repository.createTask({
      title: 'One-time local date',
      mode: 'check',
      scheduleType: 'one_time',
      oneTimeDate: '2026-03-31',
      oneTimeTime: null,
    });

    const taskInsert = executeSpy.calls
      .allArgs()
      .find((args) => String(args[0]).includes('INSERT INTO tasks'));
    expect(taskInsert).toBeDefined();

    const params = taskInsert?.[1] as unknown[];
    expect(params[8]).toBe('2026-03-31');
    expect(params[12]).toBe('2026-03-31T12:00:00.000Z');
  });

  it('creates a daily recurrence branch', async () => {
    await repository.createTask({
      title: 'Task Daily',
      mode: 'check',
      recurrence: {
        mode: 'simple',
        simpleType: 'daily',
        hasTime: true,
        timeOfDay: '10:00',
        startDate: '2026-03-20T09:00:00.000Z',
      },
    });

    const calls = executeSpy.calls.allArgs().map((args) => String(args[0]));
    expect(calls.some((sql) => sql.includes('INSERT INTO task_recurrence'))).toBeTrue();
    expect(
      calls.some((sql) => sql.includes('INSERT INTO task_recurrence_weekdays'))
    ).toBeFalse();
  });

  it('stores default priority B when payload omits priority', async () => {
    await repository.createTask({
      title: 'Priority default',
      mode: 'check',
    });

    const taskInsert = executeSpy.calls
      .allArgs()
      .find((args) => String(args[0]).includes('INSERT INTO tasks'));
    expect(taskInsert).toBeDefined();
    const params = taskInsert?.[1] as unknown[];
    expect(params[5]).toBe('B');
  });

  it('updates task priority when editing task', async () => {
    sqliteManagerMock.query.and.resolveTo([{ id: 'task-priority-update' }]);

    await repository.updateTask('task-priority-update', {
      title: 'Priority update',
      mode: 'check',
      priority: 'S',
    });

    const updateCall = executeSpy.calls
      .allArgs()
      .find((args) => String(args[0]).includes('UPDATE tasks'));
    expect(updateCall).toBeDefined();
    const params = updateCall?.[1] as unknown[];
    expect(params[4]).toBe('S');
  });

  it('creates selected weekdays with per-day times', async () => {
    await repository.createTask({
      title: 'Task Weekdays',
      mode: 'check',
      recurrence: {
        mode: 'weekly_schedule',
        weeklyDayTimes: [
          { dayOfWeek: 1, time: '09:00' },
          { dayOfWeek: 5, time: '18:30' },
        ],
        startDate: '2026-03-20T09:00:00.000Z',
      },
    });

    const weekdayCalls = executeSpy
      .calls
      .allArgs()
      .filter((args) => String(args[0]).includes('INSERT INTO task_recurrence_weekdays'));
    expect(weekdayCalls.length).toBe(2);
    expect((weekdayCalls[0][1] as unknown[])[3]).toBe('09:00');
    expect((weekdayCalls[1][1] as unknown[])[3]).toBe('18:30');
  });

  it('persists per-weekday duration for weekly schedules', async () => {
    await repository.createTask({
      title: 'Task Weekdays Duration',
      mode: 'duration',
      estimatedDurationMin: 25,
      recurrence: {
        mode: 'weekly_schedule',
        weeklyDayTimes: [
          { dayOfWeek: 1, time: '07:00', durationMin: 20 },
          { dayOfWeek: 3, time: '18:00', durationMin: 45 },
        ],
        commonDurationMin: 25,
        startDate: '2026-03-20T09:00:00.000Z',
      },
    });

    const weekdayCalls = executeSpy
      .calls
      .allArgs()
      .filter((args) => String(args[0]).includes('INSERT INTO task_recurrence_weekdays'));
    expect(weekdayCalls.length).toBe(2);
    expect((weekdayCalls[0][1] as unknown[])[4]).toBe(20);
    expect((weekdayCalls[1][1] as unknown[])[4]).toBe(45);
  });

  it('creates before-notification with deduplicated offsets', async () => {
    await repository.createTask({
      title: 'Task Notify',
      mode: 'check',
      scheduleType: 'one_time',
      oneTimeDate: '2026-03-20T09:00:00.000Z',
      oneTimeTime: '09:00',
      notification: {
        notificationType: 'sound',
        triggerMode: 'before',
        notificationOffsets: [30, 5, 60, 30],
      },
    });

    const offsetCalls = executeSpy
      .calls
      .allArgs()
      .filter((args) => String(args[0]).includes('INSERT INTO task_notification_offsets'));
    expect(offsetCalls.length).toBe(3);
    expect(offsetCalls.map((args) => (args[1] as unknown[])[2])).toEqual([5, 30, 60]);
  });

  it('reconstructs canonical read aggregate', async () => {
    sqliteManagerMock.query.and.callFake(async (sql: string) => {
      if (sql.includes('FROM tasks')) {
        return [
          {
            id: 'task-1',
            title: 'Task E',
            description: null,
            category_id: null,
          category_name: null,
          category_color: null,
          priority: 'X',
          tracking_mode: 'check',
          schedule_type: 'recurring',
          duration_mode: 'single',
          estimated_duration_min: null,
          is_active: 1,
          is_archived: 0,
          deleted_at: null,
          is_recurrence_enabled: 1,
          is_notifications_enabled: 1,
          created_at: '2026-03-10T09:00:00.000Z',
          updated_at: '2026-03-12T09:00:00.000Z',
          },
        ];
      }

      if (sql.includes('FROM task_recurrence\n')) {
        return [
          {
            pattern: 'selected_weekdays',
            has_time: 0,
            same_time_for_selected_days: 0,
            common_time: '09:00',
            starts_today: 1,
            start_date: '2026-03-22T00:00:00.000Z',
            has_end_date: 0,
            end_date: null,
            day_of_month: null,
            year_month: null,
            year_day: null,
            timezone: null,
          },
        ];
      }

      if (sql.includes('FROM task_recurrence_weekdays')) {
        return [
          { weekday_index: 3, time_value: '11:00' },
          { weekday_index: 1, time_value: '07:00' },
          { weekday_index: 1, time_value: '09:00' },
        ];
      }

      if (sql.includes('FROM task_notifications')) {
        return [
          {
            notification_type: 'sound',
            trigger_mode: 'before',
            sound_name: null,
            tts_text: null,
            repeat_if_missed: 0,
          },
        ];
      }

      if (sql.includes('FROM task_notification_offsets')) {
        return [
          { offset_minutes: 1440 },
          { offset_minutes: 5 },
          { offset_minutes: 5 },
        ];
      }

      return [];
    });

    const aggregate = await repository.getTaskById('task-1');
    expect(aggregate).not.toBeNull();
    expect(aggregate?.notification?.offsets).toEqual([5, 1440]);
    expect(aggregate?.priority).toBe('B');
    expect(aggregate?.recurrence?.sameTimeForSelectedDays).toBeTrue();
    expect(aggregate?.recurrence?.weekdays[0].dayOfWeek).toBe(1);
    expect(aggregate?.recurrence?.weekdays[0].timeValue).toBeNull();
  });

  it('lists tasks as summary rows', async () => {
    sqliteManagerMock.query.and.resolveTo([
      {
        id: 'task-1',
        title: 'Pago anual',
        description: null,
        category_id: 'cat-1',
        category_name: 'Salud',
        category_color: '#10B981',
        tracking_mode: 'check',
        priority: 'C',
        schedule_type: 'recurring',
        duration_mode: 'single',
        estimated_duration_min: null,
        is_active: 1,
        is_archived: 0,
        deleted_at: null,
        is_recurrence_enabled: 1,
        is_notifications_enabled: 1,
        created_at: '2026-03-01T09:00:00.000Z',
        updated_at: '2026-03-12T09:00:00.000Z',
      },
    ]);

    const list = await repository.listTasks({
      categoryId: 'cat-1',
      searchText: 'Pago',
      limit: 20,
      offset: 5,
    });

    expect(list.length).toBe(1);
    expect(list[0].id).toBe('task-1');
    expect(list[0].priority).toBe('C');
    expect(sqliteManagerMock.query).toHaveBeenCalled();
    const queryArgs = sqliteManagerMock.query.calls.mostRecent().args[1] as unknown[];
    expect(queryArgs).toEqual(['cat-1', '%Pago%', '%Pago%', 20, 5]);
  });

  it('lists month day category summaries with distinct colors', async () => {
    sqliteManagerMock.query.and.callFake(async (sql: string) => {
      if (sql.includes('FROM task_recurrence_weekdays')) {
        return [];
      }

      return [
        {
          task_id: 'task-1',
          schedule_type: 'one_time',
          start_local_date: '2026-03-10',
          end_local_date: null,
          pattern: null,
          day_of_month: null,
          year_month: null,
          year_day: null,
          category_color: '#22C55E',
        },
        {
          task_id: 'task-2',
          schedule_type: 'one_time',
          start_local_date: '2026-03-10',
          end_local_date: null,
          pattern: null,
          day_of_month: null,
          year_month: null,
          year_day: null,
          category_color: '#EF4444',
        },
        {
          task_id: 'task-3',
          schedule_type: 'one_time',
          start_local_date: '2026-03-10',
          end_local_date: null,
          pattern: null,
          day_of_month: null,
          year_month: null,
          year_day: null,
          category_color: '#0EA5E9',
        },
        {
          task_id: 'task-4',
          schedule_type: 'one_time',
          start_local_date: '2026-03-11',
          end_local_date: null,
          pattern: null,
          day_of_month: null,
          year_month: null,
          year_day: null,
          category_color: null,
        },
      ];
    });

    const summaries = await repository.listMonthDayCategorySummaries(
      '2026-03-01T12:00:00.000Z',
      '2026-03-31T12:00:00.000Z'
    );

    expect(sqliteManagerMock.query).toHaveBeenCalled();
    const queryArgs = sqliteManagerMock.query.calls.argsFor(0)[1] as unknown[];
    expect(queryArgs).toEqual(['2026-03-01', '2026-03-31', '2026-03-31', '2026-03-01']);
    expect(summaries).toEqual([
      {
        dateKey: '2026-03-10',
        taskCount: 3,
        categoryColors: ['#22C55E', '#EF4444', '#0EA5E9'],
      },
      {
        dateKey: '2026-03-11',
        taskCount: 1,
        categoryColors: [],
      },
    ]);
  });

  it('keeps selected-weekdays recurrence stable across DST boundaries in summaries', async () => {
    sqliteManagerMock.query.and.callFake(async (sql: string) => {
      if (sql.includes('FROM task_recurrence_weekdays')) {
        return [{ task_id: 'task-weekly', weekday_index: 1 }];
      }

      return [
        {
          task_id: 'task-weekly',
          schedule_type: 'recurring',
          start_local_date: '2026-03-01',
          end_local_date: null,
          pattern: 'selected_weekdays',
          day_of_month: null,
          year_month: null,
          year_day: null,
          category_color: '#22C55E',
        },
      ];
    });

    const summaries = await repository.listMonthDayCategorySummaries(
      '2026-03-08',
      '2026-03-10'
    );

    expect(summaries).toEqual([
      {
        dateKey: '2026-03-09',
        taskCount: 1,
        categoryColors: ['#22C55E'],
      },
    ]);
  });

  it('returns empty month summaries in browser runtime', async () => {
    (Capacitor.getPlatform as jasmine.Spy).and.returnValue('web');

    const summaries = await repository.listMonthDayCategorySummaries(
      '2026-03-01T12:00:00.000Z',
      '2026-03-31T12:00:00.000Z'
    );

    expect(summaries).toBeNull();
    expect(sqliteManagerMock.query).not.toHaveBeenCalled();
    (Capacitor.getPlatform as jasmine.Spy).and.returnValue('android');
  });

  it('updates task and cleans incompatible recurrence branch when pattern changes', async () => {
    sqliteManagerMock.query.and.resolveTo([{ id: 'task-1' }]);

    await repository.updateTask('task-1', {
      title: 'Task Monthly',
      mode: 'check',
      recurrence: {
        mode: 'simple',
        simpleType: 'monthly',
        dayOfMonth: 10,
        hasTime: true,
        timeOfDay: '08:30',
        startDate: '2026-03-20T09:00:00.000Z',
      },
    });

    const calls = executeSpy.calls.allArgs().map((args) => String(args[0]));
    expect(calls.some((sql) => sql.includes('UPDATE tasks'))).toBeTrue();
    expect(
      calls.some((sql) => sql.includes('DELETE FROM task_recurrence_weekdays'))
    ).toBeTrue();
    expect(calls.some((sql) => sql.includes('DELETE FROM task_recurrence'))).toBeTrue();
    expect(calls.some((sql) => sql.includes('INSERT INTO task_recurrence'))).toBeTrue();
    expect(
      calls.some((sql) => sql.includes('INSERT INTO task_recurrence_weekdays'))
    ).toBeFalse();
  });

  it('updates task and removes offsets when trigger mode is not before', async () => {
    sqliteManagerMock.query.and.resolveTo([{ id: 'task-2' }]);

    await repository.updateTask('task-2', {
      title: 'Task Trigger At Time',
      mode: 'check',
      notification: {
        notificationType: 'sound',
        triggerMode: 'at_time',
        notificationOffsets: [5, 10],
      },
    });

    const calls = executeSpy.calls.allArgs().map((args) => String(args[0]));
    expect(
      calls.some((sql) => sql.includes('DELETE FROM task_notification_offsets'))
    ).toBeTrue();
    expect(calls.some((sql) => sql.includes('INSERT INTO task_notifications'))).toBeTrue();
    expect(
      calls.some((sql) => sql.includes('INSERT INTO task_notification_offsets'))
    ).toBeFalse();
  });

  it('soft-deletes task preserving branch rows for history integrity', async () => {
    await repository.deleteTask('task-delete');

    const lifecycleUpdateCalls = executeSpy
      .calls
      .allArgs()
      .filter((args) => String(args[0]).includes('UPDATE tasks'));
    expect(lifecycleUpdateCalls.length).toBe(1);
    expect(String(lifecycleUpdateCalls[0][0])).toContain('deleted_at = ?');
    expect(String(lifecycleUpdateCalls[0][0])).toContain('is_archived = 1');
    expect(String(lifecycleUpdateCalls[0][0])).toContain('is_active = 0');
  });

  it('archives and toggles active state without deleting task rows', async () => {
    await repository.archiveTask('task-archive');
    await repository.setTaskActive('task-archive', false);
    await repository.unarchiveTask('task-archive');

    const calls = executeSpy.calls.allArgs().map((args) => String(args[0]));
    expect(calls.some((sql) => sql.includes('is_archived = ?'))).toBeTrue();
    expect(calls.some((sql) => sql.includes('is_active = ?'))).toBeTrue();
  });

  it('sanitizes incompatible branches before write', async () => {
    await repository.createTask({
      title: 'Task D',
      mode: 'check',
      recurrence: {
        mode: 'simple',
        simpleType: 'daily',
        hasTime: false,
        timeOfDay: '08:00',
        daysOfWeekMask: 127,
        dayOfMonth: 12,
        monthOfYear: 5,
        startDate: '2026-03-21T00:00:00.000Z',
      },
      notification: {
        notificationType: 'sound',
        triggerMode: 'at_time',
        notificationOffsets: [5, 10],
      },
    });

    const recurrenceInsert = executeSpy
      .calls
      .allArgs()
      .find((args) => String(args[0]).includes('INSERT INTO task_recurrence'));
    expect(recurrenceInsert).toBeDefined();
    const recurrenceParams = recurrenceInsert?.[1] as unknown[];
    expect(recurrenceParams[1]).toBe('daily');
    expect(recurrenceParams[4]).toBeNull();
    expect(recurrenceParams[10]).toBeNull();

    const offsetInsertExists = executeSpy
      .calls
      .allArgs()
      .some((args) => String(args[0]).includes('INSERT INTO task_notification_offsets'));
    expect(offsetInsertExists).toBeFalse();
  });

  it('persists monthly recurrence without time using calendar-day semantics', async () => {
    await repository.createTask({
      title: 'Uma tarefina',
      mode: 'check',
      recurrence: {
        mode: 'simple',
        simpleType: 'monthly',
        hasTime: false,
        timeOfDay: '21:17',
        dayOfMonth: null,
        startsToday: false,
        hasEndDate: true,
        startDate: '2026-03-29T05:16:51.560Z',
        endDate: '2026-04-29T05:16:51.560Z',
        timezone: 'America/Mexico_City',
      },
    });

    const recurrenceInsert = executeSpy
      .calls
      .allArgs()
      .find((args) => String(args[0]).includes('INSERT INTO task_recurrence'));
    expect(recurrenceInsert).toBeDefined();

    const recurrenceParams = recurrenceInsert?.[1] as unknown[];
    expect(recurrenceParams[1]).toBe('monthly');
    expect(recurrenceParams[2]).toBe(0);
    expect(recurrenceParams[4]).toBeNull();
    expect(recurrenceParams[10]).toBe(28);
    expect(recurrenceParams[7]).toBe('2026-03-28T12:00:00.000Z');
    expect(recurrenceParams[9]).toBe('2026-04-28T12:00:00.000Z');
  });

  it('forces recurrence updates to start today (forward-only)', async () => {
    sqliteManagerMock.query.and.resolveTo([{ id: 'task-forward-only' }]);

    await repository.updateTask('task-forward-only', {
      title: 'Task future only',
      mode: 'check',
      recurrence: {
        mode: 'simple',
        simpleType: 'monthly',
        dayOfMonth: 27,
        hasTime: false,
        startsToday: false,
        hasEndDate: true,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T00:00:00.000Z',
      },
    });

    const recurrenceInsert = executeSpy
      .calls
      .allArgs()
      .find((args) => String(args[0]).includes('INSERT INTO task_recurrence'));
    expect(recurrenceInsert).toBeDefined();

    const recurrenceParams = recurrenceInsert?.[1] as unknown[];
    expect(recurrenceParams[6]).toBe(1);
    expect(recurrenceParams[7]).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('clamps forward-only recurrence end date to today when past end date is provided', async () => {
    sqliteManagerMock.query.and.resolveTo([{ id: 'task-forward-only-past-end' }]);

    await repository.updateTask('task-forward-only-past-end', {
      title: 'Task forward clamp',
      mode: 'check',
      recurrence: {
        mode: 'simple',
        simpleType: 'daily',
        hasTime: false,
        startsToday: false,
        hasEndDate: true,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2000-01-01T00:00:00.000Z',
        timezone: 'America/Mexico_City',
      },
    });

    const recurrenceInsert = executeSpy
      .calls
      .allArgs()
      .find((args) => String(args[0]).includes('INSERT INTO task_recurrence'));
    expect(recurrenceInsert).toBeDefined();

    const recurrenceParams = recurrenceInsert?.[1] as unknown[];
    expect(recurrenceParams[6]).toBe(1);
    expect(recurrenceParams[9]).toBe(recurrenceParams[7]);
  });
});
