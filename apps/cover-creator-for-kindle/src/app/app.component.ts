import { Component, OnDestroy, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { detectSupportedLocale, LanguageService } from '@sheldrapps/i18n-kit';
import { RatingService } from '@sheldrapps/rating-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EdgeToEdgeService, ThemeService } from '@sheldrapps/ui-theme';
import { CcfkSettings } from './settings/ccfk-settings.schema';

import { NavigationStart, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnDestroy {
  private settings = inject(SettingsStore<CcfkSettings>);
  private router = inject(Router);
  private edgeToEdge = inject(EdgeToEdgeService);
  private lang = inject(LanguageService);
  private t = inject(TranslateService);
  private title = inject(Title);
  private theme = inject(ThemeService);
  private rating = inject(RatingService);

  private navSub?: Subscription;
  private langSub?: Subscription;

  constructor() {
    // Release focus before Ionic hides the previous page with aria-hidden
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => {
        const el = document.activeElement as HTMLElement | null;
        el?.blur?.();
      });

    void this.init();
  }

  ngOnDestroy() {
    this.navSub?.unsubscribe();
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
      await this.settings.set({ language });
    }

    await this.lang.set(language);
    await this.rating.initialize();

    this.setDocumentTitle();
    this.langSub = this.t.onLangChange.subscribe(() => {
      this.setDocumentTitle();
    });
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
