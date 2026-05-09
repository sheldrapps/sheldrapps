import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { BestCandidateImage } from '../../models/best-candidate-image.model';

@Component({
  selector: 'best-candidate-preview-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar],
  templateUrl: './best-candidate-preview-modal.component.html',
  styleUrls: ['./best-candidate-preview-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BestCandidatePreviewModalComponent {
  @Input() candidate?: BestCandidateImage;
  @Input() allowSelect = true;

  @Output() selected = new EventEmitter<BestCandidateImage>();
  @Output() closed = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }

  onSelect(): void {
    if (!this.candidate) return;
    this.selected.emit(this.candidate);
  }
}
