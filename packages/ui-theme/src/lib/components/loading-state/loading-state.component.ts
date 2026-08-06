import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner.component';

export type LoadingStateVariant = 'inline' | 'overlay' | 'fullscreen';

@Component({
  selector: 'sh-loading-state',
  standalone: true,
  imports: [SpinnerComponent],
  templateUrl: './loading-state.component.html',
  styleUrls: ['./loading-state.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent {
  @Input() variant: LoadingStateVariant = 'inline';
  @Input() label: string | null = null;
  @Input() detail: string | null = null;
  @Input() spinnerName: 'lines' | 'lines-small' | 'bubbles' | 'circles' | 'crescent' = 'crescent';

}
