import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./pages/create/create.page').then((m) => m.CreatePage),
  },
  {
    path: 'editor',
    loadChildren: () =>
      import('@sheldrapps/image-workflow/editor').then((m) => m.EDITOR_ROUTES),
  },
  {
    path: 'covers',
    loadComponent: () =>
      import('./pages/covers/covers.page').then((m) => m.CoversPage),
  },
  {
    path: 'requisites',
    loadComponent: () =>
      import('./pages/requisites/requisites.page').then(
        (m) => m.RequisitesPage,
      ),
  },
  {
    path: 'instructions',
    loadComponent: () =>
      import('./pages/instructions/instructions.page').then(
        (m) => m.InstructionsPage,
      ),
  },
];
