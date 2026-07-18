import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
import { LoadingStateComponent } from '@sheldrapps/ui-theme';
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
  selector: 'app-category-edit',
  templateUrl: './category-edit.page.html',
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
    LoadingStateComponent,
  ],
})
export class CategoryEditPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly categoryRepository = inject(CategoryRepository);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly form = this.fb.nonNullable.group({
    name: '',
  });

  category: TaskCategory | null = null;
  categories: TaskCategory[] = [];
  submitAttempted = false;
  nameTouched = false;
  isLoading = false;
  loadFailed = false;
  saveFailed = false;
  notFound = false;
  private persistedValidationError: CategoryNameValidationError | null = null;

  async ionViewWillEnter(): Promise<void> {
    await this.loadCategory();
  }

  get validationMessageKey(): string | null {
    const error = this.visibleValidationError;
    if (!error) {
      return null;
    }

    return categoryNameValidationErrorToI18nKey(error);
  }

  get saveDisabled(): boolean {
    return (
      this.isSaving ||
      this.isLoading ||
      this.category === null ||
      this.currentValidation.error !== null
    );
  }

  private isSaving = false;

  onNameBlur(): void {
    this.nameTouched = true;
  }

  async submit(): Promise<void> {
    if (!this.category) {
      return;
    }

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
      await this.categoryRepository.updateCategory(
        this.category.id,
        validation.normalizedName
      );
      await this.router.navigate(['/categories']);
    } catch (error: unknown) {
      const validationError = this.resolveValidationError(error);
      if (validationError) {
        this.persistedValidationError = validationError;
        await this.refreshCategories();
      } else if (error instanceof Error && error.message.includes('Category not found')) {
        this.notFound = true;
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
      this.categories.map((category) => category.name),
      { excludeName: this.category?.name ?? null }
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

  private async loadCategory(): Promise<void> {
    const categoryId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!categoryId) {
      this.notFound = true;
      this.category = null;
      return;
    }

    this.isLoading = true;
    this.loadFailed = false;
    this.notFound = false;
    try {
      const [category, categories] = await Promise.all([
        this.categoryRepository.getCategoryById(categoryId),
        this.refreshCategories(),
      ]);

      if (!category) {
        this.category = null;
        this.categories = categories;
        this.notFound = true;
        return;
      }

      this.category = category;
      this.form.controls.name.setValue(category.name, { emitEvent: false });
    } catch {
      this.category = null;
      this.categories = [];
      this.loadFailed = true;
    } finally {
      this.isLoading = false;
      await this.flushUi();
    }
  }

  private async refreshCategories(): Promise<TaskCategory[]> {
    const categories = await this.categoryRepository.listCategories();
    this.categories = categories;
    return categories;
  }

  private runInZone<T>(fn: () => T): T {
    return NgZone.isInAngularZone() ? fn() : this.zone.run(fn);
  }

  private async flushUi(): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }
    this.runInZone(() => {
      this.changeDetector.markForCheck();
      this.changeDetector.detectChanges();
    });
  }
}
