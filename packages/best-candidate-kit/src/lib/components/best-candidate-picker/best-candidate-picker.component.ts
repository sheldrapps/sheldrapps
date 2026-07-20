import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import { IonCard, IonSpinner } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BestCandidateImage, BestCandidateHint } from '../../models/best-candidate-image.model';
import { BestCandidateResult } from '../../models/best-candidate-score.model';
import { registerBestCandidateKitTranslations } from '../../translations/best-candidate-kit-i18n';

@Component({
  selector: 'best-candidate-picker',
  standalone: true,
  imports: [CommonModule, TranslateModule, IonCard, IonSpinner],
  templateUrl: './best-candidate-picker.component.html',
  styleUrls: ['./best-candidate-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BestCandidatePickerComponent {
  private readonly translate = inject(TranslateService);

  @Input() candidates: BestCandidateResult[] = [];
  @Input() loading = false;
  @Input() disabled = false;
  @Input() selectedCandidateId?: string;
  @Input() showReasons = true;
  @Input() showHeader = true;
  @Input() compact = false;
  @Input() enableLongPressPreview = true;

  @Output() candidateSelected = new EventEmitter<BestCandidateImage>();
  @Output() candidatePreviewRequested = new EventEmitter<BestCandidateImage>();

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTriggered = false;
  private suppressNextClick = false;
  private readonly LONG_PRESS_MS = 420;

  constructor() {
    registerBestCandidateKitTranslations(this.translate);
  }

  get limitedCandidates(): BestCandidateResult[] {
    return this.candidates.slice(0, 3);
  }

  onCandidatePointerDown(candidate: BestCandidateImage): void {
    if (this.disabled || !this.enableLongPressPreview) return;
    this.clearLongPressTimer();
    this.longPressTriggered = false;
    this.suppressNextClick = false;
    this.pressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.suppressNextClick = true;
      this.candidatePreviewRequested.emit(candidate);
    }, this.LONG_PRESS_MS);
  }

  onCandidatePointerUp(): void {
    if (this.disabled) return;
    this.clearLongPressTimer();
  }

  onCandidatePointerCancel(): void {
    const wasLongPress = this.longPressTriggered;
    this.clearLongPressTimer();
    this.longPressTriggered = false;
    if (!wasLongPress) {
      this.suppressNextClick = false;
    }
  }

  onCandidateClick(candidate: BestCandidateImage, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled) return;

    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }

    this.candidateSelected.emit(candidate);
  }

  requestPreview(candidate: BestCandidateImage, event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.candidatePreviewRequested.emit(candidate);
  }

  reasonKey(reason: BestCandidateHint): string {
    switch (reason) {
      case 'first-large-image':
        return 'BEST_CANDIDATE.REASON.FIRST_LARGE_IMAGE';
      case 'cover-ratio':
        return 'BEST_CANDIDATE.REASON.COVER_RATIO';
      case 'near-book-start':
        return 'BEST_CANDIDATE.REASON.NEAR_BOOK_START';
      case 'filename-cover':
      case 'filename-front':
        return 'BEST_CANDIDATE.REASON.FILENAME_COVER';
      case 'large-resolution':
        return 'BEST_CANDIDATE.REASON.LARGE_RESOLUTION';
      case 'metadata-cover':
        return 'BEST_CANDIDATE.REASON.METADATA_COVER';
      case 'small-icon-risk':
        return 'BEST_CANDIDATE.REASON.SMALL_ICON_RISK';
      case 'decorative-risk':
        return 'BEST_CANDIDATE.REASON.DECORATIVE_RISK';
      default:
        return 'BEST_CANDIDATE.REASON.COVER_RATIO';
    }
  }

  isSelected(candidate: BestCandidateResult): boolean {
    return candidate.image.id === this.selectedCandidateId;
  }

  trackByCandidate = (_: number, candidate: BestCandidateResult) => candidate.image.id;

  private clearLongPressTimer(): void {
    if (!this.pressTimer) return;
    clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }
}
