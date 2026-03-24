import { Component, OnInit, inject } from '@angular/core';
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
  IonSelect,
  IonSelectOption,
  IonLoading,
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
import { restartForLanguageChange } from '@sheldrapps/i18n-kit';
import { TourService } from 'src/app/shared/tour/tour.service';
import { HOME_TOUR_ID } from 'src/app/shared/tour/home-tour.definition';

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
    IonSelect,
    IonSelectOption,
    IonLoading,
  ],
})
export class SettingsPage implements OnInit {
  lang = inject(LanguageService);
  consent = inject(ConsentService);

  private settings = inject(SettingsStore<EccSettings>);
  private router = inject(Router);
  private tour = inject(TourService);
  readonly supportedLangs = LANG_OPTIONS;
  selectedLanguage = this.lang.lang as Lang;
  private isRestartingLanguage = false;
  isLanguageRestartLoading = false;
  languageRestartCountdown = 3;
  private readonly languageRestartCountdownStart = 3;

  constructor() {}

  ngOnInit() {}

  private readonly privacyPolicyUrl =
    'https://sheldrapps.github.io/privacy-policies/epub-cover-changer/';

  trackByLang = (_: number, l: LangOption) => l.code;

  async onLangChange(v: Lang) {
    if (!v || v === this.lang.lang || this.isRestartingLanguage) {
      return;
    }

    this.isRestartingLanguage = true;

    try {
      this.selectedLanguage = v;
      await this.settings.set({ language: v });
      await this.lang.set(v);
      await this.showLanguageRestartCountdown();
      await restartForLanguageChange(v, 0);
    } finally {
      this.isLanguageRestartLoading = false;
      this.isRestartingLanguage = false;
    }
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

  async startHomeTour() {
    this.tour.requestManualStart(HOME_TOUR_ID);
    await this.router.navigateByUrl('/tabs/change');
  }

  private async showLanguageRestartCountdown() {
    this.languageRestartCountdown = this.languageRestartCountdownStart;
    this.isLanguageRestartLoading = true;
    await this.waitForLoadingToRender();

    for (let remaining = this.languageRestartCountdownStart; remaining > 1; remaining--) {
      await this.delay(1000);
      this.languageRestartCountdown = remaining - 1;
    }

    await this.delay(1000);
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

