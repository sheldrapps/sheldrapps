import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  LanguageService,
  detectSupportedLocale,
} from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import {
  NextStepSettings,
  NextStepTheme,
  PreferenceValue,
} from '../app/settings/next-step-settings.schema';
import { Lang } from '../app/services/language.service';
import { ThemeService } from '../app/services/theme.service';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly settings = inject(SettingsStore<NextStepSettings>);
  private readonly languageService = inject(LanguageService);
  private readonly translateService = inject(TranslateService);
  private readonly themeService = inject(ThemeService);

  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.settings.load();

    const current = this.settings.get();
    const language = current.language ?? (await detectSupportedLocale('en-US'));
    const userPreferences = current.userPreferences ?? {};

    this.translateService.setDefaultLang('en-US');
    await this.themeService.initialize();
    await this.languageService.set(language);

    await this.settings.set({
      language,
      theme: this.themeService.currentTheme,
      userPreferences,
    });

    this.initialized = true;
  }

  async setLanguage(language: Lang): Promise<void> {
    await this.languageService.set(language);
    await this.settings.set({ language });
  }

  async setTheme(theme: NextStepTheme): Promise<void> {
    await this.themeService.setTheme(theme);
  }

  async setUserPreference(key: string, value: PreferenceValue): Promise<void> {
    await this.settings.set((prev) => ({
      ...prev,
      userPreferences: {
        ...prev.userPreferences,
        [key]: value,
      },
    }));
  }

  snapshot(): NextStepSettings {
    return this.settings.get();
  }
}
