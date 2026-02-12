import { Routes } from '@angular/router';

export const EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./editor-shell.page').then((m) => m.EditorShellPage),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./panels/default/default.page').then((m) => m.DefaultPage),
      },
      {
        path: 'tools',
        loadComponent: () =>
          import('./panels/tools/tools.page').then((m) => m.ToolsPage),
      },
      {
        path: 'adjustments',
        loadComponent: () =>
          import('./panels/adjustments/adjustments.page').then(
            (m) => m.AdjustmentsPage
          ),
      },
    ],
  },
];
