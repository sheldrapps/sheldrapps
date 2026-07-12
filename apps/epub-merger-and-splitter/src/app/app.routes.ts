import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'editor',
    loadChildren: () =>
      import('@sheldrapps/image-workflow/editor').then((m) => m.EDITOR_ROUTES),
  },
  {
    path: 'recommended-apps',
    data: {
      backHref: '/tabs/home',
    },
    loadChildren: () =>
      import('@sheldrapps/recommended-apps').then(
        (m) => m.RECOMMENDED_APPS_ROUTES,
      ),
  },
];
