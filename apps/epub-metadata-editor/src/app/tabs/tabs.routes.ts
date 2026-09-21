import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/edit',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'edit',
        loadComponent: () =>
          import('../pages/edit/edit.page').then((module) => module.EditPage),
      },
      {
        path: 'my-epubs',
        loadComponent: () =>
          import('../pages/my-epubs/my-epubs.page').then(
            (module) => module.MyEpubsPage,
          ),
      },
      {
        path: 'settings',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../pages/settings/settings.page').then(
                (module) => module.SettingsPage,
              ),
          },
          {
            path: 'theme',
            loadComponent: () =>
              import('../pages/settings/theme.page').then(
                (module) => module.ThemePage,
              ),
          },
        ],
      },
      {
        path: 'recommended-apps',
        data: { backHref: '/tabs/edit' },
        loadChildren: () =>
          import('@sheldrapps/recommended-apps').then(
            (module) => module.RECOMMENDED_APPS_ROUTES,
          ),
      },
      {
        path: '',
        redirectTo: 'edit',
        pathMatch: 'full',
      },
    ],
  },
];
