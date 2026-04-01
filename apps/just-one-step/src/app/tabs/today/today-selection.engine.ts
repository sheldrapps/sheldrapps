export type TaskPriority = 'S' | 'A' | 'B' | 'C';

export type TaskAggregate = {
  id: string;
  title: string;
  durationMinutes: number | null;
  hasTime: boolean;
  startMinutes?: number;
  endMinutes?: number;
  priority: TaskPriority;
};

export type Gap = {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
};

export type NowSelectionReason = 'current' | 'next' | 'backlog';

export type Opportunity = {
  gap: Gap;
  candidates: TaskAggregate[];
};

export type TodaySelectionResult = {
  nowTask: TaskAggregate | null;
  nowReason: NowSelectionReason | null;
  opportunities: Opportunity[];
  backlog: TaskAggregate[];
};

const DAY_END_MINUTES = 24 * 60;
const MAX_OPPORTUNITY_GAPS = 3;
const MAX_CANDIDATES_PER_GAP = 2;

type TimedTaskAggregate = TaskAggregate & {
  hasTime: true;
  startMinutes: number;
  endMinutes: number;
};

function isTimedTask(task: TaskAggregate): task is TimedTaskAggregate {
  return (
    task.hasTime &&
    typeof task.startMinutes === 'number' &&
    typeof task.endMinutes === 'number'
  );
}

export function selectNow(tasks: TaskAggregate[], nowMinutes: number): TaskAggregate | null {
  const withTime = tasks.filter(isTimedTask);

  const current = withTime.find(
    (task) => task.startMinutes <= nowMinutes && task.endMinutes >= nowMinutes
  );
  if (current) {
    return current;
  }

  const next = [...withTime]
    .filter((task) => task.startMinutes > nowMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)[0];
  if (next) {
    return next;
  }

  const withoutTime = tasks.filter((task) => !task.hasTime);
  return rankBacklog(withoutTime)[0] ?? null;
}

export function rankBacklog(tasks: TaskAggregate[]): TaskAggregate[] {
  return [...tasks].sort((left, right) => {
    const priorityDiff = priorityScore(left.priority) - priorityScore(right.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const leftDuration = left.durationMinutes ?? 999;
    const rightDuration = right.durationMinutes ?? 999;
    if (leftDuration !== rightDuration) {
      return leftDuration - rightDuration;
    }

    return left.title.localeCompare(right.title);
  });
}

export function priorityScore(priority: TaskPriority): number {
  switch (priority) {
    case 'S':
      return 0;
    case 'A':
      return 1;
    case 'B':
      return 2;
    case 'C':
    default:
      return 3;
  }
}

export function buildGaps(tasks: TaskAggregate[], nowMinutes: number): Gap[] {
  const withTime = tasks
    .filter(isTimedTask)
    .map((task) => ({
      startMinutes: task.startMinutes as number,
      endMinutes: task.endMinutes as number,
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  if (withTime.length === 0) {
    return [];
  }

  const merged: Array<{ startMinutes: number; endMinutes: number }> = [];
  for (const interval of withTime) {
    if (interval.endMinutes <= nowMinutes) {
      continue;
    }

    const clipped = {
      startMinutes: Math.max(interval.startMinutes, nowMinutes),
      endMinutes: interval.endMinutes,
    };

    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(clipped);
      continue;
    }

    if (clipped.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, clipped.endMinutes);
      continue;
    }

    merged.push(clipped);
  }

  const gaps: Gap[] = [];
  let cursor = nowMinutes;
  for (const interval of merged) {
    if (interval.startMinutes > cursor) {
      gaps.push({
        startMinutes: cursor,
        endMinutes: interval.startMinutes,
        durationMinutes: interval.startMinutes - cursor,
      });
    }
    cursor = Math.max(cursor, interval.endMinutes);
  }

  if (cursor < DAY_END_MINUTES) {
    gaps.push({
      startMinutes: cursor,
      endMinutes: DAY_END_MINUTES,
      durationMinutes: DAY_END_MINUTES - cursor,
    });
  }

  return gaps.filter((gap) => gap.durationMinutes > 0);
}

export function buildOpportunities(
  gaps: Gap[],
  backlog: TaskAggregate[],
  usedTaskIds: Set<string>
): Opportunity[] {
  const ranked = rankBacklog(backlog).filter((task) => !usedTaskIds.has(task.id));
  const usedInOpportunities = new Set<string>(usedTaskIds);

  const opportunities: Opportunity[] = [];
  for (const gap of gaps) {
    if (opportunities.length >= MAX_OPPORTUNITY_GAPS) {
      break;
    }

    const candidates = ranked
      .filter(
        (task) =>
          !usedInOpportunities.has(task.id) &&
          (task.durationMinutes ?? 0) <= gap.durationMinutes
      )
      .slice(0, MAX_CANDIDATES_PER_GAP);

    if (candidates.length === 0) {
      continue;
    }

    candidates.forEach((task) => usedInOpportunities.add(task.id));
    opportunities.push({ gap, candidates });
  }

  return opportunities;
}

export function buildTodaySelection(
  tasks: TaskAggregate[],
  nowMinutes: number
): TodaySelectionResult {
  const used = new Set<string>();

  const nowTask = selectNow(tasks, nowMinutes);
  let nowReason: NowSelectionReason | null = null;
  if (nowTask) {
    used.add(nowTask.id);
    if (nowTask.hasTime) {
      const start = nowTask.startMinutes as number;
      const end = nowTask.endMinutes as number;
      nowReason = start <= nowMinutes && end >= nowMinutes ? 'current' : 'next';
    } else {
      nowReason = 'backlog';
    }
  }

  const gaps = buildGaps(tasks, nowMinutes);
  const backlogPool = tasks.filter((task) => !task.hasTime);
  const opportunities = buildOpportunities(gaps, backlogPool, used);
  opportunities.forEach((opportunity) => {
    opportunity.candidates.forEach((task) => used.add(task.id));
  });

  const backlog = rankBacklog(backlogPool.filter((task) => !used.has(task.id)));

  return {
    nowTask,
    nowReason,
    opportunities,
    backlog,
  };
}
