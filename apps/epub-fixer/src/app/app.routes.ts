import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'remove-ads',
    data: {
      removeAdsVariant: 'EF',
      removeAdsReturnUrl: '/tabs/fix-page',
    },
    loadComponent: () =>
      import('@sheldrapps/ads-kit').then(
        (m) => m.RemoveAdsPurchasePageComponent,
      ),
  },
  {
    path: 'recommended-apps',
    data: {
      backHref: '/tabs/fix-page',
    },
    loadChildren: () =>
      import('@sheldrapps/recommended-apps').then(
        (m) => m.RECOMMENDED_APPS_ROUTES,
      ),
  },
];
