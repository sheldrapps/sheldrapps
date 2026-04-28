import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'editor',
    loadChildren: () =>
      import('@sheldrapps/image-workflow/editor').then((m) => m.EDITOR_ROUTES),
  },
  {
    path: '',
    loadChildren: () =>
      import('./pages/tabs/tabs.routes').then((m) => m.routes),
  },
];
