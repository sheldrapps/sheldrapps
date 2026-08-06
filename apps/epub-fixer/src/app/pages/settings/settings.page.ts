import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  LanguageRadioListComponent,
  restartForLanguageChange,
} from '@sheldrapps/i18n-kit';
import { PrivacyPolicySectionComponent } from '@sheldrapps/privacy-policy-kit';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonButtons,
  IonTitle,
  IonToolbar,
  IonIcon,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  colorPaletteOutline,
  sparklesOutline,
} from 'ionicons/icons';
import {
  BillingService,
  RemoveAdsPurchasePageService,
} from '@sheldrapps/ads-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { RatingService } from '@sheldrapps/rating-kit';
import {
  SelectableButtonListComponent,
  SpinnerComponent,
  type SelectableButtonListItem,
  ThemeService,
  UiThemeI18nService,
  type Theme,
} from '@sheldrapps/ui-theme';
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
    TranslateModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    SpinnerComponent,
    IonModal,
    IonIcon,
    IonTitle,
    IonToolbar,
    SelectableButtonListComponent,
    LanguageRadioListComponent,
    PrivacyPolicySectionComponent,
  ],
})
export class SettingsPage {
  private readonly settings = inject(SettingsStore<EpubFixerSettings>);
  private readonly billing = inject(BillingService);
  readonly lang = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly removeAdsPurchasePage = inject(RemoveAdsPurchasePageService);
  private readonly theme = inject(ThemeService);
  private readonly uiThemeI18n = inject(UiThemeI18nService);
  private readonly ratingService = inject(RatingService);
  readonly adsRemoved = toSignal(this.billing.adsRemoved$, {
    initialValue: this.billing.isAdsRemoved(),
  });

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      colorPaletteOutline,
      sparklesOutline,
    });
  }

  readonly supportedLangs = LANG_OPTIONS;
  readonly privacyPolicyUrl =
    'https://sheldrapps.com/privacy-policies/epub-fixer';

  isLanguageModalOpen = false;
  languageDraft: Lang = 'en-US';
  private readonly languageRestartLoadingState = signal(false);
  private readonly languageRestartCountdownState = signal(4);

  get isLanguageRestartLoading(): boolean {
    return this.languageRestartLoadingState();
  }

  set isLanguageRestartLoading(value: boolean) {
    this.languageRestartLoadingState.set(value);
  }

  get languageRestartCountdown(): number {
    return this.languageRestartCountdownState();
  }

  set languageRestartCountdown(value: number) {
    this.languageRestartCountdownState.set(value);
  }

  private isRestartingLanguage = false;
  private readonly languageRestartCountdownStart = 4;

  get selectedLanguage(): Lang {
    return this.lang.lang as Lang;
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
        subline: currentLanguage?.label ?? this.selectedLanguage,
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

  get removeAdsSettingsItems(): SelectableButtonListItem[] {
    return [
      {
        value: 'remove-ads',
        titleKey: 'COMMON.UPGRADE_TO_PRO',
        sublineKey: 'COMMON.REMOVE_ADS_CTA_SUBTITLE',
        leadingIconSvg: 'pro-badge',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'COMMON.UPGRADE_TO_PRO',
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

  openLanguageModal(): void {
    this.languageDraft = this.selectedLanguage;
    this.isLanguageModalOpen = true;
  }

  openThemeSettings(): void {
    void this.router.navigateByUrl('/tabs/settings/theme');
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
    this.openThemeSettings();
  }

  onRemoveAdsSettingsAction(): void {
    this.removeAdsPurchasePage.open({
      variant: 'EF',
      returnUrl: '/tabs/fix-page',
    });
    void this.router.navigateByUrl('/remove-ads');
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
