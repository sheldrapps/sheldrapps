import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonRadio,
  IonRadioGroup,
  IonModal,
  IonButtons,
  IonButton,
  IonLoading,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { THEME_OPTIONS, ThemeService, type Theme } from '@sheldrapps/ui-theme';

import {
  Lang,
  LanguageService,
  LangOption,
  LANG_OPTIONS,
} from 'src/app/services/language.service';
import { ConsentService } from 'src/app/services/consent.service';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { CcfkSettings } from 'src/app/settings/ccfk-settings.schema';
import { Browser } from '@capacitor/browser';
import { restartForLanguageChange } from '@sheldrapps/i18n-kit';
import { TourService } from 'src/app/shared/tour/tour.service';
import { HOME_TOUR_ID } from 'src/app/shared/tour/home-tour.definition';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonRadio,
    IonRadioGroup,
    IonModal,
    IonButtons,
    IonButton,
    IonLoading,
  ],
})
export class SettingsPage {
  private settings = inject(SettingsStore<CcfkSettings>);
  private router = inject(Router);
  private tour = inject(TourService);
  public lang = inject(LanguageService);
  public consent = inject(ConsentService);
  private theme = inject(ThemeService);
  readonly supportedLangs = LANG_OPTIONS;
  readonly supportedThemes = THEME_OPTIONS;
  private isRestartingLanguage = false;
  isLanguageModalOpen = false;
  languageDraft: Lang = 'en-US';
  isLanguageRestartLoading = false;
  languageRestartCountdown = 3;
  private readonly languageRestartCountdownStart = 3;

  private readonly privacyPolicyUrl =
    'https://sheldrapps.github.io/privacy-policies/cover-creator-for-kindle/';

  trackByLang = (_: number, l: LangOption) => l.code;

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

  openLanguageModal() {
    this.languageDraft = this.selectedLanguage;
    this.isLanguageModalOpen = true;
  }

  closeLanguageModal() {
    this.isLanguageModalOpen = false;
  }

  onLanguageDraftChange(value: Lang) {
    this.languageDraft = value;
  }

  async confirmLanguageModal() {
    const nextLanguage = this.languageDraft;
    this.closeLanguageModal();
    await this.onLangChange(nextLanguage);
  }

  async onLangChange(v: Lang) {
    if (!v || v === this.lang.lang || this.isRestartingLanguage) {
      return;
    }

    this.isRestartingLanguage = true;

    try {
      await this.settings.set({ language: v });
      await this.lang.set(v);
      await this.showLanguageRestartCountdown();
      await restartForLanguageChange(v, 0);
    } finally {
      this.isLanguageRestartLoading = false;
      this.isRestartingLanguage = false;
    }
  }

  async onThemeChange(theme: Theme): Promise<void> {
    await this.theme.setTheme(theme);
  }

  async openPrivacyOptions() {
    const opened = await this.consent.showPrivacyOptionsIfAvailable();
    if (!opened) {
    }
  }

  async openPrivacyPolicy() {
    await Browser.open({ url: this.privacyPolicyUrl });
  }

  async startHomeTour() {
    this.tour.requestManualStart(HOME_TOUR_ID);
    await this.router.navigateByUrl('/tabs/create');
  }

  private async showLanguageRestartCountdown() {
    this.languageRestartCountdown = this.languageRestartCountdownStart;
    this.isLanguageRestartLoading = true;
    await this.waitForLoadingToRender();

    for (
      let remaining = this.languageRestartCountdownStart;
      remaining > 1;
      remaining--
    ) {
      await this.delay(1000);
      this.languageRestartCountdown = remaining - 1;
    }

    await this.delay(1000);
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
