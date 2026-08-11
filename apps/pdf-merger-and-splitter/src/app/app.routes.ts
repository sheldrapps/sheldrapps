import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'remove-ads',
    data: {
      removeAdsVariant: 'PMAS',
      removeAdsReturnUrl: '/tabs/home',
    },
    loadComponent: () =>
      import('@sheldrapps/ads-kit').then(
        (m) => m.RemoveAdsPurchasePageComponent,
      ),
  },
  {
    path: 'editor',
    loadChildren: () =>
      import('@sheldrapps/image-workflow/editor').then((m) => m.EDITOR_ROUTES),
  },
  {
    path: 'preview-editing',
    loadComponent: () =>
      import('@sheldrapps/image-workflow').then(
        (m) => m.PreviewEditingPageComponent,
      ),
  },
];
