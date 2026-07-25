import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/create',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'create',
        loadComponent: () =>
          import('../pages/create/create.page').then((m) => m.CreatePage),
      },
      {
        path: 'covers',
        loadComponent: () =>
          import('../pages/covers/covers.page').then((m) => m.CoversPage),
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
            path: 'requisites',
            loadComponent: () =>
              import('../pages/requisites/requisites.page').then(
                (m) => m.RequisitesPage,
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
        path: 'preview-editing',
        loadComponent: () =>
          import('@sheldrapps/image-workflow').then(
            (m) => m.PreviewEditingPageComponent,
          ),
      },
      {
        path: 'recommended-apps',
        data: { backHref: '/tabs/create' },
        loadChildren: () =>
          import('@sheldrapps/recommended-apps').then(
            (m) => m.RECOMMENDED_APPS_ROUTES,
          ),
      },
      {
        path: '',
        redirectTo: 'create',
        pathMatch: 'full',
      },
    ],
  },
];
