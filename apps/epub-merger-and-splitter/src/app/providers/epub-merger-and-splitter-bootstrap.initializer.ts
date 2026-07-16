import { APP_INITIALIZER, inject, makeEnvironmentProviders } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { detectSupportedLocale, LanguageService } from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EdgeToEdgeService, ThemeService } from '@sheldrapps/ui-theme';
import { EpubMergerAndSplitterSettings } from '../settings/epub-merger-and-splitter-settings.schema';

export function provideEpubMergerAndSplitterBootstrapInitializer() {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const settings = inject(SettingsStore<EpubMergerAndSplitterSettings>);
        const lang = inject(LanguageService);
        const edgeToEdge = inject(EdgeToEdgeService);
        const theme = inject(ThemeService);
        const translate = inject(TranslateService);

        return async () => {
          await edgeToEdge.initEdgeToEdge();
          const currentSettings = await settings.load();
          const storedLanguage = currentSettings.language;
          const language = storedLanguage ?? (await detectSupportedLocale());

          translate.setDefaultLang('en-US');

          if (!storedLanguage) {
            await settings.setForScope('language', { language });
          }

          await lang.set(language);
          await theme.initialize();
        };
      },
    },
  ]);
}
