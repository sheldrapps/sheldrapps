import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { AdFallbackModalComponent } from './ad-fallback-modal/ad-fallback-modal.component';
import type { AdFallbackDecision, AdFallbackRequest } from './ad-fallback.types';

@Injectable({ providedIn: 'root' })
export class AdFallbackService {
  private readonly modalController = inject(ModalController);

  async handleAdFailure(request: AdFallbackRequest): Promise<AdFallbackDecision> {
    if (request.remaining <= 0) {
      return 'exhausted';
    }

    const modal = await this.modalController.create({
      component: AdFallbackModalComponent,
      componentProps: {
        appVariant: request.app,
        remaining: request.remaining,
        total: request.total,
        countdownSeconds: request.countdownSeconds ?? 5,
        reason: request.reason,
        showReason: request.confidence === 'high',
      },
      cssClass: 'ad-fallback-alert-modal',
      backdropDismiss: false,
      canDismiss: false,
      keyboardClose: false,
      showBackdrop: true,
    });

    await modal.present();
    const { role } = await modal.onWillDismiss();

    if (role === 'accepted') {
      return 'accepted';
    }

    return 'dismissed';
  }
}
