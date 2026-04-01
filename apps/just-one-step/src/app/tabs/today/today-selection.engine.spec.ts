import {
  buildGaps,
  buildOpportunities,
  buildTodaySelection,
  rankBacklog,
  selectNow,
  type TaskAggregate,
} from './today-selection.engine';

function task(overrides: Partial<TaskAggregate>): TaskAggregate {
  return {
    id: overrides.id ?? 'task-id',
    title: overrides.title ?? 'Task',
    durationMinutes: overrides.durationMinutes ?? 25,
    hasTime: overrides.hasTime ?? false,
    startMinutes: overrides.startMinutes,
    endMinutes: overrides.endMinutes,
    priority: overrides.priority ?? 'B',
  };
}

describe('today-selection.engine', () => {
  describe('selectNow', () => {
    it('returns current timed task when one is in progress', () => {
      const tasks: TaskAggregate[] = [
        task({ id: 'a', hasTime: true, startMinutes: 540, endMinutes: 600 }),
        task({ id: 'b', hasTime: true, startMinutes: 620, endMinutes: 680 }),
        task({ id: 'c', hasTime: false, priority: 'A', durationMinutes: 10 }),
      ];

      const selected = selectNow(tasks, 550);

      expect(selected?.id).toBe('a');
    });

    it('returns next timed task when none is in progress', () => {
      const tasks: TaskAggregate[] = [
        task({ id: 'a', hasTime: true, startMinutes: 540, endMinutes: 560 }),
        task({ id: 'b', hasTime: true, startMinutes: 610, endMinutes: 670 }),
      ];

      const selected = selectNow(tasks, 600);

      expect(selected?.id).toBe('b');
    });

    it('falls back to ranked backlog when no timed task is available', () => {
      const tasks: TaskAggregate[] = [
        task({ id: 'a', hasTime: false, priority: 'B', durationMinutes: 30, title: 'B1' }),
        task({ id: 'b', hasTime: false, priority: 'A', durationMinutes: 20, title: 'A2' }),
        task({ id: 'c', hasTime: false, priority: 'A', durationMinutes: 10, title: 'A1' }),
      ];

      const selected = selectNow(tasks, 600);

      expect(selected?.id).toBe('c');
    });
  });

  describe('deduplication', () => {
    it('never repeats the same task in now, opportunities and backlog', () => {
      const tasks: TaskAggregate[] = [
        task({ id: 'now', hasTime: true, startMinutes: 600, endMinutes: 660, priority: 'A' }),
        task({ id: 'backlog-1', hasTime: false, priority: 'A', durationMinutes: 10 }),
        task({ id: 'backlog-2', hasTime: false, priority: 'B', durationMinutes: 15 }),
        task({ id: 'backlog-3', hasTime: false, priority: 'C', durationMinutes: 20 }),
      ];

      const result = buildTodaySelection(tasks, 610);

      const allIds = new Set<string>();
      if (result.nowTask) {
        allIds.add(result.nowTask.id);
      }

      for (const opportunity of result.opportunities) {
        for (const candidate of opportunity.candidates) {
          expect(allIds.has(candidate.id)).toBeFalse();
          allIds.add(candidate.id);
        }
      }

      for (const backlogTask of result.backlog) {
        expect(allIds.has(backlogTask.id)).toBeFalse();
        allIds.add(backlogTask.id);
      }
    });
  });

  describe('opportunities', () => {
    it('respects duration fit and limits to 2 tasks per gap and 3 gaps', () => {
      const tasks: TaskAggregate[] = [
        task({ id: 't1', hasTime: true, startMinutes: 560, endMinutes: 580, priority: 'A' }),
        task({ id: 't2', hasTime: true, startMinutes: 620, endMinutes: 640, priority: 'A' }),
        task({ id: 't3', hasTime: true, startMinutes: 680, endMinutes: 700, priority: 'A' }),
        task({ id: 't4', hasTime: true, startMinutes: 740, endMinutes: 760, priority: 'A' }),
        task({ id: 'b1', hasTime: false, durationMinutes: 5, priority: 'A' }),
        task({ id: 'b2', hasTime: false, durationMinutes: 8, priority: 'A' }),
        task({ id: 'b3', hasTime: false, durationMinutes: 12, priority: 'B' }),
        task({ id: 'b4', hasTime: false, durationMinutes: 40, priority: 'B' }),
        task({ id: 'b5', hasTime: false, durationMinutes: 1200, priority: 'C' }),
      ];

      const result = buildTodaySelection(tasks, 540);

      expect(result.opportunities.length).toBeLessThanOrEqual(3);
      for (const opportunity of result.opportunities) {
        expect(opportunity.candidates.length).toBeLessThanOrEqual(2);
        for (const candidate of opportunity.candidates) {
          expect((candidate.durationMinutes ?? 0) <= opportunity.gap.durationMinutes).toBeTrue();
        }
      }
    });

    it('does not create opportunities when the day has only backlog tasks', () => {
      const tasks: TaskAggregate[] = [
        task({ id: 'b1', hasTime: false, durationMinutes: 10, priority: 'A' }),
        task({ id: 'b2', hasTime: false, durationMinutes: 20, priority: 'B' }),
      ];

      const result = buildTodaySelection(tasks, 540);

      expect(result.nowTask?.id).toBe('b1');
      expect(result.opportunities.length).toBe(0);
      expect(result.backlog.map((entry) => entry.id)).toEqual(['b2']);
    });

    it('buildOpportunities enforces strict max sizes', () => {
      const gaps = buildGaps(
        [
          task({ id: 's1', hasTime: true, startMinutes: 600, endMinutes: 610 }),
          task({ id: 's2', hasTime: true, startMinutes: 620, endMinutes: 630 }),
          task({ id: 's3', hasTime: true, startMinutes: 640, endMinutes: 650 }),
          task({ id: 's4', hasTime: true, startMinutes: 660, endMinutes: 670 }),
        ],
        590
      );

      const backlog = rankBacklog([
        task({ id: 'b1', hasTime: false, durationMinutes: 5, priority: 'A' }),
        task({ id: 'b2', hasTime: false, durationMinutes: 5, priority: 'A' }),
        task({ id: 'b3', hasTime: false, durationMinutes: 5, priority: 'A' }),
        task({ id: 'b4', hasTime: false, durationMinutes: 5, priority: 'A' }),
        task({ id: 'b5', hasTime: false, durationMinutes: 5, priority: 'A' }),
      ]);

      const opportunities = buildOpportunities(gaps, backlog, new Set<string>());

      expect(opportunities.length).toBeLessThanOrEqual(3);
      opportunities.forEach((opportunity) => {
        expect(opportunity.candidates.length).toBeLessThanOrEqual(2);
      });
    });
  });
});
