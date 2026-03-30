import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';

export const v3TaskLifecycleSchemaMigration: SqliteMigration = {
  version: 3,
  name: 'task-lifecycle-schema',
  up: async (db) => {
    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1));
    `);

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1));
    `);

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN deleted_at TEXT NULL;
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_tasks_lifecycle
      ON tasks(deleted_at, is_archived, is_active, updated_at DESC);
    `);
  },
};
