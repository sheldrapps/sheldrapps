export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface CalendarMonthBounds {
  start: CalendarDate;
  end: CalendarDate;
}

export type CalendarDateInput = CalendarDate | string | Date;

const CALENDAR_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getDeviceTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
  if (!timezone) {
    return 'UTC';
  }

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return 'UTC';
  }
}

export function getToday(timezone: string): CalendarDate {
  return toCalendarDate(new Date(), timezone);
}

export function parseCalendarDate(value: string): CalendarDate {
  const match = value.trim().match(CALENDAR_DATE_REGEX);
  if (!match) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = buildCalendarDate(year, month, day);
  if (!parsed) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return parsed;
}

export function formatCalendarDate(date: CalendarDate): string {
  const parsed = buildCalendarDate(date.year, date.month, date.day);
  if (!parsed) {
    throw new Error(
      `Invalid calendar date parts: ${JSON.stringify(date)}`
    );
  }

  return `${`${parsed.year}`.padStart(4, '0')}-${`${parsed.month}`.padStart(2, '0')}-${`${parsed.day}`.padStart(2, '0')}`;
}

export function toCalendarDate(
  value: CalendarDateInput,
  timezone: string
): CalendarDate {
  if (value instanceof Date) {
    return toCalendarDateFromDate(value, timezone);
  }

  if (typeof value === 'string') {
    return parseCalendarDate(value);
  }

  const parsed = buildCalendarDate(value.year, value.month, value.day);
  if (!parsed) {
    throw new Error(
      `Invalid calendar date parts: ${JSON.stringify(value)}`
    );
  }

  return parsed;
}

export function isSameDay(
  left: CalendarDateInput,
  right: CalendarDateInput,
  timezone: string
): boolean {
  return (
    formatCalendarDate(toCalendarDate(left, timezone)) ===
    formatCalendarDate(toCalendarDate(right, timezone))
  );
}

export function isBefore(left: CalendarDateInput, right: CalendarDateInput): boolean {
  return compareCalendarDate(left, right) < 0;
}

export function isAfter(left: CalendarDateInput, right: CalendarDateInput): boolean {
  return compareCalendarDate(left, right) > 0;
}

export function getMonthBounds(
  year: number,
  month: number,
  _timezone: string
): CalendarMonthBounds {
  const start = buildCalendarDate(year, month, 1);
  if (!start) {
    throw new Error(`Invalid month bounds request: ${year}-${month}`);
  }

  const end = buildCalendarDate(year, month, daysInMonth(year, month));
  if (!end) {
    throw new Error(`Invalid month bounds request: ${year}-${month}`);
  }

  return { start, end };
}

export function addDays(value: CalendarDateInput, days: number): CalendarDate {
  const parsed = toCalendarDate(value, 'UTC');
  const base = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() + Math.round(days));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

export function getWeekday(value: CalendarDateInput, timezone: string): number {
  const date = toCalendarDate(value, timezone);
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0, 0)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function toCalendarDateFromDate(value: Date, timezone: string): CalendarDate {
  if (Number.isNaN(value.getTime())) {
    throw new Error('Invalid Date instance.');
  }

  const resolvedTimezone = normalizeTimezone(timezone);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolvedTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(value);
  const year = Number.parseInt(parts.find((part) => part.type === 'year')?.value ?? '', 10);
  const month = Number.parseInt(parts.find((part) => part.type === 'month')?.value ?? '', 10);
  const day = Number.parseInt(parts.find((part) => part.type === 'day')?.value ?? '', 10);
  const parsed = buildCalendarDate(year, month, day);
  if (!parsed) {
    throw new Error('Unable to resolve calendar date from Date value.');
  }

  return parsed;
}

function compareCalendarDate(left: CalendarDateInput, right: CalendarDateInput): number {
  const leftKey = formatCalendarDate(toCalendarDate(left, 'UTC'));
  const rightKey = formatCalendarDate(toCalendarDate(right, 'UTC'));
  return leftKey.localeCompare(rightKey);
}

function normalizeTimezone(timezone: string): string {
  const trimmed = timezone.trim();
  if (trimmed.length === 0) {
    return getDeviceTimezone();
  }

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return getDeviceTimezone();
  }
}

function buildCalendarDate(
  year: number,
  month: number,
  day: number
): CalendarDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return null;
  }

  const days = daysInMonth(year, month);
  if (day > days) {
    return null;
  }

  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0, 12, 0, 0, 0)).getUTCDate();
}
