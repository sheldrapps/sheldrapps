import { Component, inject, OnDestroy } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { ConsentService } from './services/consent.service';
import { CcfkSettings } from './settings/ccfk-settings.schema';

import { Router, NavigationStart } from '@angular/router';
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

  private navSub?: Subscription;
  private langSub?: Subscription;

  constructor(
    private lang: LanguageService,
    private t: TranslateService,
    private title: Title,
    private consent: ConsentService,
  ) {
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
    await this.settings.load();

    const currentSettings = this.settings.get();

    await this.lang.set(currentSettings.lang);

    await this.consent.gatherConsent();
    this.setDocumentTitle();

    this.langSub = this.t.onLangChange.subscribe(() => {
      this.setDocumentTitle();
    });
  }

  private setDocumentTitle() {
    this.title.setTitle(this.t.instant('APP.TITLE'));
  }
}
