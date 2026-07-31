import { Injectable, signal } from '@angular/core';
import type { RemoveAdsUpgradeVariant } from '../remove-ads-upgrade/remove-ads-upgrade.types';

export type RemoveAdsPurchasePageState = {
  variant: RemoveAdsUpgradeVariant;
  returnUrl: string;
};

@Injectable({ providedIn: 'root' })
export class RemoveAdsPurchasePageService {
  private readonly pageState = signal<RemoveAdsPurchasePageState | null>(null);
  readonly state = this.pageState.asReadonly();

  open(state: RemoveAdsPurchasePageState): void {
    this.pageState.set(state);
  }

  clear(): void {
    this.pageState.set(null);
  }
}
