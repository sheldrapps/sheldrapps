import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IonSpinner } from '@ionic/angular/standalone';

export type LoadingStateVariant = 'inline' | 'overlay' | 'fullscreen';

@Component({
  selector: 'sh-loading-state',
  standalone: true,
  imports: [CommonModule, IonSpinner],
  templateUrl: './loading-state.component.html',
  styleUrls: ['./loading-state.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent {
  @Input() variant: LoadingStateVariant = 'inline';
  @Input() label: string | null = null;
  @Input() detail: string | null = null;
  @Input() spinnerName: 'lines' | 'lines-small' | 'bubbles' | 'circles' | 'crescent' = 'crescent';

  get rootClassMap(): Record<string, boolean> {
    return {
      'sh-loading-state': true,
      [`sh-loading-state--${this.variant}`]: true,
    };
  }
}
