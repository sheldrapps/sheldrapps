import { Component, Input } from '@angular/core';

export type PriorityCode = 'S' | 'A' | 'B' | 'C';

@Component({
  standalone: true,
  selector: 'app-today-priority-badge',
  templateUrl: './today-priority-badge.component.html',
  styleUrls: ['./today-priority-badge.component.scss'],
})
export class TodayPriorityBadgeComponent {
  @Input({ required: true }) priority!: PriorityCode;
  @Input() ariaLabel = '';
}
