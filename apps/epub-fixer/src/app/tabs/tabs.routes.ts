import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/fix',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'fix',
        loadComponent: () =>
          import('../pages/fix/fix.page').then((m) => m.FixPage),
      },
      {
        path: 'my-epubs',
        loadComponent: () =>
          import('../pages/my-epubs/my-epubs.page').then(
            (m) => m.MyEpubsPage,
          ),
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
          {
            path: 'theme',
            loadComponent: () =>
              import('../pages/settings/theme.page').then((m) => m.ThemePage),
          },
        ],
      },
      {
        path: '',
        redirectTo: 'fix',
        pathMatch: 'full',
      },
    ],
  },
];
