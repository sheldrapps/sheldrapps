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
    private consent: ConsentService,
  ) {
    void this.init();
  }

  private async init() {
    await this.settings.load();

    const currentSettings = this.settings.get();

    await this.lang.set(currentSettings.lang);

    await this.consent.gatherConsent();
    this.setDocumentTitle();
    this.t.onLangChange.subscribe(() => this.setDocumentTitle());
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
