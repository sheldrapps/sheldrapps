import { PersistedTaskAggregate } from '../../database/repositories/task.repository';

export type ScheduledState = "upcoming" | "ongoing" | "expired";

export interface TodayNowCard {
  taskId: string;
  title: string;
  categoryLabel: string;
  priorityLabel: string;
  stateLabel: string;
  scheduledState: ScheduledState;
  timeLabel: string | null;
  color: string;
  progress: number;
  startMinutes: number;
  endMinutes: number;
  durationMin: number;
  task: PersistedTaskAggregate;
}

export interface TodayUpcomingGap {
  key: string;
  rangeLabel: string;
  durationLabel: string;
  sizeTier: "sm" | "md" | "lg";
}

export interface TodayTaskListItem {
  taskId: string;
  title: string;
  priorityCode: "S" | "A" | "B" | "C";
  priorityLabel: string;
  completed: boolean;
  durationLabel: string;
  timeLabel: string | null;
  color: string;
  sizeTier: "sm" | "md" | "lg";
  durationMin: number;
  task: PersistedTaskAggregate;
}

export interface ProximateTaskItem {
  kind: "task";
  startMinutes: number;
  taskItem: TodayTaskListItem;
}

export interface ProximateFreeItem {
  kind: "gap";
  startMinutes: number;
  key: string;
  rangeLabel: string;
  durationLabel: string;
  sizeTier: "sm" | "md" | "lg";
}

export type ProximateItem = ProximateTaskItem | ProximateFreeItem;
