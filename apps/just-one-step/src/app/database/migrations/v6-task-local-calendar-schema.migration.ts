import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';
import {
  formatCalendarDate,
  getDeviceTimezone,
  getToday,
  toCalendarDate,
} from '../../shared/calendar';

interface LegacyTaskCalendarRow extends Record<string, unknown> {
  id: string;
  schedule_type: string;
  one_time_date: string | null;
  one_time_time: string | null;
  created_at: string;
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
  recurrence_has_end_date: number | null;
  recurrence_has_time: number | null;
  recurrence_common_time: string | null;
  recurrence_timezone: string | null;
}

export const v6TaskLocalCalendarSchemaMigration: SqliteMigration = {
  version: 6,
  name: 'task-local-calendar-schema',
  up: async (db) => {
    const deviceTimezone = resolveTimezoneOrFallback(null, getDeviceTimezone());

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN start_local_date TEXT NULL;
    `);

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN end_local_date TEXT NULL;
    `);

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN local_time TEXT NULL;
    `);

    await db.execute(`
      ALTER TABLE tasks
      ADD COLUMN timezone TEXT NULL;
    `);

    const rows = await db.query<LegacyTaskCalendarRow>(
      `
        SELECT
          t.id,
          t.schedule_type,
          t.one_time_date,
          t.one_time_time,
          t.created_at,
          tr.start_date AS recurrence_start_date,
          tr.end_date AS recurrence_end_date,
          tr.has_end_date AS recurrence_has_end_date,
          tr.has_time AS recurrence_has_time,
          tr.common_time AS recurrence_common_time,
          tr.timezone AS recurrence_timezone
        FROM tasks t
        LEFT JOIN task_recurrence tr
          ON tr.task_id = t.id
      `
    );

    for (const row of rows) {
      const timezone = resolveTimezoneOrFallback(row.recurrence_timezone, deviceTimezone);
      const fallbackStart = formatCalendarDate(getToday(timezone));
      const startLocalDate = resolveLocalDate(
        row.schedule_type === 'one_time' ? row.one_time_date : row.recurrence_start_date,
        timezone
      ) ?? resolveLocalDate(row.created_at, timezone) ?? fallbackStart;
      const endLocalDate =
        row.schedule_type === 'recurring' && Number(row.recurrence_has_end_date) === 1
          ? resolveLocalDate(row.recurrence_end_date, timezone)
          : null;
      const localTime =
        row.schedule_type === 'one_time'
          ? normalizeTime(row.one_time_time)
          : Number(row.recurrence_has_time) === 1
            ? normalizeTime(row.recurrence_common_time)
            : null;

      await db.execute(
        `
          UPDATE tasks
          SET
            start_local_date = ?,
            end_local_date = ?,
            local_time = ?,
            timezone = ?
          WHERE id = ?
        `,
        [startLocalDate, endLocalDate, localTime, timezone, row.id]
      );
    }

    await db.execute(
      `
        UPDATE tasks
        SET timezone = ?
        WHERE timezone IS NULL OR trim(timezone) = ''
      `,
      [deviceTimezone]
    );

    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_tasks_start_local_date
      ON tasks(start_local_date);
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_tasks_local_timezone
      ON tasks(timezone);
    `);
  },
};

function resolveLocalDate(value: string | null, timezone: string): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatCalendarDate(toCalendarDate(parsed, timezone));
}

function normalizeTime(value: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;
}

function resolveTimezoneOrFallback(
  timezone: string | null,
  fallback: string
): string {
  if (typeof timezone !== 'string' || timezone.trim().length === 0) {
    return fallback;
  }

  const trimmed = timezone.trim();
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return fallback;
  }
}
