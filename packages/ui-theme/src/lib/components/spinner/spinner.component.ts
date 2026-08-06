import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonSpinner } from '@ionic/angular/standalone';

export type SpinnerVariant = 'inline' | 'overlay' | 'fullscreen' | 'indicator';

@Component({
  selector: 'sh-spinner',
  standalone: true,
  imports: [IonSpinner],
  templateUrl: './spinner.component.html',
  styleUrls: ['./spinner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerComponent {
  readonly visible = input(false);
  readonly variant = input<SpinnerVariant>('inline');
  readonly label = input<string | null>(null);
  readonly notice = input<string | null>(null);
  readonly detail = input<string | null>(null);
  readonly progress = input<number | null>(null);

  get hasAccessibleStatus(): boolean {
    return (
      !!this.label() ||
      !!this.displayNotice ||
      !!this.displayDetail ||
      this.normalizedProgress !== null
    );
  }

  get rootClass(): string {
    return `sh-spinner sh-spinner--${this.variant()}`;
  }

  get normalizedProgress(): number | null {
    const progress = this.progress();
    if (progress === null || !Number.isFinite(progress)) {
      return null;
    }

    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  get displayDetail(): string | null {
    const detail = this.detail()?.trim();
    if (!detail) {
      return null;
    }

    const progress = this.normalizedProgress;
    const normalizedDetail = detail.replace(/\s+/g, '');
    if (progress !== null && normalizedDetail === `${progress}%`) {
      return null;
    }

    return detail;
  }

  get displayNotice(): string | null {
    const notice = this.notice()?.trim();
    return notice || null;
  }
}
