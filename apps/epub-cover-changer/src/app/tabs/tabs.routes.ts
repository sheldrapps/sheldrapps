import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/change',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'change',
        loadComponent: () =>
          import('../pages/change/change.page').then((m) => m.ChangePage),
      },
      {
        path: 'my-epubs',
        loadComponent: () =>
          import('../pages/my-epubs/my-epubs.page').then((m) => m.MyEpubsPage),
      },
      {
        path: 'settings',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../pages/settings/settings.page').then(
                (m) => m.SettingsPage,
              ),
          },
          {
            path: 'instructions',
            loadComponent: () =>
              import('../pages/instructions/instructions.page').then(
                (m) => m.InstructionsPage,
              ),
          },
        ],
      },
      {
        path: '',
        redirectTo: 'change',
        pathMatch: 'full',
      },
    ],
  },
];
