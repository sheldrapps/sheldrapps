import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { AgendaMonthCell } from '../agenda.page';

@Component({
  standalone: true,
  selector: 'app-agenda-month',
  templateUrl: './agenda-month.component.html',
  styleUrls: ['./agenda-month.component.scss'],
  imports: [CommonModule],
})
export class AgendaMonthComponent {
  @Input() activeLocale = 'en-US';
  @Input() monthWeekdayLabels: string[] = [];
  @Input() monthCells: AgendaMonthCell[] = [];

  @Output() openDay = new EventEmitter<AgendaMonthCell>();

  fullDateAriaLabel(date: Date): string {
    return new Intl.DateTimeFormat(this.activeLocale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }
}
