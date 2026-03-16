import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import {
  CategoryNameValidationError,
  CategoryNameValidationException,
  categoryNameValidationErrorToI18nKey,
  validateCategoryName,
} from '../database/repositories/category-name.validation';
import {
  CategoryRepository,
  TaskCategory,
} from '../database/repositories/category.repository';

@Component({
  standalone: true,
  selector: 'app-category-create',
  templateUrl: './category-create.page.html',
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
    IonInput,
    IonNote,
    IonButton,
  ],
})
export class CategoryCreatePage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly categoryRepository = inject(CategoryRepository);

  readonly form = this.fb.nonNullable.group({
    name: '',
  });

  categories: TaskCategory[] = [];
  submitAttempted = false;
  nameTouched = false;
  isSaving = false;
  loadFailed = false;
  saveFailed = false;
  private persistedValidationError: CategoryNameValidationError | null = null;

  async ionViewWillEnter(): Promise<void> {
    await this.loadCategories();
  }

  get validationMessageKey(): string | null {
    const error = this.visibleValidationError;
    if (!error) {
      return null;
    }

    return categoryNameValidationErrorToI18nKey(error);
  }

  get saveDisabled(): boolean {
    return this.isSaving || this.currentValidation.error !== null;
  }

  onNameBlur(): void {
    this.nameTouched = true;
  }

  async submit(): Promise<void> {
    this.submitAttempted = true;
    this.nameTouched = true;
    this.saveFailed = false;
    this.persistedValidationError = null;

    const validation = this.currentValidation;
    if (validation.error) {
      return;
    }

    this.isSaving = true;
    try {
      await this.categoryRepository.createCategory(validation.normalizedName);
      await this.router.navigate(['/categories']);
    } catch (error: unknown) {
      const validationError = this.resolveValidationError(error);
      if (validationError) {
        this.persistedValidationError = validationError;
        await this.loadCategories();
      } else {
        this.saveFailed = true;
      }
    } finally {
      this.isSaving = false;
    }
  }

  private get visibleValidationError(): CategoryNameValidationError | null {
    if (this.persistedValidationError) {
      return this.persistedValidationError;
    }

    if (!this.nameTouched && !this.submitAttempted) {
      return null;
    }

    return this.currentValidation.error;
  }

  private get currentValidation() {
    return validateCategoryName(
      this.form.controls.name.value,
      this.categories.map((category) => category.name)
    );
  }

  private resolveValidationError(
    error: unknown
  ): CategoryNameValidationError | null {
    if (error instanceof CategoryNameValidationException) {
      return error.code;
    }

    if (!(error instanceof Error)) {
      return null;
    }

    const message = error.message.toLowerCase();
    if (
      message.includes('unique constraint failed: categories.name') ||
      message.includes('idx_categories_name_ci')
    ) {
      return 'duplicate';
    }

    return null;
  }

  private async loadCategories(): Promise<void> {
    this.loadFailed = false;
    try {
      this.categories = await this.categoryRepository.listCategories();
    } catch {
      this.categories = [];
      this.loadFailed = true;
    }
  }
}

