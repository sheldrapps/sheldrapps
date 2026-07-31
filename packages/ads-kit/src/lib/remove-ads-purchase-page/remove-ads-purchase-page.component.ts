import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonHeader,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { BillingService } from '../billing.service';
import { getPlatform } from '../adapters/platform';
import { buildRemoveAdsUpgradePresentation } from '../remove-ads-upgrade/remove-ads-upgrade.presentation';
import type { RemoveAdsUpgradeVariant } from '../remove-ads-upgrade/remove-ads-upgrade.types';
import { RemoveAdsUpgradeModalComponent } from '../remove-ads-upgrade-modal/remove-ads-upgrade-modal.component';
import { RemoveAdsPurchasePageService } from './remove-ads-purchase-page.service';

@Component({
  selector: 'sh-remove-ads-purchase-page',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonBackButton,
    IonButtons,
    IonHeader,
    IonTitle,
    IonToolbar,
    RemoveAdsUpgradeModalComponent,
  ],
  templateUrl: './remove-ads-purchase-page.component.html',
  styleUrls: ['./remove-ads-purchase-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoveAdsPurchasePageComponent implements OnInit, OnDestroy {
  private readonly page = inject(RemoveAdsPurchasePageService);
  private readonly billing = inject(BillingService);
  private readonly toastController = inject(ToastController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly state = this.page.state;
  removeAdsPriceFormatted: string | null = null;
  purchaseBusy = false;
  isOnline = true;

  private priceSubscription?: Subscription;
  private onlineHandler = () => this.setOnlineState(true);
  private offlineHandler = () => this.setOnlineState(false);

  get variant(): RemoveAdsUpgradeVariant {
    return (
      this.state()?.variant ??
      (this.route.snapshot.data['removeAdsVariant'] as RemoveAdsUpgradeVariant) ??
      'PCM'
    );
  }

  get returnUrl(): string {
    return (
      this.state()?.returnUrl ??
      (this.route.snapshot.data['removeAdsReturnUrl'] as string) ??
      '/'
    );
  }

  get presentation() {
    return buildRemoveAdsUpgradePresentation(this.variant);
  }

  get billingReady(): boolean {
    return (
      this.purchaseBusy ||
      this.billing.isDevelopmentMode() ||
      (this.billing.isBillingAvailable() &&
        (getPlatform() === 'web' || this.isOnline))
    );
  }

  get canPurchase(): boolean {
    return (
      this.billing.canShowRemoveAdsEntryPoint() &&
      this.billingReady &&
      !this.purchaseBusy
    );
  }

  get canRestore(): boolean {
    return this.canPurchase;
  }

  get purchasePriceParams(): Record<string, string> {
    return this.removeAdsPriceFormatted
      ? { price: this.removeAdsPriceFormatted }
      : {};
  }

  ngOnInit(): void {
    this.removeAdsPriceFormatted = this.billing.getRemoveAdsPriceFormatted();
    this.priceSubscription = this.billing.removeAdsPrice$.subscribe((price) => {
      this.runInZone(() => {
        this.removeAdsPriceFormatted = price;
      });
    });

    this.isOnline = typeof navigator === 'undefined' || navigator.onLine;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }

    void this.prepareBilling();
  }

  ngOnDestroy(): void {
    this.priceSubscription?.unsubscribe();
    this.page.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
  }

  async purchase(): Promise<void> {
    if (!this.canPurchase) {
      return;
    }

    await this.runPurchaseOperation(async () => {
      const success = await this.billing.purchaseRemoveAds();
      if (!success) {
        return;
      }

      await this.showToast('COMMON.REMOVE_ADS_PURCHASED', 'success');
      this.closePage();
    });
  }

  async restore(): Promise<void> {
    if (!this.canRestore) {
      return;
    }

    await this.runPurchaseOperation(async () => {
      const restored = await this.billing.restorePurchases();
      if (!restored) {
        await this.showToast('COMMON.RESTORE_ERROR', 'error');
        return;
      }

      await this.showToast('COMMON.REMOVE_ADS_RESTORED', 'success');
      this.closePage();
    });
  }

  closePage(): void {
    const returnUrl = this.returnUrl;
    this.page.clear();
    void this.router.navigateByUrl(returnUrl);
  }

  private async prepareBilling(): Promise<void> {
    this.setPurchaseBusy(true);
    await this.flushUi();
    try {
      await this.billing.preparePurchaseUi();
    } finally {
      this.setPurchaseBusy(false);
      await this.flushUi();
    }
  }

  private async runPurchaseOperation(
    operation: () => Promise<void>,
  ): Promise<void> {
    this.setPurchaseBusy(true);
    await this.flushUi();
    try {
      await operation();
    } catch {
      await this.showToast('COMMON.PURCHASE_ERROR', 'error');
    } finally {
      this.setPurchaseBusy(false);
      await this.flushUi();
    }
  }

  private setOnlineState(isOnline: boolean): void {
    this.runInZone(() => {
      this.isOnline = isOnline;
    });
  }

  private setPurchaseBusy(value: boolean): void {
    this.runInZone(() => {
      this.purchaseBusy = value;
    });
  }

  private runInZone(action: () => void): void {
    this.zone.run(() => {
      action();
      this.changeDetector.detectChanges();
    });
  }

  private async flushUi(): Promise<void> {
    if (typeof requestAnimationFrame !== 'function') {
      await Promise.resolve();
      return;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  private async showToast(
    messageKey: string,
    variant: 'success' | 'error',
  ): Promise<void> {
    const toast = await this.toastController.create({
      message: this.translate.instant(messageKey),
      duration: 1800,
      position: 'middle',
      cssClass: `remove-ads-toast remove-ads-toast--${variant}`,
    });
    await toast.present();
  }
}
