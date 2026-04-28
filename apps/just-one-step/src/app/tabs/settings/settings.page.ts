import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonRadio,
  IonRadioGroup,
  IonModal,
  IonButtons,
  IonButton,
  IonTitle,
  IonToolbar,
} from "@ionic/angular/standalone";
import { Browser } from '@capacitor/browser';
import { TranslateModule } from '@ngx-translate/core';
import { THEME_OPTIONS, type Theme } from "@sheldrapps/ui-theme";

import { Lang, LangOption, LANG_OPTIONS } from '../../services/language.service';
import { ConsentService } from '../../services/consent.service';
import { ConfigService } from "../../../config/config.service";

@Component({
  selector: "app-settings",
  templateUrl: "./settings.page.html",
  styleUrls: ["./settings.page.scss"],
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
  ],
})
export class SettingsPage {
  private readonly config = inject(ConfigService);

  readonly consent = inject(ConsentService);
  readonly supportedLangs = LANG_OPTIONS;
  readonly supportedThemes = THEME_OPTIONS;
  isLanguageModalOpen = false;
  languageDraft: Lang = "en-US";

  private readonly privacyPolicyUrl =
    "https://sheldrapps.github.io/privacy-policies/just-one-step/";

  get currentLanguage(): Lang {
    return this.config.snapshot().language ?? "en-US";
  }

  get currentTheme(): Theme {
    return this.config.snapshot().theme;
  }

  get currentThemeLabelKey(): string {
    return (
      this.supportedThemes.find((option) => option.code === this.currentTheme)
        ?.labelKey ?? "SETTINGS.THEME_SYSTEM"
    );
  }

  get currentLanguageOption(): LangOption | undefined {
    return this.supportedLangs.find(
      (option) => option.code === this.currentLanguage,
    );
  }

  openLanguageModal(): void {
    this.languageDraft = this.currentLanguage;
    this.isLanguageModalOpen = true;
  }

  closeLanguageModal(): void {
    this.isLanguageModalOpen = false;
  }

  onLanguageDraftChange(value: Lang): void {
    this.languageDraft = value;
  }

  async confirmLanguageModal(): Promise<void> {
    const nextLanguage = this.languageDraft;
    this.closeLanguageModal();
    await this.onLangChange(nextLanguage);
  }

  trackByLang = (_: number, l: LangOption) => l.code;

  async onLangChange(v: Lang): Promise<void> {
    if (!v || v === this.currentLanguage) {
      return;
    }
    await this.config.setLanguage(v);
  }

  async openPrivacyOptions(): Promise<void> {
    const opened = await this.consent.showPrivacyOptionsIfAvailable();
    if (!opened) {
      // Intentionally no-op to match ECC behavior.
    }
  }

  async openPrivacyPolicy(): Promise<void> {
    await Browser.open({ url: this.privacyPolicyUrl });
  }
}
