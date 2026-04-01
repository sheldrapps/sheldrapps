import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';

export const v7TaskQueryPerformanceIndexesMigration: SqliteMigration = {
  version: 7,
  name: 'task-query-performance-indexes',
  up: async (db) => {
    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_tasks_calendar_window
      ON tasks(deleted_at, is_archived, is_active, schedule_type, start_local_date, end_local_date);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_tasks_active_updated_created
      ON tasks(deleted_at, is_archived, updated_at DESC, created_at DESC);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_task_recurrence_weekdays_task_day
      ON task_recurrence_weekdays(task_id, weekday_index);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_task_notification_offsets_task_sort_minutes
      ON task_notification_offsets(task_id, sort_order, offset_minutes);
    `);
  },
};

