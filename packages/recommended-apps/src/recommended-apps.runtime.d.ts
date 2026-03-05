import { RecommendedApp } from './types';

export declare function isValidApp(app: RecommendedApp): boolean;
export declare function isValidRecommendedApp(app: RecommendedApp): boolean;
export declare function filterRecommended(
  registry: RecommendedApp[],
  currentPackageName: string
): RecommendedApp[];
export declare function filterRecommendedApps(
  registry: RecommendedApp[],
  currentPackageName: string
): RecommendedApp[];
export declare function hasRecommendedApps(
  registry: RecommendedApp[],
  currentPackageName: string
): boolean;
export declare function createCurrentPackageResolver(
  getInfo: () => Promise<{ id?: string }>
): () => Promise<string>;
export declare function buildHomeHeaderItems(
  hasRecommendedApps: boolean,
  labels?: {
    appsLabel?: string;
    guideLabel?: string;
    recommendedLabel?: string;
    infoLabel?: string;
  }
): Array<{ id: string; label: string; icon: string }>;
export declare function handleHomeHeaderAction(
  id: string,
  handlers: {
    closeInfo: () => void;
    toggleInfo: () => void;
    navigateToRecommended: () => Promise<void>;
  }
): Promise<void>;
export declare function openRecommendedApp(
  url: string,
  openUrl?: (url: string) => Promise<void>
): Promise<void>;
export declare function detectRuntimeLocale(
  preferredLocale?: string
): Promise<string>;
export declare function resolveLocaleWithFallback(
  supportedLocales: readonly string[],
  preferredLocale: string | undefined,
  fallbackLocale: string
): string;
export declare function resolveLocaleWithFallbackAsync(
  supportedLocales: readonly string[],
  preferredLocale: string | undefined,
  fallbackLocale: string
): Promise<string>;
