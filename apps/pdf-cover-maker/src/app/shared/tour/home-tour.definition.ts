import { TranslateService } from '@ngx-translate/core';

import type { TourDefinition } from './tour.types';

export const HOME_TOUR_ID = 'pcm-home-tour';
export const CURRENT_HOME_TOUR_VERSION = 4;

export function buildHomeTourDefinition(
  translate: TranslateService,
  opts?: { includeRemoveAdsStep?: boolean },
): TourDefinition {
  const t = (key: string) => translate.instant(key);
  const includeRemoveAdsStep = opts?.includeRemoveAdsStep === true;
  const totalSteps = includeRemoveAdsStep ? 10 : 8;

  const steps: TourDefinition['steps'] = [
    {
      id: 'pdf-picker',
      target: 'pdf-picker',
      title: t('HOME_TOUR.STEPS.PDF.TITLE'),
      description: t('HOME_TOUR.STEPS.PDF.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['pdf-selected'],
      progressCurrent: 1,
      progressTotal: totalSteps,
    },
    {
      id: 'cover-image-picker',
      target: 'cover-image-picker',
      title: t('HOME_TOUR.STEPS.IMAGE.TITLE'),
      description: t('HOME_TOUR.STEPS.IMAGE.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['cover-image-selected'],
      progressCurrent: 3,
      progressTotal: totalSteps,
    },
    {
      id: 'adjust-button',
      target: 'adjust-button',
      title: t('HOME_TOUR.STEPS.ADJUST.TITLE'),
      description: t('HOME_TOUR.STEPS.ADJUST.DESCRIPTION'),
      placement: 'top',
      advanceOn: ['editor-apply'],
      progressCurrent: 4,
      progressTotal: totalSteps,
    },
    {
      id: 'export-quality',
      target: 'export-quality',
      title: t('HOME_TOUR.STEPS.EXPORT.TITLE'),
      description: t('HOME_TOUR.STEPS.EXPORT.DESCRIPTION'),
      placement: 'top',
      advanceOn: ['export-quality-select'],
      progressCurrent: 5,
      progressTotal: totalSteps,
    },
    {
      id: 'create-button',
      target: 'create-button',
      title: t('HOME_TOUR.STEPS.CREATE.TITLE'),
      description: includeRemoveAdsStep
        ? t('CHANGE.CHANGE_ACTION_REWARDED')
        : t('HOME_TOUR.STEPS.CREATE.DESCRIPTION'),
      placement: 'top',
      advanceOn: ['cover-created'],
      progressCurrent: 6,
      progressTotal: totalSteps,
    },
  ];

  steps.splice(1, 0, {
    id: 'cover-page-mode',
    target: 'cover-page-mode',
    title: t('HOME_TOUR.STEPS.COVER_MODE.TITLE'),
    description: t('HOME_TOUR.STEPS.COVER_MODE.DESCRIPTION'),
    placement: 'bottom',
    advanceOn: ['cover-mode-selected'],
    progressCurrent: 2,
    progressTotal: totalSteps,
  });

  if (includeRemoveAdsStep) {
    steps.push({
      id: 'remove-ads-cta',
      target: 'remove-ads-cta',
      title: t('COMMON.REMOVE_ADS_TITLE'),
      description: t('COMMON.REMOVE_ADS_DESCRIPTION'),
      placement: 'top',
      advanceOn: ['remove-ads-open'],
      progressCurrent: 7,
      progressTotal: totalSteps,
    });
    steps.push({
      id: 'remove-ads-close',
      target: 'remove-ads-close',
      title: t('HOME_TOUR.STEPS.REMOVE_ADS_CLOSE.TITLE'),
      description: t('HOME_TOUR.STEPS.REMOVE_ADS_CLOSE.DESCRIPTION'),
      placement: 'bottom',
      advanceOn: ['remove-ads-close'],
      progressCurrent: 8,
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
    progressCurrent: includeRemoveAdsStep ? 10 : 8,
    progressTotal: totalSteps,
  });

  return {
    id: HOME_TOUR_ID,
    version: CURRENT_HOME_TOUR_VERSION,
    steps,
  };
}
