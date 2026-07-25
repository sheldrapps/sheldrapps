import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, arrowForward } from 'ionicons/icons';

@Component({
  selector: 'sh-workflow-navigation',
  standalone: true,
  imports: [IonButton, IonIcon, IonSpinner],
  templateUrl: './workflow-navigation.component.html',
  styleUrl: './workflow-navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowNavigationComponent {
  readonly showPrevious = input(true);
  readonly showNext = input(true);
  readonly previousDisabled = input(false);
  readonly previousLabel = input.required<string>();
  readonly previousIcon = input('arrow-back');
  readonly nextDisabled = input(false);
  readonly nextLabel = input.required<string>();
  readonly nextIcon = input('arrow-forward');
  readonly nextLoading = input(false);

  readonly previous = output<void>();
  readonly next = output<void>();

  constructor() {
    addIcons({ arrowBack, arrowForward });
  }
}
