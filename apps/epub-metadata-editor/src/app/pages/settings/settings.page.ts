import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  BillingService,
  RemoveAdsPurchasePageService,
} from '@sheldrapps/ads-kit';
import { PrivacyPolicySectionComponent } from '@sheldrapps/privacy-policy-kit';
import {
  LanguageRadioListComponent,
  restartForLanguageChange,
} from '@sheldrapps/i18n-kit';
import { RatingService } from '@sheldrapps/rating-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import {
  SelectableButtonListComponent,
  SpinnerComponent,
  ThemeService,
  UiThemeI18nService,
  type SelectableButtonListItem,
  type Theme,
} from '@sheldrapps/ui-theme';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, colorPaletteOutline } from 'ionicons/icons';
import type { EpubMetadataEditorSettings } from '../../settings/epub-metadata-editor-settings.schema';
import { ConsentService } from '../../services/consent.service';
import {
  LANG_OPTIONS,
  LanguageService,
  type LangOption,
  type SupportedLocale,
} from '../../services/language.service';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.page.html',
  imports: [
    CommonModule,
    TranslateModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonTitle,
    IonToolbar,
    LanguageRadioListComponent,
    PrivacyPolicySectionComponent,
    SelectableButtonListComponent,
    SpinnerComponent,
  ],
})
export class SettingsPage {
  private readonly settings = inject(SettingsStore<EpubMetadataEditorSettings>);
  private readonly billing = inject(BillingService);
  readonly consent = inject(ConsentService);
  private readonly removeAdsPurchasePage = inject(RemoveAdsPurchasePageService);
  private readonly rating = inject(RatingService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly themeI18n = inject(UiThemeI18nService);
  readonly language = inject(LanguageService);
  readonly adsRemoved = toSignal(this.billing.adsRemoved$, {
    initialValue: this.billing.isAdsRemoved(),
  });

  readonly supportedLanguages = LANG_OPTIONS;
  readonly languageLoading = signal(false);
  readonly languageCountdown = signal(4);
  languageModalOpen = false;
  languageDraft: SupportedLocale = 'en-US';
  private restartingLanguage = false;
  readonly privacyPolicyUrl =
    'https://sheldrapps.com/privacy-policies/epub-metadata-editor';

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, colorPaletteOutline });
  }

  get selectedLanguage(): SupportedLocale {
    return this.language.lang as SupportedLocale;
  }

  get selectedLanguageOption(): LangOption | undefined {
    return this.supportedLanguages.find((option) => option.code === this.selectedLanguage);
  }

  get currentTheme(): Theme {
    return this.theme.currentTheme;
  }

  get languageItems(): SelectableButtonListItem[] {
    return [
      {
        value: 'language',
        titleKey: 'LANGUAGE_SETTINGS.TITLE',
        sublineKey: this.selectedLanguageOption?.labelKey,
        leadingIconClass: this.selectedLanguageOption
          ? ['app-language-option__flag', this.selectedLanguageOption.flagClass]
          : undefined,
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'LANGUAGE_SETTINGS.TITLE',
      },
    ];
  }

  get themeItems(): SelectableButtonListItem[] {
    return [
      {
        value: 'theme',
        title: this.themeI18n.texts().UI_THEME.THEME_SETTINGS.TITLE,
        subline: this.themeI18n.getThemeLabel(this.currentTheme),
        leadingIconName: 'color-palette-outline',
        trailingIconName: 'chevron-forward-outline',
        ariaLabel: this.themeI18n.texts().UI_THEME.THEME_SETTINGS.TITLE,
      },
    ];
  }

  get ratingItems(): SelectableButtonListItem[] {
    return [
      {
        value: 'prompt',
        titleKey: 'RATING.DEBUG.PREVIEW_PROMPT',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'RATING.DEBUG.PREVIEW_PROMPT',
      },
      {
        value: 'suggestions',
        titleKey: 'RATING.DEBUG.PREVIEW_SUGGESTIONS',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'RATING.DEBUG.PREVIEW_SUGGESTIONS',
      },
      {
        value: 'feedback',
        titleKey: 'RATING.DEBUG.PREVIEW_FEEDBACK',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'RATING.DEBUG.PREVIEW_FEEDBACK',
      },
    ];
  }

  get removeAdsItems(): SelectableButtonListItem[] {
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

  get privacyItems(): SelectableButtonListItem[] {
    return [
      {
        value: 'privacy-options',
        titleKey: 'SETTINGS.PRIVACY_OPTIONS',
        trailingIconName: 'chevron-forward-outline',
        ariaLabelKey: 'SETTINGS.PRIVACY_OPTIONS',
      },
    ];
  }

  openLanguageModal(): void {
    this.languageDraft = this.selectedLanguage;
    this.languageModalOpen = true;
  }

  closeLanguageModal(): void {
    this.languageModalOpen = false;
  }

  openTheme(): void {
    void this.router.navigateByUrl('/tabs/settings/theme');
  }

  onLanguageDraftChange(value: string): void {
    if (this.supportedLanguages.some((option) => option.code === value)) {
      this.languageDraft = value as SupportedLocale;
    }
  }

  async confirmLanguage(): Promise<void> {
    this.closeLanguageModal();
    await this.changeLanguage(this.languageDraft);
  }

  async onRatingAction(value: string): Promise<void> {
    if (value === 'prompt') {
      await this.rating.previewPrompt();
      return;
    }

    if (value === 'suggestions') {
      await this.rating.previewSuggestionFlow();
      return;
    }

    if (value === 'feedback') {
      await this.rating.previewFeedbackFlow();
    }
  }

  onRemoveAdsAction(): void {
    this.removeAdsPurchasePage.open({
      variant: 'ECC',
      returnUrl: '/tabs/edit',
    });
    void this.router.navigateByUrl('/remove-ads');
  }

  async onPrivacyAction(): Promise<void> {
    await this.consent.showPrivacyOptionsIfAvailable();
  }

  private async changeLanguage(nextLanguage: SupportedLocale): Promise<void> {
    if (!nextLanguage || nextLanguage === this.selectedLanguage || this.restartingLanguage) {
      return;
    }

    this.restartingLanguage = true;
    try {
      await this.settings.setForScope('language', { language: nextLanguage });
      await this.language.set(nextLanguage);
      await this.showLanguageCountdown();
      await restartForLanguageChange(nextLanguage, 500);
    } finally {
      this.languageLoading.set(false);
      this.restartingLanguage = false;
    }
  }

  private async showLanguageCountdown(): Promise<void> {
    this.languageCountdown.set(4);
    this.languageLoading.set(true);
    for (let count = 4; count >= 1; count -= 1) {
      this.languageCountdown.set(count);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
  }
}
