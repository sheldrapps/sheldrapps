import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonBackButton,
  IonButtons,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

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

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  standalone: true,
  imports: [
    IonBackButton,
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
    IonButtons,
  ],
})
export class SettingsPage {
  private settings = inject(SettingsStore<CcfkSettings>);
  readonly supportedLangs = LANG_OPTIONS;

  constructor(
    public lang: LanguageService,
    public consent: ConsentService,
  ) {}

  ngOnInit() {}

  private readonly privacyPolicyUrl =
    'https://sheldrapps.github.io/privacy-policies/cover-creator-for-kindle/';

  trackByLang = (_: number, l: LangOption) => l.code;

  async onLangChange(v: Lang) {
    await this.settings.set({ lang: v });

    await this.lang.set(v);
  }

  async openPrivacyOptions() {
    const opened = await this.consent.showPrivacyOptionsIfAvailable();
    if (!opened) {
    }
  }

  async openPrivacyPolicy() {
    await Browser.open({ url: this.privacyPolicyUrl });
  }
}
