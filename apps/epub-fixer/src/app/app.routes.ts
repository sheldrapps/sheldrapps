import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'recommended-apps',
    data: {
      backHref: '/tabs/fix',
    },
    loadChildren: () =>
      import('@sheldrapps/recommended-apps').then(
        (m) => m.RECOMMENDED_APPS_ROUTES,
      ),
  },
];
