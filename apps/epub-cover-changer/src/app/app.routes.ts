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
    path: 'change',
    loadComponent: () =>
      import('./pages/change/change.page').then((m) => m.ChangePage),
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
];
