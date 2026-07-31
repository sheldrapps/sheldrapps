import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonBackButton,
  IonButtons,
} from '@ionic/angular/standalone';
import { RecommendedAppsService } from './recommended-apps.service';
import { RecommendedAppCardComponent } from './recommended-app-card.component';
import { RecommendedApp, RecommendedAppCategory } from './types';
import { openRecommendedApp } from './recommended-apps.runtime.js';
import {
  getRecommendedAppsTranslations,
  getRecommendedAppsTranslationsAsync,
  detectRecommendedAppsLocaleAsync,
} from './i18n';
import {
  RecommendedAppsLocale,
  RecommendedAppsTranslations,
} from './i18n/types';

const APP_DESCRIPTION_KEYS: Record<string, keyof RecommendedAppsTranslations> = {
  'com.sheldrapps.covercreatorforkindle': 'APP_DESC_CCFK',
  'com.sheldrapps.epubcoverchanger': 'APP_DESC_ECC',
  'com.sheldrapps.epubfixer': 'APP_DESC_EF',
  'com.sheldrapps.pdfcovermaker': 'APP_DESC_PCM',
};
const APP_NAME_KEYS: Record<string, keyof RecommendedAppsTranslations> = {
  'com.sheldrapps.covercreatorforkindle': 'APP_NAME_CCFK',
  'com.sheldrapps.epubcoverchanger': 'APP_NAME_ECC',
  'com.sheldrapps.epubfixer': 'APP_NAME_EF',
  'com.sheldrapps.pdfcovermaker': 'APP_NAME_PCM',
};

@Component({
  selector: 'recommended-apps-page',
  standalone: true,
  templateUrl: './recommended-apps.page.html',
  styleUrls: ['./recommended-apps.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonBackButton,
    IonButtons,
    RecommendedAppCardComponent,
  ],
})
export class RecommendedAppsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  t: RecommendedAppsTranslations = getRecommendedAppsTranslations('en-US');
  private locale: RecommendedAppsLocale = 'en-US';
  readonly backHref = this.resolveBackHref();

  recommendedApps: RecommendedApp[] = [];
  readonly categories: readonly RecommendedAppCategory[] = ['EPUB', 'PDF'];
  loading = true;
  private hasLoaded = false;
  private isLoadingPage = false;

  async ngOnInit(): Promise<void> {
    await this.loadPage();
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.hasLoaded) return;
    await this.loadPage();
  }

  private async loadPage(): Promise<void> {
    if (this.hasLoaded || this.isLoadingPage) return;
    this.isLoadingPage = true;
    this.loading = true;
    try {
      const [recommendedApps] = await Promise.all([
        this.recommendedAppsService.getRecommendedApps(),
        this.loadTranslations(),
      ]);
      this.recommendedApps = recommendedApps;
      this.hasLoaded = true;
    } catch (error) {
      console.warn('[RECOMMENDED_APPS] initial load failed', error);
      this.recommendedApps = [];
    } finally {
      this.loading = false;
      this.isLoadingPage = false;
      this.changeDetector.detectChanges();
    }
  }

  async loadRecommendedApps(): Promise<void> {
    try {
      this.recommendedApps = await this.recommendedAppsService.getRecommendedApps();
    } catch (error) {
      console.warn('[RECOMMENDED_APPS] using registry fallback', error);
      this.recommendedApps = [];
    } finally {
      this.changeDetector.detectChanges();
    }
  }

  async openUrl(url: string): Promise<void> {
    await openRecommendedApp(url);
  }

  getDescription(app: RecommendedApp): string {
    const descriptionKey = APP_DESCRIPTION_KEYS[app.packageName];
    if (!descriptionKey) {
      return app.description;
    }

    return this.t[descriptionKey] ?? app.description;
  }

  getAppName(app: RecommendedApp): string {
    const nameKey = APP_NAME_KEYS[app.packageName];
    if (!nameKey) {
      return app.appName;
    }

    return this.t[nameKey] ?? app.appName;
  }

  appsForCategory(category: RecommendedAppCategory): RecommendedApp[] {
    return this.recommendedApps.filter((app) => app.category === category);
  }

  categoryLabel(category: RecommendedAppCategory): string {
    return (
      (category === 'EPUB' ? this.t.CATEGORY_EPUB : this.t.CATEGORY_PDF) ??
      category
    );
  }

  private async loadTranslations(): Promise<void> {
    this.locale = await detectRecommendedAppsLocaleAsync();
    this.t = await getRecommendedAppsTranslationsAsync(this.locale);
  }

  private resolveBackHref(): string {
    const configuredBackHrefs = this.route.snapshot.pathFromRoot
      .map((routeSnapshot) => routeSnapshot.data['backHref'])
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0
      );

    const configuredBackHref =
      configuredBackHrefs[configuredBackHrefs.length - 1];

    return configuredBackHref ?? '/';
  }
}
