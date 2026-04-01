import { v7TaskQueryPerformanceIndexesMigration } from './v7-task-query-performance-indexes.migration';

describe('v7TaskQueryPerformanceIndexesMigration', () => {
  it('creates task query performance indexes', async () => {
    const statements: string[] = [];
    const db = {
      execute: jasmine.createSpy('execute').and.callFake(async (sql: string) => {
        statements.push(sql);
      }),
      query: jasmine.createSpy('query').and.resolveTo([]),
      runBatch: jasmine.createSpy('runBatch').and.resolveTo(undefined),
    };

    await v7TaskQueryPerformanceIndexesMigration.up(db as never);

    const fullSql = statements.join('\n');
    expect(fullSql).toContain('CREATE INDEX IF NOT EXISTS ix_tasks_calendar_window');
    expect(fullSql).toContain(
      'CREATE INDEX IF NOT EXISTS ix_tasks_active_updated_created'
    );
    expect(fullSql).toContain(
      'CREATE INDEX IF NOT EXISTS ix_task_recurrence_weekdays_task_day'
    );
    expect(fullSql).toContain(
      'CREATE INDEX IF NOT EXISTS ix_task_notification_offsets_task_sort_minutes'
    );
  });
});

