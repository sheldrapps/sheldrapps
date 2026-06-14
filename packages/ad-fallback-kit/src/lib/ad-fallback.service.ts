import { Injectable } from '@angular/core';
import { AdFallbackModalComponent } from './ad-fallback-modal/ad-fallback-modal.component';
import type {
  AdFallbackDecision,
  AdFallbackRequest,
  AdFallbackTelemetryEventName,
  AdFallbackTelemetryPayload,
} from './ad-fallback.types';

type ModalControllerLike = {
  create(options: unknown): Promise<{
    present(): Promise<void>;
    dismiss(data?: unknown, role?: string): Promise<boolean>;
    onWillDismiss(): Promise<{ role?: string }>;
  }>;
};

@Injectable({ providedIn: 'root' })
export class AdFallbackService {
  async handleAdFailure(
    request: AdFallbackRequest,
    modalController: ModalControllerLike,
  ): Promise<AdFallbackDecision> {
    const countdownSeconds = request.countdownSeconds ?? 5;
    const telemetryPayload: AdFallbackTelemetryPayload = {
      app: request.app,
      reason: request.reason,
      confidence: request.confidence,
      remaining: request.remaining,
      total: request.total,
      countdownSeconds,
      showReason: request.confidence === 'high',
    };

    if (request.remaining <= 0) {
      this.emitTelemetry(
        request,
        'ad_fallback_offer_exhausted',
        telemetryPayload,
      );
      return 'exhausted';
    }

    let acceptDismissInProgress = false;
    const modal = await modalController.create({
      component: AdFallbackModalComponent,
      componentProps: {
        appVariant: request.app,
        remaining: request.remaining,
        total: request.total,
        countdownSeconds,
        reason: request.reason,
        showReason: telemetryPayload.showReason,
        requestAccept: () => {
          if (acceptDismissInProgress) {
            return;
          }
          acceptDismissInProgress = true;
          void modal
            .dismiss({ accepted: true }, 'accepted')
            .catch(() => undefined)
            .finally(() => {
              acceptDismissInProgress = false;
            });
        },
      },
      cssClass: 'ad-fallback-alert-modal',
      backdropDismiss: false,
      canDismiss: (_data?: unknown, role?: string) => role === 'accepted',
      keyboardClose: false,
      showBackdrop: true,
    });

    await modal.present();
    this.emitTelemetry(request, 'ad_fallback_modal_shown', telemetryPayload);
    const { role } = await modal.onWillDismiss();

    if (role === 'accepted') {
      this.emitTelemetry(request, 'ad_fallback_modal_accepted', telemetryPayload);
      return 'accepted';
    }

    this.emitTelemetry(request, 'ad_fallback_modal_dismissed', telemetryPayload);
    return 'dismissed';
  }

  private emitTelemetry(
    request: AdFallbackRequest,
    eventName: AdFallbackTelemetryEventName,
    payload: AdFallbackTelemetryPayload,
  ): void {
    request.onTelemetry?.(eventName, payload);
  }
}
