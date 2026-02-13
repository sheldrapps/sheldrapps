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
    // DEBUG: i18n runtime snapshot (remove after diagnosis)
    console.log('[i18n-debug] after lang.set', {
      currentLang: this.t.currentLang,
      defaultLang: this.t.defaultLang,
      langs: this.t.getLangs(),
      createTitle: this.t.instant('CREATE.TITLE'),
    });

    await this.consent.gatherConsent();
    this.setDocumentTitle();
    this.t.onLangChange.subscribe((event) => {
      // DEBUG: i18n onLangChange (remove after diagnosis)
      console.log('[i18n-debug] onLangChange', {
        lang: event.lang,
        currentLang: this.t.currentLang,
        defaultLang: this.t.defaultLang,
        langs: this.t.getLangs(),
        createTitle: this.t.instant('CREATE.TITLE'),
      });
      this.setDocumentTitle();
    });
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
