import type {
  RemoveAdsUpgradePresentation,
  RemoveAdsUpgradeVariant,
} from './remove-ads-upgrade.types';

const BASE = 'REMOVE_ADS_UPGRADE';
type RemoveAdsUpgradeCopyVariant = Exclude<RemoveAdsUpgradeVariant, 'EMAS'>;

function getCopyVariant(
  variant: RemoveAdsUpgradeVariant,
): RemoveAdsUpgradeCopyVariant {
  return variant === 'EMAS' ? 'ECC' : variant;
}

export function buildRemoveAdsUpgradePresentation(
  variant: RemoveAdsUpgradeVariant,
): RemoveAdsUpgradePresentation {
  const copyVariant = getCopyVariant(variant);
  const introKey =
    copyVariant === 'CCFK' || copyVariant === 'EF'
      ? `${BASE}.TITLE.${copyVariant}.INTRO`
      : `${BASE}.INTRO`;

  return {
    titleKey: `${BASE}.TITLE.${copyVariant}.TITLE`,
    introKey,
    trustLineKey: `${BASE}.TRUST_LINE`,
    offlineTitleKey: `${BASE}.OFFLINE_TITLE`,
    offlineMessageKey: `${BASE}.OFFLINE_MESSAGE`,
    purchaseWithPriceKey: `${BASE}.PURCHASE.WITH_PRICE`,
    purchaseFallbackKey: `${BASE}.PURCHASE.FALLBACK`,
    restorePromptKey: `${BASE}.RESTORE_PROMPT`,
    restoreLabelKey: `${BASE}.RESTORE_LABEL`,
    benefits: buildBenefits(copyVariant),
  };
}

function buildBenefits(
  variant: RemoveAdsUpgradeCopyVariant,
): RemoveAdsUpgradePresentation['benefits'] {
  switch (variant) {
    case 'PCM':
    case 'ECC':
      return [
        {
          icon: 'flash-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.ONE.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.ONE.DESCRIPTION`,
        },
        {
          icon: 'sparkles-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.TWO.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.TWO.DESCRIPTION`,
        },
        {
          icon: 'shield-checkmark-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.THREE.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.THREE.DESCRIPTION`,
        },
      ];
    case 'CCFK':
      return [
        {
          icon: 'time-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.ONE.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.ONE.DESCRIPTION`,
        },
        {
          icon: 'sparkles-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.TWO.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.TWO.DESCRIPTION`,
        },
        {
          icon: 'cloud-offline-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.THREE.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.THREE.DESCRIPTION`,
        },
      ];
    case 'EF':
      return [
        {
          icon: 'time-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.ONE.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.ONE.DESCRIPTION`,
        },
        {
          icon: 'cloud-offline-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.TWO.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.TWO.DESCRIPTION`,
        },
        {
          icon: 'shield-checkmark-outline',
          titleKey: `${BASE}.TITLE.${variant}.BENEFITS.THREE.TITLE`,
          descriptionKey: `${BASE}.TITLE.${variant}.BENEFITS.THREE.DESCRIPTION`,
        },
      ];
    default:
      throw new Error(`Unsupported remove ads upgrade variant: ${variant}`);
  }
}
