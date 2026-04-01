import { PersistedTaskAggregate } from '../../database/repositories/task.repository';

export interface TodayNowCard {
  taskId: string;
  title: string;
  categoryLabel: string;
  priorityLabel: string;
  durationLabel: string;
  contextLabel: string;
  timeLabel: string | null;
  color: string;
  progressPercent: number;
  showPercentRing: boolean;
  timerLabel: string | null;
  durationMin: number;
  task: PersistedTaskAggregate;
}

export interface TodayUpcomingGap {
  key: string;
  rangeLabel: string;
  durationLabel: string;
  sizeTier: 'sm' | 'md' | 'lg';
}

export interface TodayTaskListItem {
  taskId: string;
  title: string;
  priorityCode: 'S' | 'A' | 'B' | 'C';
  priorityLabel: string;
  completed: boolean;
  durationLabel: string;
  timeLabel: string | null;
  color: string;
  sizeTier: 'sm' | 'md' | 'lg';
  durationMin: number;
  task: PersistedTaskAggregate;
}
