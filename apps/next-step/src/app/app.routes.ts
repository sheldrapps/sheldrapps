import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/today',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'task',
    loadChildren: () => import('./task/task.routes').then((m) => m.routes),
  },
  {
    path: 'progress',
    loadComponent: () =>
      import('./progress/progress.page').then((m) => m.ProgressPage),
  },
  {
    path: '**',
    redirectTo: '/tabs/today',
  },
];
