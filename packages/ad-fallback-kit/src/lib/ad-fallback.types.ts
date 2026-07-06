export type AdFailureReason =
  | 'network'
  | 'dns'
  | 'no-fill'
  | 'blocked'
  | 'region'
  | 'unknown';

export type AdFailureConfidence = 'high' | 'low';

export type AdFallbackAppVariant = 'ccfk' | 'ecc' | 'pcm' | 'ef';

export type AdFallbackDecision = 'accepted' | 'exhausted' | 'dismissed';

export type AdFallbackTelemetryEventName =
  | 'ad_fallback_offer_exhausted'
  | 'ad_fallback_modal_shown'
  | 'ad_fallback_modal_accepted'
  | 'ad_fallback_modal_dismissed';

export type AdFallbackTelemetryPayload = {
  app: AdFallbackAppVariant;
  reason: AdFailureReason;
  confidence: AdFailureConfidence;
  remaining: number;
  total: number;
  countdownSeconds: number;
  showReason: boolean;
};

export type AdFallbackRequest = {
  app: AdFallbackAppVariant;
  reason: AdFailureReason;
  confidence: AdFailureConfidence;
  remaining: number;
  total: number;
  countdownSeconds?: number;
  onTelemetry?: (
    eventName: AdFallbackTelemetryEventName,
    payload: AdFallbackTelemetryPayload,
  ) => void;
};
