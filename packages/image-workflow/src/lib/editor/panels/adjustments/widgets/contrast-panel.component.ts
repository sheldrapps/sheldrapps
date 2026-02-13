import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRange, IonItem, IonLabel } from '@ionic/angular/standalone';
import { EditorStateService } from '../../../editor-state.service';
import { RangeCustomEvent } from '@ionic/angular';

@Component({
  selector: 'cc-contrast-panel',
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel],
  template: `
    <ion-item>
      <ion-label>Contrast</ion-label>
      <ion-range 
        min="0.5" 
        max="1.8" 
        step="0.01" 
        [value]="editorState.contrast()"
        (ionInput)="onContrastChange($event)"
        (ionKnobMoveStart)="editorState.onSliderStart()"
        (ionKnobMoveEnd)="editorState.onSliderEnd()"
        aria-label="Contrast"
      ></ion-range>
    </ion-item>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ContrastPanelComponent {
  readonly editorState = inject(EditorStateService);

  onContrastChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.editorState.setContrast(value);
  }
}
