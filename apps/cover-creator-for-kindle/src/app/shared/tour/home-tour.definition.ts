import { TranslateService } from '@ngx-translate/core';

import type { TourDefinition } from './tour.types';

export const HOME_TOUR_ID = 'ccfk-home-tour';
export const CURRENT_HOME_TOUR_VERSION = 4;

export function buildHomeTourDefinition(
  translate: TranslateService
): TourDefinition {
  const t = (key: string) => translate.instant(key);

  return {
    id: HOME_TOUR_ID,
    version: CURRENT_HOME_TOUR_VERSION,
    steps: [
      {
        id: 'brand-select',
        target: 'brand-select',
        title: t('HOME_TOUR.STEPS.BRAND.TITLE'),
        description: t('HOME_TOUR.STEPS.BRAND.DESCRIPTION'),
        placement: 'bottom',
        advanceOn: ['brand-select'],
        progressCurrent: 1,
        progressTotal: 8,
      },
      {
        id: 'group-select',
        target: 'group-select',
        title: t('HOME_TOUR.STEPS.GROUP.TITLE'),
        description: t('HOME_TOUR.STEPS.GROUP.DESCRIPTION'),
        placement: 'bottom',
        advanceOn: ['group-select'],
        progressCurrent: 2,
        progressTotal: 8,
      },
      {
        id: 'model-select',
        target: 'model-select',
        title: t('HOME_TOUR.STEPS.MODEL.TITLE'),
        description: t('HOME_TOUR.STEPS.MODEL.DESCRIPTION'),
        placement: 'bottom',
        advanceOn: ['model-select'],
        progressCurrent: 3,
        progressTotal: 8,
      },
      {
        id: 'cover-image-picker',
        target: 'cover-image-picker',
        title: t('HOME_TOUR.STEPS.IMAGE.TITLE'),
        description: t('HOME_TOUR.STEPS.IMAGE.DESCRIPTION'),
        placement: 'bottom',
        advanceOn: ['cover-image-selected'],
        progressCurrent: 4,
        progressTotal: 8,
      },
      {
        id: 'adjust-button',
        target: 'adjust-button',
        title: t('HOME_TOUR.STEPS.ADJUST.TITLE'),
        description: t('HOME_TOUR.STEPS.ADJUST.DESCRIPTION'),
        placement: 'top',
        advanceOn: ['editor-apply'],
        progressCurrent: 5,
        progressTotal: 8,
      },
      {
        id: 'create-button',
        target: 'create-button',
        title: t('HOME_TOUR.STEPS.CREATE.TITLE'),
        description: t('HOME_TOUR.STEPS.CREATE.DESCRIPTION'),
        placement: 'top',
        advanceOn: ['cover-created'],
        progressCurrent: 7,
        progressTotal: 8,
      },
      {
        id: 'result-actions',
        target: 'result-actions',
        title: t('HOME_TOUR.STEPS.RESULTS.TITLE'),
        description: t('HOME_TOUR.STEPS.RESULTS.DESCRIPTION'),
        placement: 'top',
        showFinish: true,
        progressCurrent: 8,
        progressTotal: 8,
      },
    ],
  };
}
