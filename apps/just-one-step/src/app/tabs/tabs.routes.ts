import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'today',
        loadComponent: () =>
          import('./today/today.page').then((m) => m.TodayPage),
      },
      {
        path: 'agenda',
        loadComponent: () =>
          import('./agenda/agenda.page').then((m) => m.AgendaPage),
      },
      {
        path: 'settings',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./settings/settings.page').then((m) => m.SettingsPage),
          },
          {
            path: 'instructions',
            loadComponent: () =>
              import('./settings/instructions.page').then(
                (m) => m.InstructionsPage
              ),
          },
        ],
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./tasks/tasks.page').then((m) => m.TasksPage),
      },
      {
        path: 'reflection',
        loadComponent: () =>
          import('./reflection/reflection.page').then((m) => m.ReflectionPage),
      },
      {
        path: '',
        redirectTo: 'today',
        pathMatch: 'full',
      },
    ],
  },
];
