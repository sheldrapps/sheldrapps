import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';

export const v1InitialSchemaMigration: SqliteMigration = {
  version: 1,
  name: 'initial-schema',
  up: async (db) => {
    await db.execute('PRAGMA foreign_keys = ON;');

    await db.execute(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        mode TEXT NOT NULL,
        estimated_duration_min INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        category_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );
    `);

    await db.execute(`
      CREATE TABLE task_recurrences (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        interval_value INTEGER,
        days_of_week_mask INTEGER,
        day_of_month INTEGER,
        month_of_year INTEGER,
        time_of_day TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT,
        timezone TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE task_occurrences (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        scheduled_time TEXT,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        completed_at TEXT,
        moved_to_occurrence_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE focus_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        occurrence_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_sec INTEGER,
        mode TEXT NOT NULL,
        was_completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(occurrence_id) REFERENCES task_occurrences(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE task_notifications (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        trigger_mode TEXT NOT NULL,
        minutes_before INTEGER,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        sound_name TEXT,
        tts_text TEXT,
        repeat_if_missed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);

    await db.execute(`
      CREATE TABLE app_config (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        language TEXT,
        theme TEXT,
        onboarding_completed INTEGER DEFAULT 0,
        default_notification_type TEXT,
        daily_review_enabled INTEGER DEFAULT 1,
        gentle_mode_enabled INTEGER DEFAULT 0,
        week_starts_on INTEGER,
        timezone TEXT,
        updated_at TEXT
      );
    `);

    await db.execute(`
      CREATE TABLE daily_reflections (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        energy_level INTEGER,
        note TEXT,
        what_worked TEXT,
        what_was_hard TEXT,
        intention_for_tomorrow TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    await db.execute(`
      CREATE INDEX idx_tasks_category
      ON tasks(category_id);
    `);

    await db.execute(`
      CREATE INDEX idx_occurrences_task
      ON task_occurrences(task_id);
    `);

    await db.execute(`
      CREATE INDEX idx_occurrences_date
      ON task_occurrences(scheduled_date);
    `);

    await db.execute(`
      CREATE INDEX idx_sessions_occurrence
      ON focus_sessions(occurrence_id);
    `);

    await db.execute(`
      CREATE INDEX idx_recurrence_task
      ON task_recurrences(task_id);
    `);

    await db.execute(`
      CREATE INDEX idx_reflections_date
      ON daily_reflections(date);
    `);
  },
};
