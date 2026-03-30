import { v3TaskLifecycleSchemaMigration } from './v3-task-lifecycle-schema.migration';

describe('v3TaskLifecycleSchemaMigration', () => {
  it('extends tasks with lifecycle fields and index', async () => {
    const statements: string[] = [];
    const db = {
      execute: jasmine.createSpy('execute').and.callFake(async (sql: string) => {
        statements.push(sql);
      }),
      query: jasmine.createSpy('query').and.resolveTo([]),
      runBatch: jasmine.createSpy('runBatch').and.resolveTo(undefined),
    };

    await v3TaskLifecycleSchemaMigration.up(db as never);

    const fullSql = statements.join('\n');
    expect(fullSql).toContain('ADD COLUMN is_active INTEGER NOT NULL');
    expect(fullSql).toContain('ADD COLUMN is_archived INTEGER NOT NULL');
    expect(fullSql).toContain('ADD COLUMN deleted_at TEXT NULL');
    expect(fullSql).toContain('CREATE INDEX IF NOT EXISTS ix_tasks_lifecycle');
  });
});
