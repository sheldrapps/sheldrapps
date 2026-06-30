import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton, IonButtons, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudOfflineOutline,
  flashOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
  timeOutline,
} from 'ionicons/icons';
import { TranslateModule } from '@ngx-translate/core';
import { buildRemoveAdsUpgradePresentation } from '../remove-ads-upgrade/remove-ads-upgrade.presentation';
import type { RemoveAdsUpgradeVariant } from '../remove-ads-upgrade/remove-ads-upgrade.types';

@Component({
  selector: 'sh-remove-ads-upgrade-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, IonButton, IonButtons, IonIcon],
  templateUrl: './remove-ads-upgrade-modal.component.html',
  styleUrls: ['./remove-ads-upgrade-modal.component.scss'],
})
export class RemoveAdsUpgradeModalComponent {
  constructor() {
    addIcons({
      cloudOfflineOutline,
      flashOutline,
      shieldCheckmarkOutline,
      sparklesOutline,
      timeOutline,
    });
  }

  private _variant: RemoveAdsUpgradeVariant = 'PCM';
  private _presentation = buildRemoveAdsUpgradePresentation(this._variant);

  @Input({ required: true })
  set variant(value: RemoveAdsUpgradeVariant) {
    this._variant = value;
    this._presentation = buildRemoveAdsUpgradePresentation(value);
  }

  get variant(): RemoveAdsUpgradeVariant {
    return this._variant;
  }

  @Input() billingReady = false;
  @Input() priceFormatted: string | null = null;
  @Input() purchaseDisabled = false;
  @Input() restoreDisabled = false;

  @Output() closeRequested = new EventEmitter<void>();
  @Output() purchaseRequested = new EventEmitter<void>();
  @Output() restoreRequested = new EventEmitter<void>();

  get presentation() {
    return this._presentation;
  }

  get purchaseLabelParams(): Record<string, string> {
    return this.priceFormatted ? { price: this.priceFormatted } : {};
  }

  get purchaseLabelKey(): string {
    return this.priceFormatted
      ? this.presentation.purchaseWithPriceKey
      : this.presentation.purchaseFallbackKey;
  }
}
