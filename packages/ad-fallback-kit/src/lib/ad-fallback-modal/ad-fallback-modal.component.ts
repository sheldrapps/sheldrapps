import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import type { AdFailureReason, AdFallbackAppVariant } from '../ad-fallback.types';

@Component({
  selector: 'app-ad-fallback-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, IonButton],
  templateUrl: './ad-fallback-modal.component.html',
  styleUrls: ['./ad-fallback-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdFallbackModalComponent implements OnInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) appVariant: AdFallbackAppVariant = 'ccfk';
  @Input({ required: true }) remaining = 0;
  @Input({ required: true }) total = 0;
  @Input() countdownSeconds = 5;
  @Input() reason: AdFailureReason = 'unknown';
  @Input() showReason = false;
  @Input() requestAccept: (() => void) | null = null;

  isReady = false;
  currentCount = 5;
  acceptInProgress = false;

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private appStateCleanupCallbacks: Array<() => void> = [];
  private paused = false;
  private remainingMs = 0;
  private lastTickMs = 0;

  get messageKey(): string {
    const variant = this.appVariant.toUpperCase();
    return `AD_FALLBACK.MESSAGE.${variant}`;
  }

  get reasonKey(): string | null {
    if (!this.showReason) return null;
    switch (this.reason) {
      case 'network':
        return 'AD_FALLBACK.REASON.NETWORK';
      case 'dns':
        return 'AD_FALLBACK.REASON.DNS';
      case 'no-fill':
        return 'AD_FALLBACK.REASON.NO_FILL';
      case 'blocked':
        return 'AD_FALLBACK.REASON.BLOCKED';
      case 'region':
        return 'AD_FALLBACK.REASON.REGION';
      default:
        return null;
    }
  }

  ngOnInit(): void {
    this.currentCount = Math.max(1, Math.ceil(this.countdownSeconds));
    this.remainingMs = Math.max(1000, Math.floor(this.countdownSeconds * 1000));
    this.lastTickMs = Date.now();
    this.startCountdown();
    this.bindAppState();
  }

  ngOnDestroy(): void {
    this.clearCountdown();
    for (const cleanup of this.appStateCleanupCallbacks) {
      cleanup();
    }
    this.appStateCleanupCallbacks = [];
  }

  onAccept(): void {
    if (!this.isReady || this.acceptInProgress) {
      return;
    }
    if (!this.requestAccept) {
      return;
    }
    this.acceptInProgress = true;
    this.requestAccept?.();
  }

  private startCountdown(): void {
    this.clearCountdown();
    this.countdownTimer = setInterval(() => {
      const now = Date.now();
      if (this.paused) {
        this.lastTickMs = now;
        return;
      }

      const delta = Math.max(0, now - this.lastTickMs);
      this.lastTickMs = now;
      this.remainingMs = Math.max(0, this.remainingMs - delta);

      if (this.remainingMs === 0) {
        this.isReady = true;
        this.currentCount = 0;
        this.clearCountdown();
      } else {
        this.currentCount = Math.max(1, Math.ceil(this.remainingMs / 1000));
      }

      this.cdr.markForCheck();
    }, 100);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private bindAppState(): void {
    if (typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        this.paused = document.hidden;
        this.lastTickMs = Date.now();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      this.appStateCleanupCallbacks.push(() =>
        document.removeEventListener('visibilitychange', onVisibilityChange),
      );
      onVisibilityChange();
    }

    if (typeof window !== 'undefined') {
      const onBlur = () => {
        this.paused = true;
        this.lastTickMs = Date.now();
      };
      const onFocus = () => {
        this.paused = false;
        this.lastTickMs = Date.now();
      };
      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);
      this.appStateCleanupCallbacks.push(() =>
        window.removeEventListener('blur', onBlur),
      );
      this.appStateCleanupCallbacks.push(() =>
        window.removeEventListener('focus', onFocus),
      );
    }
  }
}
