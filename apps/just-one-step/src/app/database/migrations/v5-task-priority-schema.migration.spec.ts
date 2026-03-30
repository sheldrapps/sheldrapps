import { v5TaskPrioritySchemaMigration } from './v5-task-priority-schema.migration';

describe('v5TaskPrioritySchemaMigration', () => {
  it('adds task priority column with default and allowed values', async () => {
    const statements: string[] = [];
    const db = {
      execute: jasmine.createSpy('execute').and.callFake(async (sql: string) => {
        statements.push(sql);
      }),
      query: jasmine.createSpy('query').and.resolveTo([]),
      runBatch: jasmine.createSpy('runBatch').and.resolveTo(undefined),
    };

    await v5TaskPrioritySchemaMigration.up(db as never);

    const fullSql = statements.join('\n');
    expect(fullSql).toContain('ADD COLUMN priority TEXT NOT NULL DEFAULT \'B\'');
    expect(fullSql).toContain('CHECK(priority IN (\'S\', \'A\', \'B\', \'C\'))');
  });
});
