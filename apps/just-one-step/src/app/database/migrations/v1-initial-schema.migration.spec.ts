import { v1InitialSchemaMigration } from './v1-initial-schema.migration';

describe('v1InitialSchemaMigration', () => {
  it('creates clean task aggregate tables with core integrity constraints', async () => {
    const statements: string[] = [];
    const db = {
      execute: jasmine.createSpy('execute').and.callFake(async (sql: string) => {
        statements.push(sql);
      }),
      query: jasmine.createSpy('query').and.resolveTo([]),
      runBatch: jasmine.createSpy('runBatch').and.resolveTo(undefined),
    };

    await v1InitialSchemaMigration.up(db as never);

    expect(statements[0]).toContain('PRAGMA foreign_keys = ON');
    expect(statements.some((sql) => sql.includes('CREATE TABLE categories'))).toBeTrue();
    expect(statements.some((sql) => sql.includes('CREATE TABLE tasks'))).toBeTrue();
    expect(statements.some((sql) => sql.includes('CREATE TABLE task_recurrence'))).toBeTrue();
    expect(
      statements.some((sql) => sql.includes('CREATE TABLE task_recurrence_weekdays'))
    ).toBeTrue();
    expect(statements.some((sql) => sql.includes('CREATE TABLE task_notifications'))).toBeTrue();
    expect(
      statements.some((sql) => sql.includes('CREATE TABLE task_notification_offsets'))
    ).toBeTrue();
    expect(
      statements.some((sql) =>
        sql.includes("CHECK(pattern IN ('daily', 'selected_weekdays', 'monthly', 'yearly'))")
      )
    ).toBeTrue();
    expect(
      statements.some((sql) =>
        sql.includes('trigger_mode TEXT NOT NULL CHECK(trigger_mode IN (\'at_time\', \'before\', \'manual_only\'))')
      )
    ).toBeTrue();
    expect(
      statements.some((sql) => sql.includes('UNIQUE(task_id, weekday_index)'))
    ).toBeTrue();
    expect(
      statements.some((sql) => sql.includes('UNIQUE(task_id, offset_minutes)'))
    ).toBeTrue();
    expect(
      statements.some((sql) =>
        sql.includes('FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE')
      )
    ).toBeTrue();
  });

  it('does not create legacy experimental tables', async () => {
    const statements: string[] = [];
    const db = {
      execute: jasmine.createSpy('execute').and.callFake(async (sql: string) => {
        statements.push(sql);
      }),
      query: jasmine.createSpy('query').and.resolveTo([]),
      runBatch: jasmine.createSpy('runBatch').and.resolveTo(undefined),
    };

    await v1InitialSchemaMigration.up(db as never);

    const fullSql = statements.join('\n');
    expect(fullSql.includes('CREATE TABLE task_recurrences')).toBeFalse();
    expect(fullSql.includes('CREATE TABLE task_occurrences')).toBeFalse();
    expect(fullSql.includes('CREATE TABLE focus_sessions')).toBeFalse();
    expect(fullSql.includes('CREATE TABLE app_config')).toBeFalse();
    expect(fullSql.includes('CREATE TABLE daily_reflections')).toBeFalse();
  });
});

