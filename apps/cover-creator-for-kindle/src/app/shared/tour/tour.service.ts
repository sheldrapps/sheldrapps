import { Injectable } from '@angular/core';

/**
 * Compatibility facade for existing interaction hooks.
 * Guided tours are intentionally disabled in the app.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  isActive(): boolean {
    return false;
  }

  requestSync(): void {}

  async completeInteraction(_interactionId: string): Promise<void> {}

  async skip(): Promise<void> {}
}
