import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('../pages/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'home/under-construction',
        loadComponent: () =>
          import('@sheldrapps/ui-theme').then(
            (m) => m.UnderConstructionPageComponent,
          ),
      },
      {
        path: 'my-epubs',
        loadComponent: () =>
          import('../pages/my-epubs/my-epubs.page').then(
            (m) => m.MyEpubsPage,
          ),
      },
      {
        path: 'preview-editing',
        loadComponent: () =>
          import('@sheldrapps/image-workflow').then(
            (m) => m.PreviewEditingPageComponent,
          ),
      },
      {
        path: 'recommended-apps',
        data: { backHref: '/tabs/settings' },
        loadChildren: () =>
          import('@sheldrapps/recommended-apps').then(
            (m) => m.RECOMMENDED_APPS_ROUTES,
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
            path: 'theme',
            loadComponent: () =>
              import('../pages/settings/theme.page').then((m) => m.ThemePage),
          },
        ],
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];
