import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonButtons,
  IonButton,
  IonTitle,
  IonToolbar,
} from "@ionic/angular/standalone";
import { TranslateModule } from '@ngx-translate/core';
import { PrivacyPolicySectionComponent } from '@sheldrapps/privacy-policy-kit';
import { LanguageRadioListComponent } from '@sheldrapps/i18n-kit';
import { UiThemeI18nService, type Theme } from "@sheldrapps/ui-theme";

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
    PrivacyPolicySectionComponent,
    LanguageRadioListComponent,
  ],
})
export class SettingsPage {
  private readonly config = inject(ConfigService);
  private readonly uiThemeI18n = inject(UiThemeI18nService);

  readonly consent = inject(ConsentService);
  readonly supportedLangs = LANG_OPTIONS;
  isLanguageModalOpen = false;
  languageDraft: Lang = "en-US";

  readonly privacyPolicyUrl =
    "https://sheldrapps.github.io/privacy-policies/just-one-step/";

  get currentLanguage(): Lang {
    return this.config.snapshot().language ?? "en-US";
  }

  get currentTheme(): Theme {
    return this.config.snapshot().theme;
  }

  get currentThemeLabel(): string {
    return this.uiThemeI18n.getThemeLabel(this.currentTheme);
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

  onLanguageDraftChange(value: string): void {
    this.languageDraft = value as Lang;
  }

  async confirmLanguageModal(): Promise<void> {
    const nextLanguage = this.languageDraft;
    this.closeLanguageModal();
    await this.onLangChange(nextLanguage);
  }

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
}
