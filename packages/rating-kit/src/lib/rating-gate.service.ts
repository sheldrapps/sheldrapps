import { Injectable, inject } from '@angular/core';
import { RATING_CONFIG_TOKEN } from './rating.config';
import type { RatingEligibility, RatingState } from './rating.types';

@Injectable({ providedIn: 'root' })
export class RatingGateService {
  private readonly config = inject(RATING_CONFIG_TOKEN);

  evaluate(state: RatingState, now = new Date()): RatingEligibility {
    if (state.successCount < this.config.minSuccessEvents) {
      return {
        eligible: false,
        reason: 'not-enough-success-events',
      };
    }

    if (state.appLaunchCount < this.config.minLaunches) {
      return {
        eligible: false,
        reason: 'not-enough-launches',
      };
    }

    if (state.ratedAt) {
      return {
        eligible: false,
        reason: 'already-rated',
      };
    }

    if (state.promptCount >= this.config.maxPromptCount) {
      return {
        eligible: false,
        reason: 'max-prompts-reached',
      };
    }

    const dismissCooldownUntil = this.getCooldownUntil(state.dismissedAt);
    if (dismissCooldownUntil && dismissCooldownUntil.getTime() > now.getTime()) {
      return {
        eligible: false,
        reason: 'dismissed-recently',
        nextEligibleAt: dismissCooldownUntil.toISOString(),
      };
    }

    const promptCooldownUntil = this.getCooldownUntil(state.lastPromptAt);
    if (promptCooldownUntil && promptCooldownUntil.getTime() > now.getTime()) {
      return {
        eligible: false,
        reason: 'cooldown-active',
        nextEligibleAt: promptCooldownUntil.toISOString(),
      };
    }

    return {
      eligible: true,
      reason: 'eligible',
    };
  }

  private getCooldownUntil(timestamp?: string): Date | null {
    if (!timestamp) {
      return null;
    }

    const parsedTime = Date.parse(timestamp);
    if (Number.isNaN(parsedTime)) {
      return null;
    }

    const cooldownMs = this.config.cooldownDays * 24 * 60 * 60 * 1000;
    return new Date(parsedTime + cooldownMs);
  }
}
