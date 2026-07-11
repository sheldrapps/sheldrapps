import { Component, inject } from '@angular/core';
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
  IonIcon,
  IonButton,
  IonBackButton,
  IonButtons,
} from '@ionic/angular/standalone';
import { RecommendedAppsService } from './recommended-apps.service';
import { RecommendedApp } from './types';
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

const LOGO_GOOGLE_PLAYSTORE_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path fill="currentColor" d="M96 64l320 192-320 192V64z"></path>
</svg>
`;

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
    IonIcon,
    IonButton,
    IonBackButton,
    IonButtons,
  ],
})
export class RecommendedAppsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  t: RecommendedAppsTranslations = getRecommendedAppsTranslations('en-US');
  private locale: RecommendedAppsLocale = 'en-US';
  readonly backHref = this.resolveBackHref();
  readonly playStoreIconSrc = `data:image/svg+xml;base64,${btoa(
    LOGO_GOOGLE_PLAYSTORE_ICON
  )}`;

  recommendedApps: RecommendedApp[] = [];
  loading = true;

  async ionViewWillEnter(): Promise<void> {
    await Promise.all([this.loadTranslations(), this.loadRecommendedApps()]);
  }

  async loadRecommendedApps(): Promise<void> {
    this.loading = true;
    try {
      this.recommendedApps = await this.recommendedAppsService.getRecommendedApps();
    } finally {
      this.loading = false;
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

    return this.t[descriptionKey];
  }

  getAppName(app: RecommendedApp): string {
    const nameKey = APP_NAME_KEYS[app.packageName];
    if (!nameKey) {
      return app.appName;
    }

    return this.t[nameKey];
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
