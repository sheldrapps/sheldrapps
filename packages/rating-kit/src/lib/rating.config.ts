import { APP_INITIALIZER, InjectionToken, Provider } from '@angular/core';
import {
  CapacitorPreferencesAdapter,
  type StorageAdapter,
} from '@sheldrapps/settings-kit';
import {
  DEFAULT_RATING_CONFIG,
  type RatingConfig,
  type RatingStorageAdapter,
  type ResolvedRatingConfig,
} from './rating.types';
import {
  RatingStorageService,
  SettingsKitRatingStorageAdapter,
} from './rating-storage.service';
import { RatingGateService } from './rating-gate.service';
import { RatingService } from './rating.service';

type RequiredRatingFields = 'appKey' | 'appName' | 'packageName' | 'supportEmail';

export interface ProvideRatingKitConfig
  extends Required<Pick<RatingConfig, Exclude<RequiredRatingFields, 'supportEmail'>>>,
    Partial<Omit<RatingConfig, 'appKey' | 'appName' | 'packageName'>> {
  storageAdapter?: StorageAdapter;
  ratingStorageAdapter?: RatingStorageAdapter;
}

export const RATING_CONFIG_TOKEN = new InjectionToken<ResolvedRatingConfig>(
  'RATING_CONFIG_TOKEN',
);

export const RATING_STORAGE_ADAPTER_TOKEN =
  new InjectionToken<RatingStorageAdapter>('RATING_STORAGE_ADAPTER_TOKEN');

export function resolveRatingConfig(
  config: ProvideRatingKitConfig,
): ResolvedRatingConfig {
  const mergedConfig = {
    ...DEFAULT_RATING_CONFIG,
    ...config,
  };

  return {
    ...mergedConfig,
    supportEmail:
      config.supportEmail ?? DEFAULT_RATING_CONFIG.supportEmail ?? '',
    feedbackOptions:
      config.feedbackOptions ?? DEFAULT_RATING_CONFIG.feedbackOptions ?? [],
    storageKeyPrefix:
      config.storageKeyPrefix ?? DEFAULT_RATING_CONFIG.storageKeyPrefix ?? 'rating',
    storeReviewUrl:
      config.storeReviewUrl ?? `market://details?id=${config.packageName}`,
    webReviewUrl:
      config.webReviewUrl ??
      `https://play.google.com/store/apps/details?id=${config.packageName}`,
  };
}

export function provideRatingKit(config: ProvideRatingKitConfig): Provider[] {
  const resolvedConfig = resolveRatingConfig(config);
  const adapter =
    config.ratingStorageAdapter ??
    new SettingsKitRatingStorageAdapter(
      config.storageAdapter ?? new CapacitorPreferencesAdapter(),
      resolvedConfig.storageKeyPrefix,
    );

  return [
    {
      provide: RATING_CONFIG_TOKEN,
      useValue: resolvedConfig,
    },
    {
      provide: RATING_STORAGE_ADAPTER_TOKEN,
      useValue: adapter,
    },
    RatingStorageService,
    RatingGateService,
    RatingService,
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [RatingService],
      useFactory: (ratingService: RatingService) => () => ratingService.initialize(),
    },
  ];
}
