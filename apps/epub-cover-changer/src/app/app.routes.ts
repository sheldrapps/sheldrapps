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
    path: 'covers',
    loadComponent: () =>
      import('./pages/covers/covers.page').then((m) => m.CoversPage),
  },
  {
    path: 'instructions',
    loadComponent: () =>
      import('./pages/instructions/instructions.page').then(
        (m) => m.InstructionsPage,
      ),
  },
];
