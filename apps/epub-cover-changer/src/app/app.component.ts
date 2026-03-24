import { Component, OnDestroy, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { detectSupportedLocale, LanguageService } from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EdgeToEdgeService } from '@sheldrapps/ui-theme';
import { Subscription } from 'rxjs';
import { EccSettings } from './settings/ecc-settings.schema';

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnDestroy {
  private lang = inject(LanguageService);
  private t = inject(TranslateService);
  private title = inject(Title);
  private edgeToEdge = inject(EdgeToEdgeService);
  private settings = inject(SettingsStore<EccSettings>);

  private langSub?: Subscription;

  constructor() {
    void this.edgeToEdge.initEdgeToEdge();
    void this.init();
  }

  ngOnDestroy() {
    this.langSub?.unsubscribe();
  }

  private async init() {
    await this.settings.load();

    const currentSettings = this.settings.get();
    const storedLanguage = currentSettings.language;
    const language = storedLanguage ?? (await detectSupportedLocale());

    this.t.setDefaultLang('en-US');

    if (!storedLanguage) {
      await this.settings.set({ language });
    }

    await this.lang.set(language);

    this.setDocumentTitle();
    this.langSub = this.t.onLangChange.subscribe(() => this.setDocumentTitle());
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
