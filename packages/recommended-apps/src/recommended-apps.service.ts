import { Injectable, InjectionToken, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { RECOMMENDED_APPS_REGISTRY } from './recommended-apps.registry';
import { RecommendedApp } from './types';
import {
  filterRecommended,
  hasRecommendedApps as hasRecommendedAppsFromRegistry,
  isValidApp,
  createCurrentPackageResolver,
} from './recommended-apps.runtime.js';

const RECOMMENDED_APPS_DEBUG = true;
export const RECOMMENDED_APPS_CURRENT_PACKAGE = new InjectionToken<string>(
  'RECOMMENDED_APPS_CURRENT_PACKAGE'
);

@Injectable({
  providedIn: 'root',
})
export class RecommendedAppsService {
  private readonly injectedCurrentPackageName = inject(
    RECOMMENDED_APPS_CURRENT_PACKAGE,
    { optional: true }
  );
  private readonly resolveCurrentPackageName = createCurrentPackageResolver(
    () => App.getInfo()
  );

  async getCurrentPackage(): Promise<string> {
    const injectedPackage = this.normalizePackageName(
      this.injectedCurrentPackageName
    );
    if (injectedPackage) {
      return injectedPackage;
    }

    const detectedPackage = await this.resolveCurrentPackageName();
    return this.normalizePackageName(detectedPackage);
  }

  async getCurrentPackageName(): Promise<string> {
    return this.getCurrentPackage();
  }

  async getRecommendedApps(): Promise<RecommendedApp[]> {
    const currentPackageName = await this.getCurrentPackage();
    const validApps = RECOMMENDED_APPS_REGISTRY.filter(isValidApp);
    const recommendedApps = filterRecommended(
      RECOMMENDED_APPS_REGISTRY,
      currentPackageName
    );

    if (RECOMMENDED_APPS_DEBUG) {
      console.info('[recommended-apps][service] getRecommendedApps', {
        currentPackageName,
        registry: RECOMMENDED_APPS_REGISTRY.map((app) => ({
          packageName: app.packageName,
          playStoreUrl: app.playStoreUrl,
        })),
        validAppsLength: validApps.length,
        recommendedAppsLength: recommendedApps.length,
        recommendedPackageNames: recommendedApps.map((app) => app.packageName),
      });
    }

    return recommendedApps;
  }

  async hasRecommendedApps(): Promise<boolean> {
    const currentPackageName = await this.getCurrentPackage();
    return hasRecommendedAppsFromRegistry(
      RECOMMENDED_APPS_REGISTRY,
      currentPackageName
    );
  }

  private normalizePackageName(packageName: unknown): string {
    return typeof packageName === 'string' ? packageName.trim() : '';
  }
}
