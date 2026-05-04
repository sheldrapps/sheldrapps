import { Injectable, inject } from '@angular/core';
import type { StorageAdapter } from '@sheldrapps/settings-kit';
import {
  RATING_CONFIG_TOKEN,
  RATING_STORAGE_ADAPTER_TOKEN,
} from './rating.config';
import type { RatingState, RatingStorageAdapter } from './rating.types';

@Injectable({ providedIn: 'root' })
export class RatingStorageService {
  private readonly config = inject(RATING_CONFIG_TOKEN);
  private readonly adapter = inject(RATING_STORAGE_ADAPTER_TOKEN);

  async getState(): Promise<RatingState> {
    return this.adapter.getState(this.config.appKey);
  }

  async setState(state: RatingState): Promise<void> {
    await this.adapter.setState(this.config.appKey, normalizeRatingState(state));
  }

  async updateState(
    updater: (state: RatingState) => RatingState | Promise<RatingState>,
  ): Promise<RatingState> {
    const currentState = await this.getState();
    const nextState = normalizeRatingState(await updater(currentState));
    await this.setState(nextState);
    return nextState;
  }
}

export class SettingsKitRatingStorageAdapter implements RatingStorageAdapter {
  constructor(
    private readonly storageAdapter: StorageAdapter,
    private readonly storageKeyPrefix = 'rating',
  ) {}

  async getState(appKey: string): Promise<RatingState> {
    let rawState: string | null;
    try {
      rawState = await this.storageAdapter.get(this.buildKey(appKey));
    } catch {
      return this.recreateState(appKey, true);
    }

    if (!rawState) {
      return this.recreateState(appKey, false);
    }

    try {
      return normalizeRatingState(JSON.parse(rawState) as Partial<RatingState>);
    } catch {
      return this.recreateState(appKey, true);
    }
  }

  async setState(appKey: string, state: RatingState): Promise<void> {
    await this.storageAdapter.set(
      this.buildKey(appKey),
      JSON.stringify(normalizeRatingState(state)),
    );
  }

  private buildKey(appKey: string): string {
    return `${this.storageKeyPrefix}.${appKey}`;
  }

  private async recreateState(
    appKey: string,
    removeBeforeCreate: boolean,
  ): Promise<RatingState> {
    const key = this.buildKey(appKey);
    const defaultState = createDefaultRatingState();

    if (removeBeforeCreate) {
      try {
        await this.storageAdapter.remove(key);
      } catch {
        // Best-effort delete before recreation.
      }
    }

    try {
      await this.setState(appKey, defaultState);
      return defaultState;
    } catch {
      if (!removeBeforeCreate) {
        try {
          await this.storageAdapter.remove(key);
          await this.setState(appKey, defaultState);
        } catch {
          // If persistence is unavailable, return a safe in-memory default.
        }
      }
      return defaultState;
    }
  }
}

export function createDefaultRatingState(): RatingState {
  return {
    appLaunchCount: 0,
    successCount: 0,
    promptCount: 0,
  };
}

export function normalizeRatingState(
  state?: Partial<RatingState> | null,
): RatingState {
  return {
    appLaunchCount: normalizeCounter(state?.appLaunchCount),
    successCount: normalizeCounter(state?.successCount),
    promptCount: normalizeCounter(state?.promptCount),
    lastPromptAt: normalizeIsoDate(state?.lastPromptAt),
    ratedAt: normalizeIsoDate(state?.ratedAt),
    dismissedAt: normalizeIsoDate(state?.dismissedAt),
    feedbackSentAt: normalizeIsoDate(state?.feedbackSentAt),
  };
}

function normalizeCounter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function normalizeIsoDate(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
