import { v6TaskLocalCalendarSchemaMigration } from './v6-task-local-calendar-schema.migration';

describe('v6TaskLocalCalendarSchemaMigration', () => {
  it('adds local calendar columns and backfills task rows', async () => {
    const statements: string[] = [];
    const db = {
      execute: jasmine.createSpy('execute').and.callFake(async (sql: string) => {
        statements.push(sql);
      }),
      query: jasmine.createSpy('query').and.resolveTo([
        {
          id: 'task-1',
          schedule_type: 'one_time',
          one_time_date: '2026-03-31T12:00:00.000Z',
          one_time_time: '09:30',
          created_at: '2026-03-01T12:00:00.000Z',
          recurrence_start_date: null,
          recurrence_end_date: null,
          recurrence_has_end_date: null,
          recurrence_has_time: null,
          recurrence_common_time: null,
          recurrence_timezone: null,
        },
      ]),
      runBatch: jasmine.createSpy('runBatch').and.resolveTo(undefined),
    };

    await v6TaskLocalCalendarSchemaMigration.up(db as never);

    const fullSql = statements.join('\n');
    expect(fullSql).toContain('ADD COLUMN start_local_date TEXT NULL');
    expect(fullSql).toContain('ADD COLUMN end_local_date TEXT NULL');
    expect(fullSql).toContain('ADD COLUMN local_time TEXT NULL');
    expect(fullSql).toContain('ADD COLUMN timezone TEXT NULL');
    expect(fullSql).toContain('UPDATE tasks');
    expect(fullSql).toContain('CREATE INDEX IF NOT EXISTS ix_tasks_start_local_date');
    expect(fullSql).toContain('CREATE INDEX IF NOT EXISTS ix_tasks_local_timezone');
    expect(db.query).toHaveBeenCalled();
  });
});
