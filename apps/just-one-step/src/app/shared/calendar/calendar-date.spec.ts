import {
  addDays,
  formatCalendarDate,
  getMonthBounds,
  getWeekday,
  parseCalendarDate,
  toCalendarDate,
} from './calendar-date';

describe('calendar-date helpers', () => {
  it('parses and formats YYYY-MM-DD values', () => {
    const parsed = parseCalendarDate('2026-03-31');
    expect(parsed).toEqual({ year: 2026, month: 3, day: 31 });
    expect(formatCalendarDate(parsed)).toBe('2026-03-31');
  });

  it('adds days with pure calendar semantics', () => {
    expect(addDays('2026-03-31', 1)).toEqual({ year: 2026, month: 4, day: 1 });
    expect(addDays('2026-01-01', -1)).toEqual({ year: 2025, month: 12, day: 31 });
  });

  it('resolves month bounds', () => {
    expect(getMonthBounds(2026, 2, 'America/Mexico_City')).toEqual({
      start: { year: 2026, month: 2, day: 1 },
      end: { year: 2026, month: 2, day: 28 },
    });
  });

  it('computes Monday-based weekday', () => {
    expect(getWeekday('2026-03-30', 'America/Mexico_City')).toBe(1);
    expect(getWeekday('2026-03-29', 'America/Mexico_City')).toBe(7);
  });

  it('converts Date to calendar date using timezone', () => {
    const utcDate = new Date('2026-03-31T00:30:00.000Z');
    const local = toCalendarDate(utcDate, 'America/Mexico_City');
    expect(local).toEqual({ year: 2026, month: 3, day: 30 });
  });

  it('keeps local day stable across DST forward transition', () => {
    const beforeJump = toCalendarDate(
      new Date('2026-03-08T06:30:00.000Z'),
      'America/New_York'
    );
    const afterJump = toCalendarDate(
      new Date('2026-03-08T07:30:00.000Z'),
      'America/New_York'
    );

    expect(beforeJump).toEqual({ year: 2026, month: 3, day: 8 });
    expect(afterJump).toEqual({ year: 2026, month: 3, day: 8 });
  });
});
