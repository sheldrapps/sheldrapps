import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';

export const v4TaskSchedulingV2SchemaMigration: SqliteMigration = {
  version: 4,
  name: 'task-scheduling-v2-schema',
  up: async (db) => {
    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'recurring' CHECK(schedule_type IN ('one_time', 'recurring'));
    `);

    await db.execute(`
      UPDATE tasks
      SET schedule_type = CASE
        WHEN is_recurrence_enabled = 1 THEN 'recurring'
        ELSE 'one_time'
      END;
    `);

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN one_time_date TEXT NULL;
    `);

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN one_time_time TEXT NULL;
    `);

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN duration_mode TEXT NOT NULL DEFAULT 'single' CHECK(duration_mode IN ('single', 'per_occurrence'));
    `);

    await db.execute(`
      ALTER TABLE task_recurrence
      ADD COLUMN common_duration_min INTEGER NULL;
    `);

    await db.execute(`
      ALTER TABLE task_recurrence_weekdays
      ADD COLUMN duration_min INTEGER NULL;
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_tasks_schedule_type
      ON tasks(schedule_type, updated_at DESC);
    `);
  },
};
