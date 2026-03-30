import { v4TaskSchedulingV2SchemaMigration } from './v4-task-scheduling-v2-schema.migration';

describe('v4TaskSchedulingV2SchemaMigration', () => {
  it('extends tasks and recurrence branches for schedule v2', async () => {
    const statements: string[] = [];
    const db = {
      execute: jasmine.createSpy('execute').and.callFake(async (sql: string) => {
        statements.push(sql);
      }),
      query: jasmine.createSpy('query').and.resolveTo([]),
      runBatch: jasmine.createSpy('runBatch').and.resolveTo(undefined),
    };

    await v4TaskSchedulingV2SchemaMigration.up(db as never);

    const fullSql = statements.join('\n');
    expect(fullSql).toContain('ADD COLUMN schedule_type TEXT NOT NULL');
    expect(fullSql).toContain('UPDATE tasks');
    expect(fullSql).toContain("WHEN is_recurrence_enabled = 1 THEN 'recurring'");
    expect(fullSql).toContain('ADD COLUMN one_time_date TEXT NULL');
    expect(fullSql).toContain('ADD COLUMN one_time_time TEXT NULL');
    expect(fullSql).toContain('ADD COLUMN duration_mode TEXT NOT NULL');
    expect(fullSql).toContain('ADD COLUMN common_duration_min INTEGER NULL');
    expect(fullSql).toContain('ADD COLUMN duration_min INTEGER NULL');
    expect(fullSql).toContain('CREATE INDEX IF NOT EXISTS ix_tasks_schedule_type');
  });
});
