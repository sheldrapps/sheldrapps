export type AdFailureReason =
  | 'network'
  | 'dns'
  | 'no-fill'
  | 'blocked'
  | 'region'
  | 'unknown';

export type AdFailureConfidence = 'high' | 'low';

export type AdFallbackAppVariant = 'ccfk' | 'ecc' | 'pcm';

export type AdFallbackDecision = 'accepted' | 'exhausted' | 'dismissed';

export type AdFallbackRequest = {
  app: AdFallbackAppVariant;
  reason: AdFailureReason;
  confidence: AdFailureConfidence;
  remaining: number;
  total: number;
  countdownSeconds?: number;
};
