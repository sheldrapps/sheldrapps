import { Component, OnDestroy, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnDestroy {
  private readonly router: Router;
  private readonly translate: TranslateService;
  private readonly title: Title;

  private navSub?: Subscription;
  private langSub?: Subscription;

  constructor() {
    this.router = inject(Router);
    this.translate = inject(TranslateService);
    this.title = inject(Title);
    // Release focus before Ionic hides the previous page with aria-hidden.
    this.navSub = this.router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe(() => {
        const activeElement = document.activeElement as HTMLElement | null;
        activeElement?.blur?.();
      });

    this.setDocumentTitle();
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.setDocumentTitle();
    });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.langSub?.unsubscribe();
  }

  private setDocumentTitle(): void {
    this.title.setTitle(this.translate.instant('APP.TITLE'));
  }
}
