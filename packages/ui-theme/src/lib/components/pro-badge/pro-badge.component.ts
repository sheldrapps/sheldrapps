import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sh-pro-badge',
  standalone: true,
  templateUrl: './pro-badge.component.html',
  styleUrls: ['./pro-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
  },
})
export class ProBadgeComponent {}
