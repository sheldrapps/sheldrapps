import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';

export const v1InitialSchemaMigration: SqliteMigration = {
  version: 1,
  name: 'task-core-clean-schema',
  up: async (db) => {
    await db.execute('PRAGMA foreign_keys = ON;');

    await db.execute(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category_id TEXT,
        tracking_mode TEXT NOT NULL CHECK(tracking_mode IN ('check', 'duration')),
        estimated_duration_min INTEGER,
        is_recurrence_enabled INTEGER NOT NULL DEFAULT 0 CHECK(is_recurrence_enabled IN (0, 1)),
        is_notifications_enabled INTEGER NOT NULL DEFAULT 0 CHECK(is_notifications_enabled IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
    `);

    await db.execute(`
      CREATE TABLE task_recurrence (
        task_id TEXT PRIMARY KEY NOT NULL,
        pattern TEXT NOT NULL CHECK(pattern IN ('daily', 'selected_weekdays', 'monthly', 'yearly')),
        has_time INTEGER NOT NULL DEFAULT 0 CHECK(has_time IN (0, 1)),
        same_time_for_selected_days INTEGER NOT NULL DEFAULT 1 CHECK(same_time_for_selected_days IN (0, 1)),
        common_time TEXT,
        starts_today INTEGER NOT NULL DEFAULT 1 CHECK(starts_today IN (0, 1)),
        start_date TEXT NOT NULL,
        has_end_date INTEGER NOT NULL DEFAULT 0 CHECK(has_end_date IN (0, 1)),
        end_date TEXT,
        day_of_month INTEGER,
        year_month INTEGER,
        year_day INTEGER,
        timezone TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE task_recurrence_weekdays (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        weekday_index INTEGER NOT NULL CHECK(weekday_index BETWEEN 1 AND 7),
        time_value TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, weekday_index)
      );
    `);

    await db.execute(`
      CREATE TABLE task_notifications (
        task_id TEXT PRIMARY KEY NOT NULL,
        notification_type TEXT NOT NULL CHECK(notification_type IN ('tts', 'sound', 'vibration', 'popup', 'fullscreen')),
        trigger_mode TEXT NOT NULL CHECK(trigger_mode IN ('at_time', 'before', 'manual_only')),
        sound_name TEXT,
        tts_text TEXT,
        repeat_if_missed INTEGER NOT NULL DEFAULT 0 CHECK(repeat_if_missed IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE task_notification_offsets (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        offset_minutes INTEGER NOT NULL CHECK(offset_minutes > 0),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, offset_minutes)
      );
    `);

    await db.execute(`
      CREATE UNIQUE INDEX idx_categories_name_ci
      ON categories(name COLLATE NOCASE);
    `);

    await db.execute(`
      CREATE INDEX idx_tasks_category
      ON tasks(category_id);
    `);

    await db.execute(`
      CREATE INDEX idx_tasks_updated_at
      ON tasks(updated_at DESC);
    `);

    await db.execute(`
      CREATE INDEX idx_task_recurrence_weekdays_task
      ON task_recurrence_weekdays(task_id);
    `);

    await db.execute(`
      CREATE INDEX idx_task_notification_offsets_task
      ON task_notification_offsets(task_id);
    `);

    await db.execute(`
      CREATE INDEX idx_task_notification_offsets_sort
      ON task_notification_offsets(task_id, sort_order);
    `);
  },
};
