import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-rating-prompt',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonButton,
  ],
  templateUrl: './rating-prompt.component.html',
  styleUrls: ['./rating-prompt.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class RatingPromptComponent {
  private readonly modalController = inject(ModalController);

  @Output() readonly rate = new EventEmitter<void>();
  @Output() readonly suggestions = new EventEmitter<void>();
  @Output() readonly problem = new EventEmitter<void>();
  @Output() readonly later = new EventEmitter<void>();

  onLater(): void {
    this.later.emit();
    void this.modalController.dismiss(undefined, 'later');
  }

  onRate(): void {
    this.rate.emit();
    void this.modalController.dismiss(undefined, 'rate');
  }

  onSuggestions(): void {
    this.suggestions.emit();
    void this.modalController.dismiss(undefined, 'suggestions');
  }

  onProblem(): void {
    this.problem.emit();
    void this.modalController.dismiss(undefined, 'problem');
  }
}
