import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonLoading,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { colorPaletteOutline } from 'ionicons/icons';
import {
  SelectableButtonListComponent,
  type SelectableButtonListItem,
  ThemeService,
  UiThemeI18nService,
  type Theme,
} from '@sheldrapps/ui-theme';
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
    TranslateModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonLoading,
    IonModal,
    IonTitle,
    IonToolbar,
    SelectableButtonListComponent,
    PrivacyPolicySectionComponent,
    LanguageRadioListComponent,
  ],
})
export class SettingsPage {
  lang = inject(LanguageService);
  consent = inject(ConsentService);
  private theme = inject(ThemeService);
  private uiThemeI18n = inject(UiThemeI18nService);

  private settings = inject(SettingsStore<EccSettings>);
  private router = inject(Router);
  private tour = inject(TourService);
  private ratingService = inject(RatingService);
  readonly supportedLangs = LANG_OPTIONS;
  private isRestartingLanguage = false;
  isLanguageModalOpen = false;
  private _languageDraft: Lang | null = null;
  isLanguageRestartLoading = false;
  languageRestartCountdown = 4;
  private readonly languageRestartCountdownStart = 4;

  readonly privacyPolicyUrl =
    'https://sheldrapps.com/privacy-policies/epub-cover-changer';

  constructor() {
    addIcons({
      colorPaletteOutline,
    });
  }

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

  get currentThemeLabel(): string {
    return this.uiThemeI18n.getThemeLabel(this.currentTheme);
  }

  get currentLanguageOption(): LangOption | undefined {
    return this.supportedLangs.find(
      (option) => option.code === this.selectedLanguage,
    );
  }

  get languageSettingsItems(): SelectableButtonListItem[] {
    const currentLanguage = this.currentLanguageOption;

    return [
      {
        value: 'language',
        titleKey: 'LANGUAGE_SETTINGS.TITLE',
        sublineKey: currentLanguage?.labelKey,
        leadingIconClass: currentLanguage
          ? ['app-language-option__flag', currentLanguage.flagClass]
          : undefined,
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'LANGUAGE_SETTINGS.TITLE',
      },
    ];
  }

  get themeSettingsItems(): SelectableButtonListItem[] {
    return [
      {
        value: 'theme',
        title: this.uiThemeI18n.texts().UI_THEME.THEME_SETTINGS.TITLE,
        subline: this.currentThemeLabel,
        leadingIconName: 'color-palette-outline',
        trailingIconName: 'chevron-forward-outline',
        ariaLabel: this.uiThemeI18n.texts().UI_THEME.THEME_SETTINGS.TITLE,
      },
    ];
  }

  get privacyOptionsItems(): SelectableButtonListItem[] {
    return [
      {
        value: 'privacy-options',
        titleKey: 'SETTINGS.PRIVACY_OPTIONS',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'SETTINGS.PRIVACY_OPTIONS',
      },
    ];
  }

  get ratingSettingsItems(): SelectableButtonListItem[] {
    return [
      {
        value: 'rating-prompt',
        titleKey: 'RATING.DEBUG.PREVIEW_PROMPT',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'RATING.DEBUG.PREVIEW_PROMPT',
      },
      {
        value: 'rating-suggestions',
        titleKey: 'RATING.DEBUG.PREVIEW_SUGGESTIONS',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'RATING.DEBUG.PREVIEW_SUGGESTIONS',
      },
      {
        value: 'rating-feedback',
        titleKey: 'RATING.DEBUG.PREVIEW_FEEDBACK',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'RATING.DEBUG.PREVIEW_FEEDBACK',
      },
    ];
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

  async previewRatingSuggestions(): Promise<void> {
    await this.ratingService.previewSuggestionFlow();
  }

  async previewRatingFeedback(): Promise<void> {
    await this.ratingService.previewFeedbackFlow();
  }

  onLanguageSettingsAction(): void {
    this.openLanguageModal();
  }

  onThemeSettingsAction(): void {
    void this.router.navigateByUrl('/tabs/settings/theme');
  }

  onPrivacyOptionsAction(): void {
    void this.openPrivacyOptions();
  }

  async onRatingSettingsAction(value: string): Promise<void> {
    if (value === 'rating-prompt') {
      await this.previewRatingPrompt();
      return;
    }

    if (value === 'rating-suggestions') {
      await this.previewRatingSuggestions();
      return;
    }

    if (value === 'rating-feedback') {
      await this.previewRatingFeedback();
    }
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
