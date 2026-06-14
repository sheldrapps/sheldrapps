import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';

export type EditProjectChoice = 'overwrite' | 'copy';

@Component({
  selector: 'sh-edit-project-choice-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFooter,
    IonButtons,
    IonButton,
  ],
  templateUrl: './edit-project-choice-modal.component.html',
  styleUrls: ['./edit-project-choice-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProjectChoiceModalComponent {
  private readonly modalController = inject(ModalController);

  @Input() title = '';
  @Input() message = '';
  @Input() overwriteLabel = '';
  @Input() overwriteDescription = '';
  @Input() copyLabel = '';
  @Input() copyDescription = '';
  @Input() cancelLabel = '';

  chooseOverwrite(): void {
    void this.modalController.dismiss(undefined, 'overwrite');
  }

  chooseCopy(): void {
    void this.modalController.dismiss(undefined, 'copy');
  }

  cancel(): void {
    void this.modalController.dismiss(undefined, 'cancel');
  }
}
