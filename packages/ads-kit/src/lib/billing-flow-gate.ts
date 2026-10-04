export type BillingFlowGateState = {
  appActive: boolean;
  inProgress: boolean;
  blocked: boolean;
};

export class BillingFlowGate {
  private appActive = true;
  private inProgress = false;
  private blocked = false;

  setAppActive(appActive: boolean): void {
    this.appActive = appActive;
  }

  canRunBillingOperations(): boolean {
    return this.appActive && !this.blocked;
  }

  begin(ready: boolean): boolean {
    if (!ready || !this.canRunBillingOperations() || this.inProgress) {
      return false;
    }

    this.inProgress = true;
    return true;
  }

  complete(): void {
    this.inProgress = false;
  }

  block(): void {
    this.blocked = true;
    this.inProgress = false;
  }

  getState(): BillingFlowGateState {
    return {
      appActive: this.appActive,
      inProgress: this.inProgress,
      blocked: this.blocked,
    };
  }
}
