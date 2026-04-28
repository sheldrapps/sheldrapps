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
  IonIcon,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  LoadingStateComponent,
  THEME_ACCENT_BACKGROUND_FALLBACK,
  withThemeAlpha,
} from '@sheldrapps/ui-theme';
import { addIcons } from 'ionicons';
import { createOutline, trashOutline } from 'ionicons/icons';
import {
  CategoryRepository,
  TaskCategory,
} from '../database/repositories/category.repository';

@Component({
  standalone: true,
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
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
    IonIcon,
    IonButton,
    IonNote,
    LoadingStateComponent,
  ],
})
export class CategoriesPage {
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly alertController = inject(AlertController);
  private readonly translate = inject(TranslateService);

  constructor() {
    addIcons({ createOutline, trashOutline });
  }

  categories: TaskCategory[] = [];
  isLoading = false;
  loadFailed = false;
  deleteFailed = false;

  categoryBorderColor(category: TaskCategory): string {
    return category.color;
  }

  categoryBackgroundColor(category: TaskCategory): string {
    return this.withAlpha(category.color, 0.11);
  }

  categoryShadowColor(category: TaskCategory): string {
    return this.withAlpha(category.color, 0.12);
  }

  categoryIconBackgroundStyle(category: TaskCategory): string {
    return this.withAlpha(category.color, 0.2);
  }

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

  private withAlpha(hexColor: string, alpha: number): string {
    return withThemeAlpha(hexColor, alpha, THEME_ACCENT_BACKGROUND_FALLBACK);
  }
}
