import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonList,
  IonNote,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { createOutline, eyeOutline, trashOutline } from 'ionicons/icons';
import {
  TaskListItem,
  TaskRepository,
} from '../../database/repositories/task.repository';

interface TaskListView extends TaskListItem {
  isSample: boolean;
}

@Component({
  standalone: true,
  selector: 'app-tasks',
  templateUrl: './tasks.page.html',
  styleUrls: ['./tasks.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonIcon,
    IonNote,
    RouterLink,
    TranslateModule,
  ],
})
export class TasksPage {
  private readonly taskRepository = inject(TaskRepository);
  private readonly alertController = inject(AlertController);
  private readonly translate = inject(TranslateService);

  constructor() {
    addIcons({ eyeOutline, createOutline, trashOutline });
  }

  tasks: TaskListView[] = [];
  isLoading = false;
  loadFailed = false;
  deleteFailed = false;

  async ionViewWillEnter(): Promise<void> {
    await this.loadTasks();
  }

  taskBorderStyle(task: TaskListView): string {
    return `2px solid ${this.resolveTaskColor(task)}`;
  }

  taskBackgroundStyle(task: TaskListView): string {
    return this.withAlpha(this.resolveTaskColor(task), 0.11);
  }

  taskShadowStyle(task: TaskListView): string {
    return `0 0 0 1px ${this.withAlpha(this.resolveTaskColor(task), 0.12)}`;
  }

  taskDisplayTitle(task: TaskListView): string {
    if (task.isSample) {
      return this.translate.instant('TASKS.SAMPLE_TASK');
    }
    return task.title;
  }

  async confirmDeleteTask(task: TaskListView): Promise<void> {
    if (task.isSample) {
      return;
    }

    const alert = await this.alertController.create({
      header: `${this.translate.instant('COMMON.DELETE')}: ${task.title}`,
      buttons: [
        {
          text: this.translate.instant('COMMON.CANCEL'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('COMMON.DELETE'),
          role: 'confirm',
        },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') {
      return;
    }

    try {
      this.deleteFailed = false;
      await this.taskRepository.deleteTask(task.id);
      await this.loadTasks();
    } catch {
      this.deleteFailed = true;
    }
  }

  private async loadTasks(): Promise<void> {
    this.isLoading = true;
    this.loadFailed = false;
    this.deleteFailed = false;

    try {
      const taskRows = await this.taskRepository.listTasks();
      if (taskRows.length === 0) {
        this.tasks = [this.buildSampleTask()];
        return;
      }

      this.tasks = taskRows.map((task) => ({
        ...task,
        isSample: false,
      }));
    } catch {
      // In browser preview the native task repo may be unavailable; keep UX alive with sample task.
      this.tasks = [this.buildSampleTask()];
      this.loadFailed = false;
    } finally {
      this.isLoading = false;
    }
  }

  private buildSampleTask(): TaskListView {
    const nowIso = new Date().toISOString();
    return {
      id: 'sample-task',
      title: this.translate.instant('TASKS.SAMPLE_TASK'),
      description: null,
      trackingMode: 'duration',
      estimatedDurationMin: 45,
      categoryId: 'cat-health-sample',
      categoryName: this.translate.instant('CREATE_TASK.DEFAULT_CATEGORY_HEALTH'),
      categoryColor: '#10B981',
      isActive: true,
      isArchived: false,
      deletedAt: null,
      recurrenceEnabled: true,
      notificationsEnabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      isSample: true,
    };
  }

  private resolveTaskColor(task: TaskListView): string {
    return task.categoryColor ?? '#64748B';
  }

  private withAlpha(hexColor: string, alpha: number): string {
    const normalized = hexColor.trim();
    const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
    if (hex.length !== 6) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    if ([red, green, blue].some((value) => Number.isNaN(value))) {
      return 'rgba(0, 0, 0, 0.08)';
    }

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
