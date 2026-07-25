export type RecommendedAppCategory = 'EPUB' | 'PDF';

export interface RecommendedApp {
  appName: string;
  packageName: string;
  icon: string;
  playStoreUrl: string;
  description: string;
  category: RecommendedAppCategory;
}
