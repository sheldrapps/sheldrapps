import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { AgendaYearMonth } from '../agenda.page';

@Component({
  standalone: true,
  selector: 'app-agenda-year',
  templateUrl: './agenda-year.component.html',
  styleUrls: ['./agenda-year.component.scss'],
  imports: [CommonModule],
})
export class AgendaYearComponent {
  @Input() yearMonths: AgendaYearMonth[] = [];

  @Output() openMonth = new EventEmitter<AgendaYearMonth>();
}
