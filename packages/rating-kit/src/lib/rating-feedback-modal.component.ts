import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  DEFAULT_RATING_FEEDBACK_OPTIONS,
  type RatingFeedbackOption,
  type RatingFeedbackOptionId,
  type RatingFeedbackMode,
  type RatingFeedbackSubmission,
} from './rating.types';

@Component({
  selector: 'app-rating-feedback-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonContent,
    IonTextarea,
  ],
  templateUrl: './rating-feedback-modal.component.html',
  styleUrls: ['./rating-feedback-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingFeedbackModalComponent {
  private readonly modalController = inject(ModalController);
  private readonly translate = inject(TranslateService);

  @Input() mode: RatingFeedbackMode = 'problem';
  @Input() feedbackOptions: readonly RatingFeedbackOption[] =
    DEFAULT_RATING_FEEDBACK_OPTIONS;

  selectedOptionId: RatingFeedbackOptionId =
    DEFAULT_RATING_FEEDBACK_OPTIONS[0].id;
  details = '';

  get titleKey(): string {
    return this.mode === 'suggestion'
      ? 'RATING.SUGGESTIONS.TITLE'
      : 'RATING.FEEDBACK.TITLE';
  }

  get messageKey(): string {
    return this.mode === 'suggestion'
      ? 'RATING.SUGGESTIONS.MESSAGE'
      : 'RATING.FEEDBACK.MESSAGE';
  }

  get placeholderKey(): string {
    return this.mode === 'suggestion'
      ? 'RATING.SUGGESTIONS.PLACEHOLDER'
      : 'RATING.FEEDBACK.PLACEHOLDER';
  }

  get showOptions(): boolean {
    return this.mode === 'problem';
  }

  selectOption(optionId: RatingFeedbackOptionId): void {
    this.selectedOptionId = optionId;
  }

  cancel(): void {
    void this.modalController.dismiss(undefined, 'cancel');
  }

  send(): void {
    const payload: RatingFeedbackSubmission = {
      mode: this.mode,
      optionId: this.selectedOptionId,
      details: this.details.trim() || undefined,
    };

    if (this.mode === 'suggestion') {
      delete payload.optionId;
    }

    void this.modalController.dismiss(payload, 'send');
  }

  trackByOptionId(_: number, option: RatingFeedbackOption): string {
    return option.id;
  }

  resolveOptionLabel(option: RatingFeedbackOption): string {
    const translated = this.translate.instant(option.labelKey);
    return translated && translated !== option.labelKey
      ? translated
      : option.fallbackLabel;
  }
}
