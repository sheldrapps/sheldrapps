import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

interface NewTaskForm {
  title: string;
  description: string;
  date: string;
  priority: 'low' | 'medium' | 'high';
}

@Component({
  standalone: true,
  selector: 'app-create-task',
  templateUrl: './create-task.page.html',
  styleUrls: ['./create-task.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonDatetime,
    IonSelect,
    IonSelectOption,
    IonButton,
    TranslateModule,
  ],
})
export class CreateTaskPage {
  private readonly router = inject(Router);

  form: NewTaskForm = {
    title: '',
    description: '',
    date: '',
    priority: 'medium',
  };

  async submit(): Promise<void> {
    await this.router.navigateByUrl('/tabs/tasks');
  }
}
