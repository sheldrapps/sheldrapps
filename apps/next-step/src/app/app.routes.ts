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
    path: 'categories',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./categories/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./categories/category-create.page').then(
            (m) => m.CategoryCreatePage
          ),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./categories/category-edit.page').then(
            (m) => m.CategoryEditPage
          ),
      },
    ],
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
