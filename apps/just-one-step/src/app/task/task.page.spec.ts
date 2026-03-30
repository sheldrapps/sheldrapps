import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { AlertController, NavController } from '@ionic/angular';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { PersistedTaskAggregate, TaskRepository } from '../database/repositories/task.repository';
import { TaskPage } from './task.page';

function buildAggregate(
  overrides: Partial<PersistedTaskAggregate>
): PersistedTaskAggregate {
  const nowIso = '2026-03-29T12:00:00.000Z';
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Task',
    description: overrides.description ?? null,
    trackingMode: overrides.trackingMode ?? 'check',
    priority: overrides.priority ?? 'B',
    scheduleType: overrides.scheduleType ?? 'one_time',
    durationMode: overrides.durationMode ?? 'single',
    oneTimeDate: overrides.oneTimeDate ?? '2026-03-29T12:00:00.000Z',
    oneTimeTime: overrides.oneTimeTime ?? '09:00',
    estimatedDurationMin:
      overrides.estimatedDurationMin === undefined
        ? null
        : overrides.estimatedDurationMin,
    categoryId: overrides.categoryId ?? null,
    categoryName: overrides.categoryName ?? 'Personal',
    categoryColor: overrides.categoryColor ?? '#64748B',
    isActive: overrides.isActive ?? true,
    isArchived: overrides.isArchived ?? false,
    deletedAt: overrides.deletedAt ?? null,
    recurrenceEnabled: overrides.recurrenceEnabled ?? false,
    notificationsEnabled: overrides.notificationsEnabled ?? false,
    createdAt: overrides.createdAt ?? nowIso,
    updatedAt: overrides.updatedAt ?? nowIso,
    recurrence: overrides.recurrence,
    notification: overrides.notification,
  };
}

describe('TaskPage priority', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<TaskPage>>;
  let component: TaskPage;

  beforeEach(async () => {
    const taskRepositoryMock: Pick<
      TaskRepository,
      'getTaskById' | 'archiveTask' | 'unarchiveTask' | 'setTaskActive' | 'deleteTask'
    > = {
      getTaskById: jasmine.createSpy('getTaskById').and.resolveTo(null),
      archiveTask: jasmine.createSpy('archiveTask').and.resolveTo(undefined),
      unarchiveTask: jasmine.createSpy('unarchiveTask').and.resolveTo(undefined),
      setTaskActive: jasmine.createSpy('setTaskActive').and.resolveTo(undefined),
      deleteTask: jasmine.createSpy('deleteTask').and.resolveTo(undefined),
    };

    const translateMock: Partial<TranslateService> = {
      instant: (key: string) => {
        const map: Record<string, string> = {
          'TASK.PRIORITY.LABEL': 'Priority',
          'TASK.PRIORITY.S': 'Essential',
          'TASK.PRIORITY.A': 'Important',
          'TASK.PRIORITY.B': 'Normal',
          'TASK.PRIORITY.C': 'Flexible',
          'TASK_DETAIL.MINUTES_SHORT': 'min',
          'TASK_DETAIL.TYPE_CHECK': 'Check',
          'TASK_DETAIL.VALUE_NO_TIME': 'No time',
          'TASK_DETAIL.VALUE_NO_RECURRENCE': 'No recurrence',
          'TASK_DETAIL.REMINDER_NONE': 'No notification',
          'TASK_DETAIL.LABEL_DAY': 'Day',
          'TASK_DETAIL.VALUE_SPECIFIC_DAYS': 'Specific days',
        };
        return map[key] ?? key;
      },
      get: (key: string | string[]) => of(key),
      stream: (key: string | string[]) => of(key),
      getStreamOnTranslationChange: (key: string | string[]) => of(key),
      currentLang: 'en-US',
      getDefaultLang: () => 'en-US',
      onTranslationChange: of({ lang: 'en-US', translations: {} }),
      onLangChange: of({ lang: 'en-US', translations: {} }),
      onDefaultLangChange: of({ lang: 'en-US', translations: {} }),
      onFallbackLangChange: of({ lang: 'en-US', translations: {} }),
    };

    const alertControllerMock: Pick<AlertController, 'create'> = {
      create: jasmine.createSpy('create').and.resolveTo({
        present: jasmine.createSpy('present').and.resolveTo(undefined),
        onDidDismiss: jasmine
          .createSpy('onDidDismiss')
          .and.resolveTo({ role: 'cancel' }),
      } as never),
    };

    const routerMock: Pick<
      Router,
      'navigate' | 'createUrlTree' | 'serializeUrl' | 'events'
    > = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
      createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue({} as never),
      serializeUrl: jasmine.createSpy('serializeUrl').and.returnValue('/task/task-1/edit'),
      events: of(),
    };

    await TestBed.configureTestingModule({
      imports: [TaskPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'task-1' }) } },
        },
        { provide: TaskRepository, useValue: taskRepositoryMock },
        { provide: TranslateService, useValue: translateMock },
        { provide: AlertController, useValue: alertControllerMock },
        {
          provide: NavController,
          useValue: {
            navigateForward: jasmine.createSpy('navigateForward'),
            navigateBack: jasmine.createSpy('navigateBack'),
            navigateRoot: jasmine.createSpy('navigateRoot'),
            back: jasmine.createSpy('back'),
          },
        },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskPage);
    component = fixture.componentInstance;
  });

  it('renders task priority in detail header', () => {
    component.task = buildAggregate({
      title: 'Priority task',
      priority: 'S',
      trackingMode: 'duration',
      estimatedDurationMin: 25,
    });

    fixture.detectChanges();

    const pageText = fixture.nativeElement.textContent
      ?.replace(/\s+/g, ' ')
      .trim();

    expect(pageText).toContain('TASK.PRIORITY.LABEL S');
    expect(pageText).toContain('Essential');
  });
});
