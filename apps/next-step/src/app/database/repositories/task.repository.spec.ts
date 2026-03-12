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

  it('creates before-notification with deduplicated offsets', async () => {
    await repository.createTask({
      title: 'Task Notify',
      mode: 'check',
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
            tracking_mode: 'check',
            estimated_duration_min: null,
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
        tracking_mode: 'check',
        estimated_duration_min: null,
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
    expect(sqliteManagerMock.query).toHaveBeenCalled();
    const queryArgs = sqliteManagerMock.query.calls.mostRecent().args[1] as unknown[];
    expect(queryArgs).toEqual(['cat-1', '%Pago%', '%Pago%', 20, 5]);
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

  it('deletes task with a single root delete (children handled by cascade)', async () => {
    await repository.deleteTask('task-delete');

    const deleteCalls = executeSpy
      .calls
      .allArgs()
      .filter((args) => String(args[0]).includes('DELETE FROM tasks'));
    expect(deleteCalls.length).toBe(1);
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
    expect(recurrenceParams[9]).toBeNull();

    const offsetInsertExists = executeSpy
      .calls
      .allArgs()
      .some((args) => String(args[0]).includes('INSERT INTO task_notification_offsets'));
    expect(offsetInsertExists).toBeFalse();
  });
});

