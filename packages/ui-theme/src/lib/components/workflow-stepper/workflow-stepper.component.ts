import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmark } from 'ionicons/icons';
import type { WorkflowStep } from './workflow-stepper.types';

@Component({
  selector: 'sh-workflow-stepper',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './workflow-stepper.component.html',
  styleUrl: './workflow-stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowStepperComponent {
  readonly steps = input.required<readonly WorkflowStep[]>();
  readonly currentStep = input.required<number>();
  readonly selectableSteps = input<readonly number[]>([]);
  readonly stepSelected = output<number>();

  constructor() {
    addIcons({ checkmark });
  }

  protected getStatus(
    index: number,
  ): 'completed' | 'active' | 'pending' {
    if (index < this.currentStep()) {
      return 'completed';
    }

    if (index === this.currentStep()) {
      return 'active';
    }

    return 'pending';
  }

  protected isConnectorCompleted(index: number): boolean {
    return index <= this.currentStep();
  }

  protected selectStep(index: number): void {
    if (
      index > this.currentStep() &&
      !this.selectableSteps().includes(index)
    ) {
      return;
    }

    this.stepSelected.emit(index);
  }
}
