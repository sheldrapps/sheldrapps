import { Component, OnDestroy, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import {
  detectSupportedLocale,
  LanguageService,
} from '@sheldrapps/i18n-kit';
import { RatingService } from '@sheldrapps/rating-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EdgeToEdgeService, ThemeService } from '@sheldrapps/ui-theme';
import { Subscription } from 'rxjs';
import { PcmSettings } from './settings/pcm-settings.schema';

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
  private theme = inject(ThemeService);
  private settings = inject(SettingsStore<PcmSettings>);
  private rating = inject(RatingService);

  private langSub?: Subscription;

  constructor() {
    void this.init();
  }

  ngOnDestroy() {
    this.langSub?.unsubscribe();
  }

  private async init() {
    await this.edgeToEdge.initEdgeToEdge();
    await this.theme.initialize();

    const currentSettings = this.settings.get();
    const storedLanguage = currentSettings.language;
    const language = storedLanguage ?? (await detectSupportedLocale());

    this.t.setDefaultLang('en-US');

    if (!storedLanguage) {
      await this.settings.setForScope('language', { language });
    }

    await this.lang.set(language);
    await this.rating.initialize();

    this.setDocumentTitle();
    this.langSub = this.t.onLangChange.subscribe(() => this.setDocumentTitle());
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
