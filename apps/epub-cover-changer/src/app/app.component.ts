import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import {
  detectSupportedLocale,
  LanguageService,
  syncLauncherAlias,
} from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EdgeToEdgeService } from '@sheldrapps/ui-theme';
import { EccSettings } from './settings/ecc-settings.schema';
@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private lang = inject(LanguageService);
  private t = inject(TranslateService);
  private title = inject(Title);
  private edgeToEdge = inject(EdgeToEdgeService);

  private settings = inject(SettingsStore<EccSettings>);

  constructor() {
    void this.edgeToEdge.initEdgeToEdge();
    void this.init();
  }

  private async init() {
    // Load settings from storage (runs migrations if needed)
    await this.settings.load();

    const currentSettings = this.settings.get();
    const language =
      currentSettings.language ?? (await detectSupportedLocale());

    await syncLauncherAlias(language);
    this.t.setDefaultLang('en-US');
    await this.lang.set(language);

    this.setDocumentTitle();
    this.t.onLangChange.subscribe(() => this.setDocumentTitle());
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
