import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

const developmentRoutes: Routes = isDevMode()
  ? [
      {
        path: 'metadata-editor-playground',
        loadComponent: () =>
          import('@sheldrapps/ui-theme').then(
            (m) => m.EpubMetadataEditorPlaygroundPageComponent,
          ),
      },
    ]
  : [];

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'remove-ads',
    data: {
      removeAdsVariant: 'ECC',
      removeAdsReturnUrl: '/tabs/change',
    },
    loadComponent: () =>
      import('@sheldrapps/ads-kit').then(
        (m) => m.RemoveAdsPurchasePageComponent,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'change',
    loadComponent: () =>
      import('./pages/change/change.page').then((m) => m.ChangePage),
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
  {
    path: 'my-epubs',
    loadComponent: () =>
      import('./pages/my-epubs/my-epubs.page').then((m) => m.MyEpubsPage),
  },
  {
    path: 'instructions',
    loadComponent: () =>
      import('./pages/instructions/instructions.page').then(
        (m) => m.InstructionsPage,
      ),
  },
  {
    path: 'metadata-editor',
    loadComponent: () =>
      import('@sheldrapps/ui-theme').then(
        (m) => m.EpubMetadataEditorPageComponent,
      ),
  },
  ...developmentRoutes,
];