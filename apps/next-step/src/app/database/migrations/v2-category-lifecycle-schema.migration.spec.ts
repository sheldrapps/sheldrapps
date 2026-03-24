import { v2CategoryLifecycleSchemaMigration } from './v2-category-lifecycle-schema.migration';

describe('v2CategoryLifecycleSchemaMigration', () => {
  it('extends categories with lifecycle, visual, and ordering fields', async () => {
    const statements: string[] = [];
    const db = {
      execute: jasmine.createSpy('execute').and.callFake(async (sql: string) => {
        statements.push(sql);
      }),
      query: jasmine.createSpy('query').and.resolveTo([]),
      runBatch: jasmine.createSpy('runBatch').and.resolveTo(undefined),
    };

    await v2CategoryLifecycleSchemaMigration.up(db as never);

    const fullSql = statements.join('\n');
    expect(fullSql).toContain('ADD COLUMN color TEXT NOT NULL');
    expect(fullSql).toContain('ADD COLUMN icon TEXT NULL');
    expect(fullSql).toContain('ADD COLUMN description TEXT NULL');
    expect(fullSql).toContain('ADD COLUMN sort_order INTEGER NOT NULL');
    expect(fullSql).toContain('ADD COLUMN is_archived INTEGER NOT NULL');
    expect(fullSql).toContain("ADD COLUMN origin TEXT NOT NULL DEFAULT 'user'");
    expect(fullSql).toContain('ADD COLUMN seed_key TEXT NULL');
    expect(fullSql).toContain('ADD COLUMN deleted_at TEXT NULL');
    expect(fullSql).toContain('DROP INDEX IF EXISTS idx_categories_name_ci');
    expect(fullSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_seed_key');
    expect(fullSql).toContain('CREATE INDEX IF NOT EXISTS ix_categories_active_sort');
  });
});
