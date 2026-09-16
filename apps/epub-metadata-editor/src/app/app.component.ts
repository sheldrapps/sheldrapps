import { Component, OnDestroy, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationStart, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly translate = inject(TranslateService);
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
    this.title.setTitle(this.translate.instant('APP.TITLE'));
  }

  ngOnDestroy(): void {
    this.navigationSubscription.unsubscribe();
    this.languageSubscription.unsubscribe();
  }
}
