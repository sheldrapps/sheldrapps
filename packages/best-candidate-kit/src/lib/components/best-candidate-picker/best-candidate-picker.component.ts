import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { IonCard, IonSpinner } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { BestCandidateImage, BestCandidateHint } from '../../models/best-candidate-image.model';
import { BestCandidateResult } from '../../models/best-candidate-score.model';

@Component({
  selector: 'best-candidate-picker',
  standalone: true,
  imports: [CommonModule, TranslateModule, IonCard, IonSpinner],
  templateUrl: './best-candidate-picker.component.html',
  styleUrls: ['./best-candidate-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BestCandidatePickerComponent {
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
  private readonly LONG_PRESS_MS = 420;

  get limitedCandidates(): BestCandidateResult[] {
    return this.candidates.slice(0, 3);
  }

  onCandidatePointerDown(candidate: BestCandidateImage): void {
    if (this.disabled || !this.enableLongPressPreview) return;
    this.clearLongPressTimer();
    this.longPressTriggered = false;
    this.pressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.candidatePreviewRequested.emit(candidate);
    }, this.LONG_PRESS_MS);
  }

  onCandidatePointerUp(candidate: BestCandidateImage): void {
    if (this.disabled) return;
    // Capture state before clearing to avoid race condition with the timeout callback
    const wasLongPress = this.longPressTriggered;
    this.clearLongPressTimer();
    // Emit selection only if this wasn't a long press
    if (!wasLongPress) {
      this.candidateSelected.emit(candidate);
    }
    this.longPressTriggered = false;
  }

  onCandidatePointerCancel(): void {
    this.clearLongPressTimer();
    this.longPressTriggered = false;
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
