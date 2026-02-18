import { Routes } from '@angular/router';
import { EditorPanelEntryGuard } from './editor-panel-entry.guard';
import { EditorPanelExitGuard } from './editor-panel-exit.guard';
import { EditorSessionExitGuard } from './editor-session-exit.guard';

export const EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./editor-shell.page').then((m) => m.EditorShellPage),
    canDeactivate: [EditorSessionExitGuard],
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
        canActivate: [EditorPanelEntryGuard],
        canDeactivate: [EditorPanelExitGuard],
      },
      {
        path: 'adjustments',
        loadComponent: () =>
          import('./panels/adjustments/adjustments.page').then(
            (m) => m.AdjustmentsPage
          ),
        canActivate: [EditorPanelEntryGuard],
        canDeactivate: [EditorPanelExitGuard],
      },
    ],
  },
];
