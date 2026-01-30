import { AppSettings } from './models';

export const daysInMonth = (year: number, month0: number): number =>
  new Date(year, month0 + 1, 0).getDate();

export const normalizeDayForMonth = (
  year: number,
  month0: number,
  day: number,
  settings: AppSettings
): number => {
  const minDay = Math.max(1, Math.floor(day));

  if (month0 === 1 && settings.useFebruaryOverride) {
    const override = Math.max(1, Math.min(28, settings.februaryDayOverride));
    return override;
  }

  const maxDay = daysInMonth(year, month0);
  return Math.min(minDay, maxDay);
};

export const getScheduledDatesBetween = (
  fromExclusive: Date,
  toInclusive: Date,
  settings: AppSettings
): Date[] => {
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

    for (const creditDay of settings.creditDays) {
      const normalized = normalizeDayForMonth(year, month0, creditDay, settings);
      const scheduled = new Date(year, month0, normalized, 0, 0, 0, 0);

      if (scheduled > fromExclusive && scheduled <= toInclusive) {
        result.push(scheduled);
      }
    }

    cursor = new Date(year, month0 + 1, 1);
  }

  return result.sort((a, b) => a.getTime() - b.getTime());
};