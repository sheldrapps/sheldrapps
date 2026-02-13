import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRange, IonItem, IonLabel } from '@ionic/angular/standalone';
import { EditorStateService } from '../../../editor-state.service';
import { RangeCustomEvent } from '@ionic/angular';

@Component({
  selector: 'cc-brightness-panel',
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel],
  template: `
    <ion-item>
      <ion-label>Brightness</ion-label>
      <ion-range 
        min="0.5" 
        max="1.5" 
        step="0.01" 
        [value]="editorState.brightness()"
        (ionInput)="onBrightnessChange($event)"
        (ionKnobMoveStart)="editorState.onSliderStart()"
        (ionKnobMoveEnd)="editorState.onSliderEnd()"
        aria-label="Brightness"
      ></ion-range>
    </ion-item>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class BrightnessPanelComponent {
  readonly editorState = inject(EditorStateService);

  onBrightnessChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.editorState.setBrightness(value);
  }
}
