import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  DayAgendaTimelineComponent,
  type DayAgendaTimelineBoundary,
  type DayAgendaTimelineSegment,
} from '@sheldrapps/ui-theme';
import type { AgendaRailDay, AgendaUntimedTask } from '../agenda.page';

@Component({
  standalone: true,
  selector: 'app-agenda-day',
  templateUrl: './agenda-day.component.html',
  styleUrls: ['./agenda-day.component.scss'],
  imports: [CommonModule, TranslateModule, DayAgendaTimelineComponent],
})
export class AgendaDayComponent {
  @Input() activeLocale = 'en-US';
  @Input() railDays: AgendaRailDay[] = [];
  @Input() daySegments: Array<{ key: string }> = [];
  @Input() dayTimelineBoundaries: DayAgendaTimelineBoundary[] = [];
  @Input() dayTimelineSegments: DayAgendaTimelineSegment[] = [];
  @Input() dayOpenMessageVisible = false;
  @Input() dayUntimedTasks: AgendaUntimedTask[] = [];

  @Output() selectRailDay = new EventEmitter<AgendaRailDay>();
  @Output() timelineSegmentClick = new EventEmitter<DayAgendaTimelineSegment>();
  @Output() openUntimedTask = new EventEmitter<AgendaUntimedTask>();

  fullDateAriaLabel(date: Date): string {
    return new Intl.DateTimeFormat(this.activeLocale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }
}
