import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';

export type TimePathState = 'upcoming' | 'ongoing' | 'expired';
export type TimePathActorVariant = 'dot' | 'legs' | 'pet';

@Component({
  selector: 'sh-time-path',
  standalone: true,
  templateUrl: './time-path.component.html',
  styleUrls: ['./time-path.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimePathComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) startMinutes = 0;
  @Input({ required: true }) endMinutes = 0;
  @Input({ required: true }) nowMinutes = 0;
  @Input() state: TimePathState = 'upcoming';
  @Input() actorVariant: TimePathActorVariant = 'dot';

  isStepAnimating = false;
  private previousProgress = 0;
  private animationTimeoutId: number | null = null;

  get progress(): number {
    const duration = Math.max(1, this.endMinutes - this.startMinutes);
    const raw = (this.nowMinutes - this.startMinutes) / duration;
    return this.clamp(raw, 0, 1);
  }

  get progressPercent(): string {
    return `${Math.round(this.progress * 100)}%`;
  }

  get startLabel(): string {
    return this.minutesToTime(this.startMinutes);
  }

  get endLabel(): string {
    return this.minutesToTime(this.endMinutes);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      !changes['startMinutes'] &&
      !changes['endMinutes'] &&
      !changes['nowMinutes']
    ) {
      return;
    }

    const currentProgress = this.progress;
    const progressDelta = currentProgress - this.previousProgress;
    if (progressDelta >= 0.05) {
      this.triggerStepAnimation();
    }

    this.previousProgress = currentProgress;
  }

  ngOnDestroy(): void {
    this.clearAnimationTimeout();
  }

  private triggerStepAnimation(): void {
    this.clearAnimationTimeout();
    this.isStepAnimating = true;
    this.cdr.markForCheck();

    this.animationTimeoutId = window.setTimeout(() => {
      this.isStepAnimating = false;
      this.animationTimeoutId = null;
      this.cdr.markForCheck();
    }, 260);
  }

  private clearAnimationTimeout(): void {
    if (this.animationTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.animationTimeoutId);
    this.animationTimeoutId = null;
  }

  private minutesToTime(minutes: number): string {
    const normalized = ((Math.round(minutes) % (24 * 60)) + 24 * 60) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const remainder = normalized % 60;
    return `${`${hours}`.padStart(2, '0')}:${`${remainder}`.padStart(2, '0')}`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  constructor(private readonly cdr: ChangeDetectorRef) {}
}
