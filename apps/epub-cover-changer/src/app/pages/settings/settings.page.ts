import { Component, OnInit, inject } from '@angular/core';
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
import { EccSettings } from 'src/app/settings/ecc-settings.schema';
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
export class SettingsPage implements OnInit {
  lang = inject(LanguageService);
  consent = inject(ConsentService);

  private settings = inject(SettingsStore<EccSettings>);
  readonly supportedLangs = LANG_OPTIONS;

  constructor() {
    console.log(
      '[SettingsPage] constructor - lang.lang value:',
      this.lang.lang,
    );
    console.log(
      '[SettingsPage] constructor - supportedLangs:',
      this.supportedLangs,
    );
  }

  ngOnInit() {
    console.log('[SettingsPage] ngOnInit - lang.lang value:', this.lang.lang);
    console.log(
      '[SettingsPage] ngOnInit - currentLang:',
      this.lang['currentLang'],
    );
  }

  private readonly privacyPolicyUrl =
    'https://sheldrapps.github.io/privacy-policies/epub-cover-changer/';

  trackByLang = (_: number, l: LangOption) => l.code;

  async onLangChange(v: Lang) {
    console.log('[SettingsPage] onLangChange called with value:', v);
    console.log(
      '[SettingsPage] onLangChange - current lang.lang before set():',
      this.lang.lang,
    );

    // First persist in settings-kit
    await this.settings.set({ lang: v });
    console.log('[SettingsPage] onLangChange - settings.set() completed');

    // Then apply language change
    await this.lang.set(v);
    console.log(
      '[SettingsPage] onLangChange - lang.set() completed, new lang.lang:',
      this.lang.lang,
    );
  }

  async openPrivacyOptions() {
    const opened = await this.consent.showPrivacyOptionsIfAvailable();
    if (!opened) {
      // opcional: toast "Not available"
    }
  }

  async openPrivacyPolicy() {
    await Browser.open({ url: this.privacyPolicyUrl });
  }
}

