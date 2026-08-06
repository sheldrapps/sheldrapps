import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'sh-rename-icon',
  standalone: true,
  templateUrl: './rename-icon.component.html',
  styleUrls: ['./rename-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
  },
})
export class RenameIconComponent {}
