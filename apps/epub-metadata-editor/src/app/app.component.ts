import { Component, OnDestroy, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationStart, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, filter } from 'rxjs';
import { EmeLifecycleDiagnosticsService } from './services/eme-lifecycle-diagnostics.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
  private readonly lifecycle = inject(EmeLifecycleDiagnosticsService);
  private readonly navigationSubscription = this.router.events
    .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
    .subscribe(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
  private readonly languageSubscription = this.translate.onLangChange.subscribe(() => {
    this.title.setTitle(this.translate.instant('APP.TITLE'));
  });

  constructor() {
    this.lifecycle.start();
    this.title.setTitle(this.translate.instant('APP.TITLE'));
  }

  ngOnDestroy(): void {
    this.navigationSubscription.unsubscribe();
    this.languageSubscription.unsubscribe();
  }
}
