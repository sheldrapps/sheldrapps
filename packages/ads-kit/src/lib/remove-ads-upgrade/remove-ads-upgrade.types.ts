export type RemoveAdsUpgradeVariant = 'PCM' | 'ECC' | 'CCFK' | 'EF';

export type RemoveAdsUpgradeBenefit = {
  icon: string;
  titleKey: string;
  descriptionKey: string;
};

export type RemoveAdsUpgradePresentation = {
  titleKey: string;
  introKey: string;
  trustLineKey: string;
  offlineTitleKey: string;
  offlineMessageKey: string;
  purchaseWithPriceKey: string;
  purchaseFallbackKey: string;
  restorePromptKey: string;
  restoreLabelKey: string;
  benefits: RemoveAdsUpgradeBenefit[];
};

