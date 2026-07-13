import { Component, OnDestroy, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { detectSupportedLocale, LanguageService } from '@sheldrapps/i18n-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EdgeToEdgeService, ThemeService } from '@sheldrapps/ui-theme';
import { Subscription, filter } from 'rxjs';
import { EpubMergerAndSplitterSettings } from './settings/epub-merger-and-splitter-settings.schema';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnDestroy {
  private readonly settings = inject(SettingsStore<EpubMergerAndSplitterSettings>);
  private readonly router = inject(Router);
  private readonly edgeToEdge = inject(EdgeToEdgeService);
  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly title = inject(Title);
  private readonly theme = inject(ThemeService);

  private navSub?: Subscription;
  private langSub?: Subscription;

  constructor() {
    // Release focus before Ionic hides the previous page with aria-hidden.
    this.navSub = this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe(() => {
        const activeElement = document.activeElement as HTMLElement | null;
        activeElement?.blur?.();
      });

    void this.init();
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.langSub?.unsubscribe();
  }

  private async init(): Promise<void> {
    await this.edgeToEdge.initEdgeToEdge();
    await this.theme.initialize();

    const currentSettings = await this.settings.load();
    const storedLanguage = currentSettings.language;
    const language = storedLanguage ?? (await detectSupportedLocale());

    this.translate.setDefaultLang('en-US');

    if (!storedLanguage) {
      await this.settings.setForScope('language', { language });
    }

    await this.lang.set(language);

    this.setDocumentTitle();
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.setDocumentTitle();
    });
  }

  private setDocumentTitle(): void {
    this.title.setTitle(this.translate.instant('APP.TITLE'));
  }
}
