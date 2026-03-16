import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CategoryRepository,
  TaskCategory,
} from '../database/repositories/category.repository';

@Component({
  standalone: true,
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonNote,
  ],
})
export class CategoriesPage {
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly alertController = inject(AlertController);
  private readonly translate = inject(TranslateService);

  categories: TaskCategory[] = [];
  isLoading = false;
  loadFailed = false;
  deleteFailed = false;

  async ionViewWillEnter(): Promise<void> {
    await this.loadCategories();
  }

  async confirmDeleteCategory(category: TaskCategory): Promise<void> {
    const alert = await this.alertController.create({
      header: this.translate.instant('CATEGORIES.DELETE_CONFIRM_TITLE', {
        name: category.name,
      }),
      message: this.translate.instant('CATEGORIES.DELETE_CONFIRM_MESSAGE'),
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
      await this.categoryRepository.deleteCategory(category.id);
      await this.loadCategories();
    } catch {
      this.deleteFailed = true;
    }
  }

  private async loadCategories(): Promise<void> {
    this.isLoading = true;
    this.loadFailed = false;
    this.deleteFailed = false;

    try {
      this.categories = await this.categoryRepository.listCategories();
    } catch {
      this.categories = [];
      this.loadFailed = true;
    } finally {
      this.isLoading = false;
    }
  }
}

