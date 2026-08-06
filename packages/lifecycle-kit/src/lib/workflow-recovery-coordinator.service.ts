import { Injectable, inject } from '@angular/core';
import { LifecycleDiagnosticsService } from './lifecycle-diagnostics.service';
import { PersistentRecoveryStore } from './persistent-recovery-store.service';

export type WorkflowRecoveryRegistration<T extends object> = {
  snapshot: () => T;
  assets?: () => Record<string, File | undefined>;
  restore: (payload: T, assets: Record<string, File | undefined>) => Promise<void>;
};

@Injectable({ providedIn: 'root' })
export class WorkflowRecoveryCoordinator {
  private readonly store = inject(PersistentRecoveryStore);
  private readonly lifecycle = inject(LifecycleDiagnosticsService);
  private registration?: WorkflowRecoveryRegistration<Record<string, unknown>>;
  private removeInactiveListener?: () => void;
  private registered = false;
  private saving = Promise.resolve();

  register<T extends object>(registration: WorkflowRecoveryRegistration<T>): void {
    this.registration = registration as WorkflowRecoveryRegistration<Record<string, unknown>>;
    if (this.registered) return;
    this.registered = true;
    this.removeInactiveListener = this.lifecycle.onInactive(() => void this.save());
  }

  async save(): Promise<void> {
    const registration = this.registration;
    if (!registration) return;
    const saveOperation = async () => {
      await this.store.save(registration.snapshot(), registration.assets?.() ?? {});
    };
    this.saving = this.saving.then(saveOperation, saveOperation);
    await this.saving;
  }

  async restore(): Promise<boolean> {
    const registration = this.registration;
    if (!registration) return false;
    const recovered = await this.store.load();
    if (!recovered) return false;
    await registration.restore(recovered.payload, recovered.assets);
    return true;
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }

  ngOnDestroy(): void {
    this.removeInactiveListener?.();
    this.removeInactiveListener = undefined;
  }
}
