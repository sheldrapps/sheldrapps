import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';

export const v5TaskPrioritySchemaMigration: SqliteMigration = {
  version: 5,
  name: 'task-priority-schema',
  up: async (db) => {
    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN priority TEXT NOT NULL DEFAULT 'B' CHECK(priority IN ('S', 'A', 'B', 'C'));
    `);
  },
};
