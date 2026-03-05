import { Routes } from '@angular/router';

export const RECOMMENDED_APPS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./recommended-apps.page').then((m) => m.RecommendedAppsPage),
  },
];
