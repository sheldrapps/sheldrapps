import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'new',
    loadComponent: () =>
      import('./create-task/create-task.page').then((m) => m.CreateTaskPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./task.page').then((m) => m.TaskPage),
  },
];
