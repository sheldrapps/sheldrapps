import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { wireBestCandidateKitTranslations } from './best-candidate-kit-i18n';

export function provideBestCandidateKitI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        try {
          wireBestCandidateKitTranslations(translate);
        } catch (err) {
          console.warn(
            '[best-candidate-kit] Failed to register best candidate translations:',
            err,
          );
        }
      },
    },
  ]);
}
