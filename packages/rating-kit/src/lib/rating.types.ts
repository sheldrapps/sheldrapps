export interface RatingState {
  appLaunchCount: number;
  successCount: number;
  promptCount: number;
  lastPromptAt?: string;
  ratedAt?: string;
  dismissedAt?: string;
  feedbackSentAt?: string;
}

export interface RatingAskContext {
  source?: string;
  successEventName?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export type RatingFeedbackOptionId =
  | 'file_not_saved'
  | 'image_blurry'
  | 'file_not_found'
  | 'app_crashed'
  | 'other';

export interface RatingFeedbackOption {
  id: RatingFeedbackOptionId;
  labelKey: string;
  fallbackLabel: string;
}

export interface RatingFeedbackSubmission {
  optionId: RatingFeedbackOptionId;
  details?: string;
}

export interface RatingStorageAdapter {
  getState(appKey: string): Promise<RatingState>;
  setState(appKey: string, state: RatingState): Promise<void>;
}

export interface RatingConfig {
  appKey?: string;
  appName?: string;
  packageName?: string;
  supportEmail?: string;
  minSuccessEvents: number;
  minLaunches: number;
  cooldownDays: number;
  maxPromptCount: number;
  feedbackEnabled: boolean;
  feedbackOptions?: readonly RatingFeedbackOption[];
  storageKeyPrefix?: string;
  storeReviewUrl?: string;
  webReviewUrl?: string;
}

export interface ResolvedRatingConfig extends RatingConfig {
  appKey: string;
  appName: string;
  packageName: string;
  supportEmail: string;
  feedbackOptions: readonly RatingFeedbackOption[];
  storageKeyPrefix: string;
  storeReviewUrl: string;
  webReviewUrl: string;
}

export interface RatingEligibility {
  eligible: boolean;
  reason:
    | 'eligible'
    | 'not-enough-success-events'
    | 'not-enough-launches'
    | 'already-rated'
    | 'dismissed-recently'
    | 'cooldown-active'
    | 'max-prompts-reached';
  nextEligibleAt?: string;
}

export const DEFAULT_RATING_FEEDBACK_OPTIONS: readonly RatingFeedbackOption[] = [
  {
    id: 'file_not_saved',
    labelKey: 'RATING.FEEDBACK.OPTIONS.FILE_NOT_SAVED',
    fallbackLabel: 'No guardó mi archivo',
  },
  {
    id: 'image_blurry',
    labelKey: 'RATING.FEEDBACK.OPTIONS.IMAGE_BLURRY',
    fallbackLabel: 'La imagen salió borrosa',
  },
  {
    id: 'file_not_found',
    labelKey: 'RATING.FEEDBACK.OPTIONS.FILE_NOT_FOUND',
    fallbackLabel: 'No encontré el archivo',
  },
  {
    id: 'app_crashed',
    labelKey: 'RATING.FEEDBACK.OPTIONS.APP_CRASHED',
    fallbackLabel: 'La app se cerró',
  },
  {
    id: 'other',
    labelKey: 'RATING.FEEDBACK.OPTIONS.OTHER',
    fallbackLabel: 'Otro problema',
  },
];

export const DEFAULT_RATING_SUPPORT_EMAIL = 'sheldrapps@gmail.com';

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  minSuccessEvents: 2,
  minLaunches: 2,
  cooldownDays: 14,
  maxPromptCount: 3,
  feedbackEnabled: true,
  feedbackOptions: DEFAULT_RATING_FEEDBACK_OPTIONS,
  storageKeyPrefix: 'rating',
  supportEmail: DEFAULT_RATING_SUPPORT_EMAIL,
};
