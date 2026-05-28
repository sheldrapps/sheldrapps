import { TranslateService } from '@ngx-translate/core';

import type { TourDefinition } from './tour.types';

export const HOME_TOUR_ID = 'ccfk-home-tour';
export const CURRENT_HOME_TOUR_VERSION = 7;

export function buildHomeTourDefinition(
  translate: TranslateService,
  opts?: { includeRemoveAdsStep?: boolean },
): TourDefinition {
  const t = (key: string) => translate.instant(key);
  const includeRemoveAdsStep = opts?.includeRemoveAdsStep === true;
  const totalSteps = includeRemoveAdsStep ? 11 : 9;

  const steps: TourDefinition['steps'] = [
    {
      id: 'brand-select',
      target: 'brand-select',
      title: t('HOME_TOUR.STEPS.BRAND.TITLE'),
      description: t('HOME_TOUR.STEPS.BRAND.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['brand-select'],
      progressCurrent: 1,
      progressTotal: totalSteps,
    },
    {
      id: 'group-select',
      target: 'group-select',
      title: t('HOME_TOUR.STEPS.GROUP.TITLE'),
      description: t('HOME_TOUR.STEPS.GROUP.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['group-select'],
      progressCurrent: 2,
      progressTotal: totalSteps,
    },
    {
      id: 'model-select',
      target: 'model-select',
      title: t('HOME_TOUR.STEPS.MODEL.TITLE'),
      description: t('HOME_TOUR.STEPS.MODEL.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['model-select'],
      progressCurrent: 3,
      progressTotal: totalSteps,
    },
    {
      id: 'cover-image-picker',
      target: 'cover-image-picker',
      title: t('HOME_TOUR.STEPS.IMAGE.TITLE'),
      description: t('HOME_TOUR.STEPS.IMAGE.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['cover-image-selected'],
      progressCurrent: 4,
      progressTotal: totalSteps,
    },
    {
      id: 'adjust-button',
      target: 'adjust-button',
      title: t('HOME_TOUR.STEPS.ADJUST.TITLE'),
      description: t('HOME_TOUR.STEPS.ADJUST.DESCRIPTION'),
      placement: 'top',
      advanceOn: ['editor-apply'],
      progressCurrent: 5,
      progressTotal: totalSteps,
    },
    {
      id: 'export-quality',
      target: 'export-quality',
      title: t('HOME_TOUR.STEPS.EXPORT.TITLE'),
      description: t('HOME_TOUR.STEPS.EXPORT.DESCRIPTION'),
      placement: 'top',
      advanceOn: ['export-quality-select'],
      progressCurrent: 6,
      progressTotal: totalSteps,
    },
    {
      id: 'create-button',
      target: 'create-button',
      title: t('HOME_TOUR.STEPS.CREATE.TITLE'),
      description: includeRemoveAdsStep
        ? t('CREATE.CREATE_ACTION_REWARDED')
        : t('HOME_TOUR.STEPS.CREATE.DESCRIPTION'),
      placement: 'top',
      advanceOn: ['cover-created'],
      progressCurrent: 7,
      progressTotal: totalSteps,
    },
  ];

  if (includeRemoveAdsStep) {
    steps.push({
      id: 'remove-ads-cta',
      target: 'remove-ads-cta',
      title: t('COMMON.REMOVE_ADS_TITLE'),
      description: t('COMMON.REMOVE_ADS_DESCRIPTION'),
      placement: 'top',
      advanceOn: ['remove-ads-open'],
      progressCurrent: 8,
      progressTotal: totalSteps,
    });
    steps.push({
      id: 'remove-ads-close',
      target: 'remove-ads-close',
      title: t('HOME_TOUR.STEPS.REMOVE_ADS_CLOSE.TITLE'),
      description: t('HOME_TOUR.STEPS.REMOVE_ADS_CLOSE.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['remove-ads-close'],
      progressCurrent: 9,
      progressTotal: totalSteps,
    });
  }

  steps.push({
    id: 'result-actions',
    target: 'result-actions',
    title: t('HOME_TOUR.STEPS.RESULTS.TITLE'),
    description: t('HOME_TOUR.STEPS.RESULTS.DESCRIPTION'),
    placement: 'top',
    showFinish: true,
    progressCurrent: includeRemoveAdsStep ? 11 : 9,
    progressTotal: totalSteps,
  });

  return {
    id: HOME_TOUR_ID,
    version: CURRENT_HOME_TOUR_VERSION,
    steps,
  };
}
