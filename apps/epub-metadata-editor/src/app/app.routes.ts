import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((module) => module.routes),
  },
  {
    path: 'remove-ads',
    data: {
      removeAdsVariant: 'ECC',
      removeAdsReturnUrl: '/tabs/edit',
    },
    loadComponent: () =>
      import('@sheldrapps/ads-kit').then(
        (module) => module.RemoveAdsPurchasePageComponent,
      ),
  },
  {
    path: 'metadata-editor',
    loadComponent: () =>
      import('@sheldrapps/ui-theme').then(
        (module) => module.EpubMetadataEditorPageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '/tabs/edit',
  },
];
