import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRange, IonItem, IonLabel } from '@ionic/angular/standalone';
import { EditorStateService } from '../../../editor-state.service';
import { RangeCustomEvent } from '@ionic/angular';

@Component({
  selector: 'cc-saturation-panel',
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel],
  template: `
    <ion-item>
      <ion-label>Saturation</ion-label>
      <ion-range 
        min="0" 
        max="2" 
        step="0.01" 
        [value]="editorState.saturation()"
        (ionInput)="onSaturationChange($event)"
        (ionKnobMoveStart)="editorState.onSliderStart()"
        (ionKnobMoveEnd)="editorState.onSliderEnd()"
        aria-label="Saturation"
      ></ion-range>
    </ion-item>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SaturationPanelComponent {
  readonly editorState = inject(EditorStateService);

  onSaturationChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.editorState.setSaturation(value);
  }
}
