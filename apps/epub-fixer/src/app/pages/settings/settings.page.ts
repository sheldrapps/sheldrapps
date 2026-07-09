import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LanguageRadioListComponent,
  restartForLanguageChange,
} from '@sheldrapps/i18n-kit';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonLoading,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { THEME_OPTIONS, ThemeService, type Theme } from '@sheldrapps/ui-theme';
import {
  LANG_OPTIONS,
  Lang,
  LangOption,
  LanguageService,
} from 'src/app/services/language.service';
import { EpubFixerSettings } from 'src/app/settings/epub-fixer-settings.schema';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonLoading,
    IonModal,
    IonTitle,
    IonToolbar,
    LanguageRadioListComponent,
  ],
})
export class SettingsPage {
  private readonly settings = inject(SettingsStore<EpubFixerSettings>);
  readonly lang = inject(LanguageService);
  private readonly theme = inject(ThemeService);

  readonly supportedLangs = LANG_OPTIONS;
  readonly supportedThemes = THEME_OPTIONS;

  isLanguageModalOpen = false;
  languageDraft: Lang = 'en-US';
  isLanguageRestartLoading = false;
  languageRestartCountdown = 4;

  private isRestartingLanguage = false;
  private readonly languageRestartCountdownStart = 4;

  get selectedLanguage(): Lang {
    return this.lang.lang as Lang;
  }

  get currentTheme(): Theme {
    return this.theme.currentTheme;
  }

  get currentThemeLabelKey(): string {
    return (
      this.supportedThemes.find((option) => option.code === this.currentTheme)
        ?.labelKey ?? 'SETTINGS.THEME_SYSTEM'
    );
  }

  get currentLanguageOption(): LangOption | undefined {
    return this.supportedLangs.find(
      (option) => option.code === this.selectedLanguage,
    );
  }

  openLanguageModal(): void {
    this.languageDraft = this.selectedLanguage;
    this.isLanguageModalOpen = true;
  }

  closeLanguageModal(): void {
    this.isLanguageModalOpen = false;
  }

  onLanguageDraftChange(value: string): void {
    const next = this.supportedLangs.find(
      (option) => option.code === value,
    )?.code;
    if (!next) {
      return;
    }

    this.languageDraft = next;
  }

  async confirmLanguageModal(): Promise<void> {
    const nextLanguage = this.languageDraft;
    this.closeLanguageModal();
    await this.onLangChange(nextLanguage);
  }

  async onLangChange(language: Lang): Promise<void> {
    if (!language || language === this.lang.lang || this.isRestartingLanguage) {
      return;
    }

    this.isRestartingLanguage = true;

    try {
      await this.settings.setForScope('language', { language });
      await this.lang.set(language);
      await this.showLanguageRestartCountdown();
      await restartForLanguageChange(language, 500);
    } finally {
      this.isLanguageRestartLoading = false;
      this.isRestartingLanguage = false;
    }
  }

  private async showLanguageRestartCountdown(): Promise<void> {
    this.languageRestartCountdown = this.languageRestartCountdownStart;
    this.isLanguageRestartLoading = true;
    await this.waitForLoadingToRender();

    for (
      let remaining = this.languageRestartCountdownStart;
      remaining >= 1;
      remaining--
    ) {
      this.languageRestartCountdown = remaining;
      await this.delay(1000);
    }
  }

  private async waitForLoadingToRender(): Promise<void> {
    if (typeof requestAnimationFrame !== 'function') {
      await this.delay(32);
      return;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
