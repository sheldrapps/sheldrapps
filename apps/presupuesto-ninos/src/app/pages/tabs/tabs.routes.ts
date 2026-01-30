import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/presupuestos',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'presupuestos',
        loadComponent: () =>
          import('../home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'ajustes',
        loadComponent: () =>
          import('../settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'nino/:id',
        loadComponent: () =>
          import('../child-detail/child-detail.page').then(
            (m) => m.ChildDetailPage
          ),
      },
      {
        path: '',
        redirectTo: 'presupuestos',
        pathMatch: 'full',
      },
    ],
  },
];