import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonRow,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CategoryNameValidationError,
  CategoryNameValidationException,
  categoryNameValidationErrorToI18nKey,
  validateCategoryName,
} from '../database/repositories/category-name.validation';
import {
  CATEGORY_COLOR_PALETTE,
  CategoryRepository,
  TaskCategory,
} from '../database/repositories/category.repository';
import { environment } from '../../environments/environment';

const QUICK_CATEGORY_ICONS = [
  '\u{1F4BC}',
  '\u{1F4DA}',
  '\u{1F3E0}',
  '\u{2764}\u{FE0F}',
  '\u{26A1}',
  '\u{1F9E0}',
  '\u{1F3AF}',
] as const;
const QUICK_CATEGORY_COLORS = [
  '#6366F1',
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
] as const;

type CategoryColor = (typeof CATEGORY_COLOR_PALETTE)[number];
type EmojiValidationError = 'none' | 'multiple' | 'invalid';
type EmojiDraftKind = 'empty' | 'valid' | 'multiple' | 'invalid';

type SegmentRecord = { segment: string };

type SegmenterLike = {
  segment(value: string): Iterable<SegmentRecord>;
};

type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity: 'grapheme' }
) => SegmenterLike;

interface EmojiDraftAnalysis {
  kind: EmojiDraftKind;
  emoji: string | null;
}

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
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonModal,
    IonNote,
    IonButton,
  ],
})
export class CategoryCreatePage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly translate = inject(TranslateService);
  private readonly categoryRepository = inject(CategoryRepository);
  @ViewChild('emojiInput', { static: false }) private emojiInput?: IonInput;

  readonly quickColorPalette = [...QUICK_CATEGORY_COLORS];
  readonly allColorPalette = [...CATEGORY_COLOR_PALETTE];
  readonly quickIconOptions = [...QUICK_CATEGORY_ICONS];
  readonly quickColorButtonHeightPx = 52;
  readonly quickIconButtonHeightPx = 64;

  readonly form = this.fb.group({
    name: this.fb.nonNullable.control(''),
    color: this.fb.nonNullable.control<CategoryColor>(this.quickColorPalette[0]),
    icon: this.fb.control<string | null>(null),
    description: this.fb.control<string | null>(null),
  });

  categories: TaskCategory[] = [];
  submitAttempted = false;
  nameTouched = false;
  isSaving = false;
  loadFailed = false;
  saveFailed = false;
  isColorPickerOpen = false;
  isEmojiPickerOpen = false;
  emojiDraft = '';
  isValidEmoji = false;
  emojiValidationError: EmojiValidationError = 'none';
  private emojiDraftValidValue: string | null = null;

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

  get selectedColor(): CategoryColor {
    return this.form.controls.color.value;
  }

  get selectedIcon(): string | null {
    return this.form.controls.icon.value;
  }

  get previewName(): string {
    return this.form.controls.name.value.trim();
  }

  get previewDescription(): string | null {
    const value = this.form.controls.description.value;
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  get previewBorderStyle(): string {
    return `2px solid ${this.selectedColor}`;
  }

  get previewBackgroundStyle(): string {
    return this.withAlpha(this.selectedColor, 0.11);
  }

  get previewShadowStyle(): string {
    return `0 0 0 1px ${this.withAlpha(this.selectedColor, 0.12)}`;
  }

  get previewIconBackgroundStyle(): string {
    return this.withAlpha(this.selectedColor, 0.2);
  }

  get emojiDraftPreview(): string | null {
    return this.isValidEmoji ? this.emojiDraftValidValue : null;
  }

  get emojiValidationMessageKey(): string | null {
    if (this.emojiValidationError === 'multiple') {
      return 'CATEGORY_FORM.EMOJI_MULTIPLE';
    }

    if (this.emojiValidationError === 'invalid') {
      return 'CATEGORY_FORM.EMOJI_INVALID';
    }

    return null;
  }

  onNameBlur(): void {
    this.nameTouched = true;
  }

  onNameInput(): void {
    this.persistedValidationError = null;
    this.saveFailed = false;
  }

  selectColor(color: CategoryColor): void {
    this.form.controls.color.setValue(color);
  }

  selectExpandedColor(color: CategoryColor): void {
    this.selectColor(color);
    this.closeColorPicker();
  }

  toggleIcon(icon: string): void {
    this.form.controls.icon.setValue(this.selectedIcon === icon ? null : icon);
  }

  openColorPicker(): void {
    this.isColorPickerOpen = true;
  }

  closeColorPicker(): void {
    this.isColorPickerOpen = false;
  }

  openEmojiPicker(): void {
    this.emojiDraft = this.selectedIcon ?? '';
    this.updateEmojiDraftState({ showInvalid: false });
    this.isEmojiPickerOpen = true;
  }

  closeEmojiPicker(): void {
    this.isEmojiPickerOpen = false;
    this.emojiDraft = '';
    this.isValidEmoji = false;
    this.emojiValidationError = 'none';
    this.emojiDraftValidValue = null;
  }

  onEmojiDraftInput(event: Event): void {
    const nextValue = (event as CustomEvent<{ value?: string | null }>).detail?.value;
    this.emojiDraft = typeof nextValue === 'string' ? nextValue : '';
    this.updateEmojiDraftState({ showInvalid: false });
  }

  applyEmojiSelection(): void {
    const analysis = this.updateEmojiDraftState({ showInvalid: true });
    if (analysis.kind === 'empty') {
      this.form.controls.icon.setValue(null);
      this.closeEmojiPicker();
      return;
    }

    if (analysis.kind === 'valid') {
      this.form.controls.icon.setValue(analysis.emoji);
      this.closeEmojiPicker();
    }
  }

  clearIconSelection(): void {
    this.form.controls.icon.setValue(null);
    this.closeEmojiPicker();
  }

  focusEmojiInput(): void {
    setTimeout(() => {
      void this.emojiInput?.setFocus();
    }, 100);
  }

  pickerTileBorderStyle(): string {
    return '1px solid rgba(0, 0, 0, 0.25)';
  }

  pickerTileInsetShadowStyle(): string {
    return 'inset 0 0 0 1px rgba(255, 255, 255, 0.25)';
  }

  colorTileOutline(color: CategoryColor): string {
    return this.selectedColor === color
      ? 'var(--app-space-hairline) solid rgba(0, 0, 0, 0.85)'
      : 'none';
  }

  iconTileOutline(icon: string): string {
    return this.selectedIcon === icon
      ? 'var(--app-space-hairline) solid rgba(0, 0, 0, 0.85)'
      : 'none';
  }

  iconTileBackground(icon: string): string {
    return this.selectedIcon === icon
      ? this.withAlpha(this.selectedColor, 0.2)
      : 'var(--ion-color-step-50, #f3f4f6)';
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
      await this.categoryRepository.createCategory({
        name: validation.normalizedName,
        color: this.selectedColor,
        icon: this.selectedIcon,
        description: this.previewDescription,
      });
      await this.presentToast('CATEGORY_FORM.SUCCESS_CREATED', 'success');
      await this.router.navigate(['/categories']);
    } catch (error: unknown) {
      const validationError = this.resolveValidationError(error);
      if (validationError) {
        this.persistedValidationError = validationError;
        await this.loadCategories();
      } else {
        if (environment.debugDatabase) {
          console.error('[category-create] create failed', error);
        }
        await this.presentToast('CATEGORY_FORM.ERROR_CREATE', 'danger');
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
      message.includes('idx_categories_name_ci') ||
      message.includes('already exists') ||
      message.includes('duplicate')
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

  private async presentToast(
    messageKey: string,
    color: 'success' | 'danger'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message: this.translate.instant(messageKey),
      duration: 1400,
      position: 'bottom',
      color,
    });
    await toast.present();
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

  private updateEmojiDraftState(options: { showInvalid: boolean }): EmojiDraftAnalysis {
    const analysis = this.analyzeEmojiDraft(this.emojiDraft);
    this.isValidEmoji = analysis.kind === 'valid';
    this.emojiDraftValidValue = analysis.emoji;

    if (analysis.kind === 'multiple') {
      this.emojiValidationError = 'multiple';
      return analysis;
    }

    if (analysis.kind === 'invalid' && options.showInvalid) {
      this.emojiValidationError = 'invalid';
      return analysis;
    }

    this.emojiValidationError = 'none';
    return analysis;
  }

  private analyzeEmojiDraft(value: string): EmojiDraftAnalysis {
    const trimmed = value.trim();
    if (!trimmed) {
      return { kind: 'empty', emoji: null };
    }

    const graphemes = this.segmentGraphemes(trimmed);
    const emojiPattern = /\p{Extended_Pictographic}/u;
    const emojiSegments: string[] = [];
    let hasNonEmojiContent = false;

    for (const grapheme of graphemes) {
      if (emojiPattern.test(grapheme)) {
        emojiSegments.push(grapheme);
        continue;
      }

      if (grapheme.trim().length > 0) {
        hasNonEmojiContent = true;
      }
    }

    if (emojiSegments.length === 0) {
      return { kind: 'invalid', emoji: null };
    }

    if (emojiSegments.length > 1) {
      return { kind: 'multiple', emoji: null };
    }

    if (hasNonEmojiContent) {
      return { kind: 'invalid', emoji: null };
    }

    return { kind: 'valid', emoji: emojiSegments[0] };
  }

  private segmentGraphemes(value: string): string[] {
    const segmenterCtor = (
      Intl as unknown as { Segmenter?: SegmenterCtor }
    ).Segmenter;

    if (!segmenterCtor) {
      return Array.from(value);
    }

    const segmenter = new segmenterCtor(undefined, {
      granularity: 'grapheme',
    });

    return Array.from(segmenter.segment(value), (entry) => entry.segment);
  }
}
