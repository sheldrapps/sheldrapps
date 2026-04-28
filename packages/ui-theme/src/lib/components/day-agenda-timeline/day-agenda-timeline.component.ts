import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeDisplayComponent } from '../time-display/time-display.component';
import {
  THEME_ACCENT_BACKGROUND_FALLBACK,
  THEME_ACCENT_BORDER_FALLBACK,
  THEME_ACCENT_SHADOW_FALLBACK,
  resolveThemeAccentColor,
  withThemeAlpha,
} from '../../theme';

export interface DayAgendaTimelineBoundary {
  key: string;
  minutes: number;
  label: string;
}

export type DayAgendaTimelineHeightTier =
  | 'empty-sm'
  | 'empty-md'
  | 'empty-lg'
  | 'event-sm'
  | 'event-md'
  | 'event-lg';

export interface DayAgendaTimelineEventItem {
  key: string;
  taskId: string;
  title: string;
  accentColor?: string | null;
  accentBackgroundColor?: string | null;
  accentShadowColor?: string | null;
  ariaLabel?: string | null;
}

export interface DayAgendaTimelineSegment {
  key: string;
  type: "empty" | "event";
  startMinutes: number;
  endMinutes: number;
  startBoundaryIndex: number;
  endBoundaryIndex: number;
  heightTier: DayAgendaTimelineHeightTier;
  visualHeightPx: number;
  title?: string | null;
  hint?: string | null;
  timeLabel?: string | null;
  durationLabel?: string | null;
  accentColor?: string | null;
  accentBackgroundColor?: string | null;
  accentShadowColor?: string | null;
  eventItems?: readonly DayAgendaTimelineEventItem[];
  activeTaskId?: string | null;
  isCurrent?: boolean;
  interactive?: boolean;
  ariaLabel?: string | null;
}

@Component({
  selector: 'sh-day-agenda-timeline',
  standalone: true,
  imports: [CommonModule, TimeDisplayComponent],
  templateUrl: './day-agenda-timeline.component.html',
  styleUrls: ['./day-agenda-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayAgendaTimelineComponent {
  @Input({ required: true }) boundaries: readonly DayAgendaTimelineBoundary[] = [];
  @Input({ required: true }) segments: readonly DayAgendaTimelineSegment[] = [];

  @Output() segmentClick = new EventEmitter<DayAgendaTimelineSegment>();

  boundaryTrackKey(index: number, boundary: DayAgendaTimelineBoundary): string {
    return boundary.key;
  }

  segmentTrackKey(index: number, segment: DayAgendaTimelineSegment): string {
    return segment.key;
  }

  isEventSegment(segment: DayAgendaTimelineSegment): boolean {
    return segment.type === 'event';
  }

  isInteractiveSegment(segment: DayAgendaTimelineSegment): boolean {
    return segment.type === 'event' && segment.interactive !== false;
  }

  onSegmentActivate(segment: DayAgendaTimelineSegment): void {
    if (!this.isInteractiveSegment(segment)) {
      return;
    }

    this.segmentClick.emit(segment);
  }

  eventItemsForSegment(
    segment: DayAgendaTimelineSegment
  ): readonly DayAgendaTimelineEventItem[] {
    const eventItems = segment.eventItems ?? [];
    if (eventItems.length > 0) {
      return eventItems;
    }

    if (segment.type !== 'event' || !segment.title) {
      return [];
    }

    return [
      {
        key: `${segment.key}-single`,
        taskId: segment.activeTaskId ?? segment.key,
        title: segment.title,
        accentColor: segment.accentColor ?? null,
        accentBackgroundColor: segment.accentBackgroundColor ?? null,
        accentShadowColor: segment.accentShadowColor ?? null,
        ariaLabel: segment.ariaLabel ?? null,
      },
    ];
  }

  visibleEventItemsForSegment(
    segment: DayAgendaTimelineSegment
  ): readonly DayAgendaTimelineEventItem[] {
    const items = this.eventItemsForSegment(segment);
    if (items.length <= 3) {
      return items;
    }

    return items.slice(0, 2);
  }

  overflowCountForSegment(segment: DayAgendaTimelineSegment): number {
    const items = this.eventItemsForSegment(segment);
    return items.length > 3 ? items.length - 2 : 0;
  }

  eventColumnCount(segment: DayAgendaTimelineSegment): number {
    const visibleCount = this.visibleEventItemsForSegment(segment).length;
    return this.overflowCountForSegment(segment) > 0
      ? 3
      : Math.max(1, visibleCount);
  }

  onEventItemActivate(
    segment: DayAgendaTimelineSegment,
    item: DayAgendaTimelineEventItem
  ): void {
    if (!this.isInteractiveSegment(segment)) {
      return;
    }

    if (!item.taskId) {
      this.segmentClick.emit(segment);
      return;
    }

    this.segmentClick.emit({
      ...segment,
      activeTaskId: item.taskId,
    });
  }

  onOverflowActivate(segment: DayAgendaTimelineSegment): void {
    if (!this.isInteractiveSegment(segment)) {
      return;
    }

    this.segmentClick.emit(segment);
  }

  resolveAccentColor(segment: DayAgendaTimelineSegment): string {
    return resolveThemeAccentColor(segment.accentColor, THEME_ACCENT_BORDER_FALLBACK);
  }

  resolveEventItemAccentColor(item: DayAgendaTimelineEventItem): string {
    return resolveThemeAccentColor(item.accentColor, THEME_ACCENT_BORDER_FALLBACK);
  }

  resolveEventItemAccentBackgroundColor(item: DayAgendaTimelineEventItem): string {
    return (
      item.accentBackgroundColor?.trim() ||
      withThemeAlpha(item.accentColor, 0.14, THEME_ACCENT_BACKGROUND_FALLBACK)
    );
  }

  resolveEventItemAccentShadowColor(item: DayAgendaTimelineEventItem): string {
    return (
      item.accentShadowColor?.trim() ||
      withThemeAlpha(item.accentColor, 0.22, THEME_ACCENT_SHADOW_FALLBACK)
    );
  }

  resolveAccentBackgroundColor(segment: DayAgendaTimelineSegment): string {
    return (
      segment.accentBackgroundColor?.trim() ||
      withThemeAlpha(segment.accentColor, 0.14, THEME_ACCENT_BACKGROUND_FALLBACK)
    );
  }

  resolveAccentShadowColor(segment: DayAgendaTimelineSegment): string {
    return (
      segment.accentShadowColor?.trim() ||
      withThemeAlpha(segment.accentColor, 0.22, THEME_ACCENT_SHADOW_FALLBACK)
    );
  }
}
