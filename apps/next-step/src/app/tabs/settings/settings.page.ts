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
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { Browser } from '@capacitor/browser';
import { TranslateModule } from '@ngx-translate/core';

import { Lang, LangOption, LANG_OPTIONS } from '../../services/language.service';
import { ConsentService } from '../../services/consent.service';
import { ConfigService } from '../../../config/config.service';
import {
  Theme,
  ThemeOption,
  THEME_OPTIONS,
} from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
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
    IonSelect,
    IonSelectOption,
  ],
})
export class SettingsPage {
  private readonly config = inject(ConfigService);

  readonly consent = inject(ConsentService);
  readonly supportedLangs = LANG_OPTIONS;
  readonly supportedThemes = THEME_OPTIONS;

  private readonly privacyPolicyUrl =
    'https://sheldrapps.github.io/privacy-policies/next-step/';

  get currentLanguage(): Lang {
    return this.config.snapshot().language ?? 'en-US';
  }

  get currentTheme(): Theme {
    return this.config.snapshot().theme;
  }

  trackByLang = (_: number, l: LangOption) => l.code;
  trackByTheme = (_: number, t: ThemeOption) => t.code;

  async onLangChange(v: Lang): Promise<void> {
    await this.config.setLanguage(v);
  }

  async onThemeChange(v: Theme): Promise<void> {
    await this.config.setTheme(v);
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
