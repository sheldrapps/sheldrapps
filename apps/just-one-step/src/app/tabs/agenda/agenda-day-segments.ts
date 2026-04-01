import { type DayAgendaTimelineHeightTier } from '@sheldrapps/ui-theme';

const EMPTY_SEGMENT_HEIGHT_SM_PX = 32;
const EMPTY_SEGMENT_HEIGHT_MD_PX = 40;
const EMPTY_SEGMENT_HEIGHT_LG_PX = 48;
const EVENT_SEGMENT_HEIGHT_SM_PX = 32;
const EVENT_SEGMENT_HEIGHT_MD_PX = 40;
const EVENT_SEGMENT_HEIGHT_LG_PX = 48;

export interface AgendaSegmentTask {
  taskId: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  accentBorderColor: string;
  accentBackgroundColor: string;
  accentShadowColor: string;
}

export interface AgendaDaySegmentModel<
  TTask extends AgendaSegmentTask = AgendaSegmentTask,
> {
  key: string;
  type: 'empty' | 'event';
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  heightTier: DayAgendaTimelineHeightTier;
  visualHeightPx: number;
  timeTopLabel: string;
  timeBottomLabel: string;
  isCurrent: boolean;
  displayTitle: string | null;
  displayHint: string | null;
  displayAccentColor: string | null;
  emptyHint: string | null;
  items?: TTask[];
  task?: TTask;
}

interface AgendaSegmentFormatterOptions {
  emptyHint: string;
  formatMinutes: (minutes: number) => string;
  formatTimelineBoundaryMinutes: (minutes: number) => string;
}

export function buildAgendaDaySegments<TTask extends AgendaSegmentTask>(
  tasks: readonly TTask[],
  visibleStart: number,
  visibleEnd: number,
  nowMinutes: number | null,
  formatters: AgendaSegmentFormatterOptions
) : AgendaDaySegmentModel<TTask>[] {
  const segments: AgendaDaySegmentModel<TTask>[] = [];
  const normalizedTasks = tasks
    .map((task) => {
      const taskStart = Math.max(visibleStart, task.startMinutes);
      const taskEndRaw = Math.min(visibleEnd, task.endMinutes);
      const taskEndForOverlap = Math.min(
        visibleEnd,
        task.endMinutes > task.startMinutes ? task.endMinutes : task.startMinutes + 1
      );
      return {
        task,
        taskStart,
        taskEndRaw,
        taskEndForOverlap,
      };
    })
    .filter((entry) => entry.taskEndForOverlap > entry.taskStart)
    .sort(
      (left, right) =>
        left.taskStart - right.taskStart ||
        left.taskEndForOverlap - right.taskEndForOverlap ||
        left.task.title.localeCompare(right.task.title)
    );

  const overlapGroups: Array<{
    startMinutes: number;
    endMinutes: number;
    overlapEndMinutes: number;
      tasks: TTask[];
  }> = [];

  for (const entry of normalizedTasks) {
    const lastGroup = overlapGroups[overlapGroups.length - 1];
    if (!lastGroup) {
      overlapGroups.push({
        startMinutes: entry.taskStart,
        endMinutes: entry.taskEndRaw,
        overlapEndMinutes: entry.taskEndForOverlap,
        tasks: [entry.task],
      });
      continue;
    }

    if (entry.taskStart < lastGroup.overlapEndMinutes) {
      lastGroup.endMinutes = Math.max(lastGroup.endMinutes, entry.taskEndRaw);
      lastGroup.overlapEndMinutes = Math.max(
        lastGroup.overlapEndMinutes,
        entry.taskEndForOverlap
      );
      lastGroup.tasks.push(entry.task);
      continue;
    }

    overlapGroups.push({
      startMinutes: entry.taskStart,
      endMinutes: entry.taskEndRaw,
      overlapEndMinutes: entry.taskEndForOverlap,
      tasks: [entry.task],
    });
  }

  let cursor = visibleStart;
  for (const group of overlapGroups) {
    if (group.startMinutes > cursor) {
      segments.push(
        createEmptySegment(cursor, group.startMinutes, nowMinutes, formatters)
      );
    }

    segments.push(
      createEventSegment(
        group.tasks,
        group.startMinutes,
        group.endMinutes,
        nowMinutes,
        formatters
      )
    );
    cursor = Math.max(cursor, group.endMinutes);
  }

  if (cursor < visibleEnd) {
    segments.push(createEmptySegment(cursor, visibleEnd, nowMinutes, formatters));
  }

  if (segments.length === 0) {
    segments.push(
      createEmptySegment(visibleStart, visibleEnd, nowMinutes, formatters)
    );
  }

  return segments;
}

