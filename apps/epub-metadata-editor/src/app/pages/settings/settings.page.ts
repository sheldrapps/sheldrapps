import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LanguageRadioListComponent,
  LANG_OPTIONS,
  restartForLanguageChange,
  type LangOption,
  type SupportedLocale,
  LanguageService,
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
    SelectableButtonListComponent,
    SpinnerComponent,
  ],
})
export class SettingsPage {
  private readonly settings = inject(SettingsStore<EpubMetadataEditorSettings>);
  private readonly rating = inject(RatingService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly themeI18n = inject(UiThemeI18nService);
  readonly language = inject(LanguageService);

  readonly supportedLanguages = LANG_OPTIONS;
  readonly languageLoading = signal(false);
  readonly languageCountdown = signal(4);
  languageModalOpen = false;
  languageDraft: SupportedLocale = 'en-US';
  private restartingLanguage = false;

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
