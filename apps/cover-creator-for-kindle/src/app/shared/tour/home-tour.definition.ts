import { TranslateService } from '@ngx-translate/core';

import type { TourDefinition } from './tour.types';

export const HOME_TOUR_ID = 'ccfk-home-tour';
export const CURRENT_HOME_TOUR_VERSION = 9;

export function buildHomeTourDefinition(
  translate: TranslateService,
  opts?: { includeDeviceSummaryStep?: boolean; includeRemoveAdsStep?: boolean },
): TourDefinition {
  const t = (key: string) => translate.instant(key);
  const includeDeviceSummaryStep = opts?.includeDeviceSummaryStep === true;
  const includeRemoveAdsStep = opts?.includeRemoveAdsStep === true;
  const totalSteps =
    (includeRemoveAdsStep ? 9 : 7) + (includeDeviceSummaryStep ? 1 : 0);
  const selectionStepStart = includeDeviceSummaryStep ? 2 : 1;
  const selectionStepOffset = selectionStepStart - 1;

  const steps: TourDefinition['steps'] = [];

  if (includeDeviceSummaryStep) {
    steps.push({
      id: 'device-summary',
      target: 'device-section',
      title: t('HOME_TOUR.STEPS.DEVICE.TITLE'),
      description: t('HOME_TOUR.STEPS.DEVICE.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['device-edit'],
      progressCurrent: 1,
      progressTotal: totalSteps,
    });
  }

  steps.push(
    {
      id: 'brand-select',
      target: 'brand-select',
      title: t('HOME_TOUR.STEPS.BRAND.TITLE'),
      description: t('HOME_TOUR.STEPS.BRAND.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['brand-select'],
      progressCurrent: selectionStepStart,
      progressTotal: totalSteps,
    },
    {
      id: 'group-select',
      target: 'group-select',
      title: t('HOME_TOUR.STEPS.GROUP.TITLE'),
      description: t('HOME_TOUR.STEPS.GROUP.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['group-select'],
      progressCurrent: 2 + selectionStepOffset,
      progressTotal: totalSteps,
    },
    {
      id: 'model-select',
      target: 'model-select',
      title: t('HOME_TOUR.STEPS.MODEL.TITLE'),
      description: t('HOME_TOUR.STEPS.MODEL.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['model-select'],
      progressCurrent: 3 + selectionStepOffset,
      progressTotal: totalSteps,
    },
    {
      id: 'cover-source-actions',
      target: 'cover-source-actions',
      title: t('HOME_TOUR.STEPS.IMAGE.TITLE'),
      description: t('HOME_TOUR.STEPS.IMAGE.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['cover-image-selected'],
      progressCurrent: 4 + selectionStepOffset,
      progressTotal: totalSteps,
    },
    {
      id: 'adjust-button',
      target: 'adjust-button',
      title: t('HOME_TOUR.STEPS.ADJUST.TITLE'),
      description: t('HOME_TOUR.STEPS.ADJUST.DESCRIPTION'),
      placement: 'top',
      advanceOn: ['editor-apply'],
      progressCurrent: 5 + selectionStepOffset,
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
      progressCurrent: 6 + selectionStepOffset,
      progressTotal: totalSteps,
    },
  );

  if (includeRemoveAdsStep) {
    steps.push({
      id: 'remove-ads-cta',
      target: 'remove-ads-cta',
      title: t('COMMON.REMOVE_ADS_TITLE'),
      description: t('COMMON.REMOVE_ADS_DESCRIPTION'),
      placement: 'top',
      advanceOn: ['remove-ads-open'],
      progressCurrent: 7 + selectionStepOffset,
      progressTotal: totalSteps,
    });
    steps.push({
      id: 'remove-ads-close',
      target: 'remove-ads-close',
      title: t('HOME_TOUR.STEPS.REMOVE_ADS_CLOSE.TITLE'),
      description: t('HOME_TOUR.STEPS.REMOVE_ADS_CLOSE.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['remove-ads-close'],
      progressCurrent: 8 + selectionStepOffset,
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
    progressCurrent: includeRemoveAdsStep
      ? 9 + selectionStepOffset
      : 7 + selectionStepOffset,
    progressTotal: totalSteps,
  });

  return {
    id: HOME_TOUR_ID,
    version: CURRENT_HOME_TOUR_VERSION,
    steps,
  };
}
