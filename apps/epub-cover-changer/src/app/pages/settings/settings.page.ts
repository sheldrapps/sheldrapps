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
  IonModal,
  IonButtons,
  IonButton,
  IonLoading,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { THEME_OPTIONS, ThemeService, type Theme } from '@sheldrapps/ui-theme';
import { PrivacyPolicySectionComponent } from '@sheldrapps/privacy-policy-kit';

import {
  Lang,
  LanguageService,
  LangOption,
  LANG_OPTIONS,
} from 'src/app/services/language.service';
import { ConsentService } from 'src/app/services/consent.service';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EccSettings } from 'src/app/settings/ecc-settings.schema';
import {
  LanguageRadioListComponent,
  restartForLanguageChange,
} from '@sheldrapps/i18n-kit';
import { TourService } from 'src/app/shared/tour/tour.service';
import { HOME_TOUR_ID } from 'src/app/shared/tour/home-tour.definition';
import { RatingService } from '@sheldrapps/rating-kit';

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
    IonModal,
    IonButtons,
    IonButton,
    IonLoading,
    LanguageRadioListComponent,
    PrivacyPolicySectionComponent,
  ],
})
export class SettingsPage {
  lang = inject(LanguageService);
  consent = inject(ConsentService);
  private theme = inject(ThemeService);

  private settings = inject(SettingsStore<EccSettings>);
  private router = inject(Router);
  private tour = inject(TourService);
  private ratingService = inject(RatingService);
  readonly supportedLangs = LANG_OPTIONS;
  readonly supportedThemes = THEME_OPTIONS;
  private isRestartingLanguage = false;
  isLanguageModalOpen = false;
  private _languageDraft: Lang | null = null;
  isLanguageRestartLoading = false;
  languageRestartCountdown = 4;
  private readonly languageRestartCountdownStart = 4;

  readonly privacyPolicyUrl =
    'https://sheldrapps.com/privacy-policies/epub-cover-changer';

  trackByLang = (_: number, l: LangOption) => l.code;

  get selectedLanguage(): Lang {
    return this.lang.lang as Lang;
  }

  get languageDraft(): Lang {
    return this._languageDraft ?? (this.lang.lang as Lang);
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
    this.isLanguageModalOpen = true;
    this._languageDraft = null;
  }

  closeLanguageModal() {
    this.isLanguageModalOpen = false;
  }

  onLanguageDraftChange(value: string) {
    const next = this.supportedLangs.find(
      (option) => option.code === value,
    )?.code;
    if (!next) {
      return;
    }

    this._languageDraft = next;
  }

  async confirmLanguageModal() {
    const nextLanguage = this.languageDraft;
    this._languageDraft = null;
    this.closeLanguageModal();
    await this.onLangChange(nextLanguage);
  }

  async onLangChange(v: Lang) {
    if (!v || v === this.lang.lang || this.isRestartingLanguage) {
      return;
    }

    this.isRestartingLanguage = true;

    try {
      await this.settings.setForScope('language', { language: v });
      await this.lang.set(v);
      await this.showLanguageRestartCountdown();
      await restartForLanguageChange(v, 500);
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
      // opcional: toast "Not available"
    }
  }

  async startHomeTour() {
    this.tour.requestManualStart(HOME_TOUR_ID);
    await this.router.navigateByUrl('/tabs/change');
  }

  async previewRatingPrompt(): Promise<void> {
    await this.ratingService.previewPrompt();
  }

  async previewRatingFeedback(): Promise<void> {
    await this.ratingService.previewFeedbackFlow();
  }

  private async showLanguageRestartCountdown() {
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
