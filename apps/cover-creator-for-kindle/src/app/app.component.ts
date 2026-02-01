import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { ConsentService } from './services/consent.service';
import { CcfkSettings } from './settings/ccfk-settings.schema';
@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private settings = inject(SettingsStore<CcfkSettings>);

  constructor(
    private lang: LanguageService,
    private t: TranslateService,
    private title: Title,
    private consent: ConsentService
  ) {
    void this.init();
  }

  private consentReady: Promise<void> | null = null;

  private async init() {
    // Load settings from storage (runs migrations if needed)
    await this.settings.load();
    
    // Get the saved language from settings
    const currentSettings = this.settings.get();
    
    // Set the language in LanguageService
    await this.lang.set(currentSettings.lang);
    
    this.consentReady = this.consent
      .gatherConsent()
      .then(() => undefined)
      .catch(() => undefined);
    this.setDocumentTitle();
    this.t.onLangChange.subscribe(() => this.setDocumentTitle());
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
