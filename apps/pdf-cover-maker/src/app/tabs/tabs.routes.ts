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
        path: 'my-pdfs',
        loadComponent: () =>
          import('../pages/my-pdfs/my-pdfs.page').then((m) => m.MyPdfsPage),
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
        path: 'preview-editing',
        loadComponent: () =>
          import('@sheldrapps/image-workflow').then(
            (m) => m.PreviewEditingPageComponent,
          ),
      },
      {
        path: 'recommended-apps',
        data: { backHref: '/tabs/change' },
        loadChildren: () =>
          import('@sheldrapps/recommended-apps').then(
            (m) => m.RECOMMENDED_APPS_ROUTES,
          ),
      },
      {
        path: '',
        redirectTo: 'change',
        pathMatch: 'full',
      },
    ],
  },
];
