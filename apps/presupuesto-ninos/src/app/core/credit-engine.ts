import { AppSettings } from './models';

const WEEKEND_SATURDAY = 6;
const WEEKEND_SUNDAY = 0;
const MONDAY_JS_INDEX = 1;

export const daysInMonth = (year: number, month0: number): number =>
  new Date(year, month0 + 1, 0).getDate();

export const normalizeDayForMonth = (
  year: number,
  month0: number,
  day: number,
): number => {
  const minDay = Math.max(1, Math.floor(day));
  const maxDay = daysInMonth(year, month0);
  return Math.min(minDay, maxDay);
};

export const getScheduledDatesBetween = (
  fromExclusive: Date,
  toInclusive: Date,
  settings: AppSettings,
): Date[] => {
  switch (settings.creditScheduleType) {
    case 'biweekly':
      return getBiweeklyDatesBetween(fromExclusive, toInclusive, settings);
    case 'monthly':
      return getMonthlyDatesBetween(fromExclusive, toInclusive, settings);
    case 'weekly':
      return getWeeklyDatesBetween(fromExclusive, toInclusive, settings);
    case 'specific_days':
    default:
      return getSpecificDaysDatesBetween(fromExclusive, toInclusive, settings);
  }
};

function getSpecificDaysDatesBetween(
  fromExclusive: Date,
  toInclusive: Date,
  settings: AppSettings,
): Date[] {
  return getMonthlyCandidatesBetween(fromExclusive, toInclusive, (year, month0) =>
    settings.creditDays.map((creditDay) => createMonthDate(year, month0, creditDay)),
  );
}

function getBiweeklyDatesBetween(
  fromExclusive: Date,
  toInclusive: Date,
  settings: AppSettings,
): Date[] {
  return getMonthlyCandidatesBetween(fromExclusive, toInclusive, (year, month0) => {
    const monthLastDay = daysInMonth(year, month0);
    const secondTargetDay =
      settings.biweeklySecondPayDay === 31
        ? monthLastDay
        : Math.min(30, monthLastDay);

    return [
      moveToPreviousBusinessDay(createMonthDate(year, month0, 15)),
      moveToPreviousBusinessDay(createMonthDate(year, month0, secondTargetDay)),
    ];
  });
}

function getMonthlyDatesBetween(
  fromExclusive: Date,
  toInclusive: Date,
  settings: AppSettings,
): Date[] {
  return getMonthlyCandidatesBetween(fromExclusive, toInclusive, (year, month0) => [
    createMonthDate(year, month0, settings.monthlyCreditDay),
  ]);
}

function getWeeklyDatesBetween(
  fromExclusive: Date,
  toInclusive: Date,
  settings: AppSettings,
): Date[] {
  const targetWeekday = normalizeWeekday(settings.weeklyCreditDay);
  const result: Date[] = [];
  const cursor = startOfDay(addDays(fromExclusive, 1));
  const limit = startOfDay(toInclusive);

  while (cursor <= limit) {
    if (cursor.getDay() === toJavascriptWeekday(targetWeekday)) {
      result.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function getMonthlyCandidatesBetween(
  fromExclusive: Date,
  toInclusive: Date,
  buildCandidates: (year: number, month0: number) => Date[],
): Date[] {
  const result: Date[] = [];
  const start = new Date(fromExclusive.getFullYear(), fromExclusive.getMonth(), 1);
  const end = new Date(toInclusive.getFullYear(), toInclusive.getMonth(), 1);
  let cursor = new Date(start);

  while (
    cursor.getFullYear() < end.getFullYear() ||
    (cursor.getFullYear() === end.getFullYear() &&
      cursor.getMonth() <= end.getMonth())
  ) {
    const year = cursor.getFullYear();
    const month0 = cursor.getMonth();
    const uniqueByDay = new Map<number, Date>();

    for (const candidate of buildCandidates(year, month0)) {
      uniqueByDay.set(candidate.getTime(), candidate);
    }

    for (const scheduled of Array.from(uniqueByDay.values()).sort(
      (a, b) => a.getTime() - b.getTime(),
    )) {
      if (scheduled > fromExclusive && scheduled <= toInclusive) {
        result.push(scheduled);
      }
    }

    cursor = new Date(year, month0 + 1, 1);
  }

  return result.sort((a, b) => a.getTime() - b.getTime());
}

function createMonthDate(year: number, month0: number, requestedDay: number): Date {
  const day = normalizeDayForMonth(year, month0, requestedDay);
  return new Date(year, month0, day, 0, 0, 0, 0);
}

function moveToPreviousBusinessDay(date: Date): Date {
  const next = new Date(date);
  while (
    next.getDay() === WEEKEND_SATURDAY ||
    next.getDay() === WEEKEND_SUNDAY
  ) {
    next.setDate(next.getDate() - 1);
  }
  return startOfDay(next);
}

function normalizeWeekday(day: number): number {
  const normalized = Math.floor(Number(day));
  if (!Number.isFinite(normalized)) {
    return MONDAY_JS_INDEX;
  }
  return Math.max(1, Math.min(7, normalized));
}

function toJavascriptWeekday(day: number): number {
  return day === 7 ? WEEKEND_SUNDAY : day;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}
