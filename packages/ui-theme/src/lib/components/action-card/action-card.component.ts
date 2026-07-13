import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

type ActionCardIconFlip = 'none' | 'horizontal' | 'vertical';

@Component({
  selector: 'sh-action-card',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './action-card.component.html',
  styleUrls: ['./action-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionCardComponent {
  @Input() title = '';
  @Input() icon = '';
  @Input() selected = false;
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() iconFlip: ActionCardIconFlip = 'none';
  @Input() ariaLabel: string | null = null;
}
