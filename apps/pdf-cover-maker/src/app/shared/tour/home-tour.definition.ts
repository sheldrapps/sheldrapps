import { TranslateService } from '@ngx-translate/core';

import type { TourDefinition } from './tour.types';

export const HOME_TOUR_ID = 'ecc-home-tour';
export const CURRENT_HOME_TOUR_VERSION = 1;

export function buildHomeTourDefinition(
  translate: TranslateService
): TourDefinition {
  const t = (key: string) => translate.instant(key);

  return {
    id: HOME_TOUR_ID,
    version: CURRENT_HOME_TOUR_VERSION,
    steps: [
      {
        id: 'pdf-picker',
        target: 'pdf-picker',
        title: t('HOME_TOUR.STEPS.PDF.TITLE'),
        description: t('HOME_TOUR.STEPS.PDF.DESCRIPTION'),
        placement: 'bottom',
        advanceOn: ['pdf-selected'],
        progressCurrent: 1,
        progressTotal: 6,
      },
      {
        id: 'cover-image-picker',
        target: 'cover-image-picker',
        title: t('HOME_TOUR.STEPS.IMAGE.TITLE'),
        description: t('HOME_TOUR.STEPS.IMAGE.DESCRIPTION'),
        placement: 'bottom',
        advanceOn: ['cover-image-selected'],
        progressCurrent: 2,
        progressTotal: 6,
      },
      {
        id: 'adjust-button',
        target: 'adjust-button',
        title: t('HOME_TOUR.STEPS.ADJUST.TITLE'),
        description: t('HOME_TOUR.STEPS.ADJUST.DESCRIPTION'),
        placement: 'top',
        advanceOn: ['editor-apply'],
        progressCurrent: 3,
        progressTotal: 6,
      },
      {
        id: 'create-button',
        target: 'create-button',
        title: t('HOME_TOUR.STEPS.CREATE.TITLE'),
        description: t('HOME_TOUR.STEPS.CREATE.DESCRIPTION'),
        placement: 'top',
        advanceOn: ['cover-created'],
        progressCurrent: 5,
        progressTotal: 6,
      },
      {
        id: 'result-actions',
        target: 'result-actions',
        title: t('HOME_TOUR.STEPS.RESULTS.TITLE'),
        description: t('HOME_TOUR.STEPS.RESULTS.DESCRIPTION'),
        placement: 'top',
        showFinish: true,
        progressCurrent: 6,
        progressTotal: 6,
      },
    ],
  };
}