export function createEmptySegment<TTask extends AgendaSegmentTask>(
  startMinutes: number,
  endMinutes: number,
  nowMinutes: number | null,
  formatters: AgendaSegmentFormatterOptions
): AgendaDaySegmentModel<TTask> {
  const durationMinutes = Math.max(0, endMinutes - startMinutes);
  const heightTier = resolveEmptyHeightTier(durationMinutes);
  return {
    key: `empty-${startMinutes}-${endMinutes}`,
    type: 'empty',
    startMinutes,
    endMinutes,
    durationMinutes,
    heightTier,
    visualHeightPx: resolveTierVisualHeight(heightTier),
    timeTopLabel: formatters.formatMinutes(startMinutes),
    timeBottomLabel: formatters.formatTimelineBoundaryMinutes(endMinutes),
    isCurrent: isNowInRange(startMinutes, endMinutes, nowMinutes),
    displayTitle: null,
    displayHint: formatters.emptyHint,
    displayAccentColor: null,
    emptyHint: formatters.emptyHint,
  };
}

export function createEventSegment<TTask extends AgendaSegmentTask>(
  tasks: readonly TTask[],
  startMinutes: number,
  endMinutes: number,
  nowMinutes: number | null,
  formatters: AgendaSegmentFormatterOptions
): AgendaDaySegmentModel<TTask> {
  const primaryTask = tasks[0];
  const durationMinutes = Math.max(0, endMinutes - startMinutes);
  const heightTier = resolveEventHeightTier(durationMinutes);
  return {
    key: `event-${tasks.map((task) => task.taskId).join('-')}-${startMinutes}`,
    type: 'event',
    startMinutes,
    endMinutes,
    durationMinutes,
    heightTier,
    visualHeightPx: resolveTierVisualHeight(heightTier),
    timeTopLabel: formatters.formatMinutes(startMinutes),
    timeBottomLabel: formatters.formatTimelineBoundaryMinutes(endMinutes),
    isCurrent: isNowInTaskRange(startMinutes, endMinutes, nowMinutes),
    displayTitle: primaryTask?.title ?? null,
    displayHint: null,
    displayAccentColor: primaryTask?.accentBorderColor ?? null,
    emptyHint: null,
    items: [...tasks],
    task: primaryTask,
  };
}

function resolveEmptyHeightTier(
  durationMinutes: number
): DayAgendaTimelineHeightTier {
  if (durationMinutes <= 15) {
    return 'empty-sm';
  }

  if (durationMinutes <= 45) {
    return 'empty-md';
  }

  return 'empty-lg';
}

function resolveEventHeightTier(
  durationMinutes: number
): DayAgendaTimelineHeightTier {
  if (durationMinutes <= 15) {
    return 'event-sm';
  }

  if (durationMinutes <= 45) {
    return 'event-md';
  }

  return 'event-lg';
}

function resolveTierVisualHeight(tier: DayAgendaTimelineHeightTier): number {
  switch (tier) {
    case 'empty-sm':
      return EMPTY_SEGMENT_HEIGHT_SM_PX;
    case 'empty-md':
      return EMPTY_SEGMENT_HEIGHT_MD_PX;
    case 'empty-lg':
      return EMPTY_SEGMENT_HEIGHT_LG_PX;
    case 'event-sm':
      return EVENT_SEGMENT_HEIGHT_SM_PX;
    case 'event-md':
      return EVENT_SEGMENT_HEIGHT_MD_PX;
    case 'event-lg':
      return EVENT_SEGMENT_HEIGHT_LG_PX;
    default:
      return EMPTY_SEGMENT_HEIGHT_SM_PX;
  }
}

function isNowInRange(
  startMinutes: number,
  endMinutes: number,
  nowMinutes: number | null
): boolean {
  if (nowMinutes === null) {
    return false;
  }

  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

function isNowInTaskRange(
  startMinutes: number,
  endMinutes: number,
  nowMinutes: number | null
): boolean {
  if (nowMinutes === null) {
    return false;
  }

  if (endMinutes <= startMinutes) {
    return nowMinutes === startMinutes;
  }

  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}