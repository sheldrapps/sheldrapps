import { APP_INITIALIZER, inject, makeEnvironmentProviders } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { detectSupportedLocale, LanguageService } from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EpubMergerAndSplitterSettings } from '../settings/epub-merger-and-splitter-settings.schema';

export function provideEpubMergerAndSplitterLanguageInitializer() {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const settings = inject(SettingsStore<EpubMergerAndSplitterSettings>);
        const lang = inject(LanguageService);
        const translate = inject(TranslateService);

        return async () => {
          const currentSettings = await settings.load();
          const storedLanguage = currentSettings.language;
          const language = storedLanguage ?? (await detectSupportedLocale());

          translate.setDefaultLang('en-US');

          if (!storedLanguage) {
            await settings.setForScope('language', { language });
          }

          await lang.set(language);
        };
      },
    },
  ]);
}
