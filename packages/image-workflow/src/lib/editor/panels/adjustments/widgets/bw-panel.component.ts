import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonToggle, IonItem, IonLabel } from '@ionic/angular/standalone';
import { EditorStateService } from '../../../editor-state.service';
import { CheckboxCustomEvent } from '@ionic/angular';

@Component({
  selector: 'cc-bw-panel',
  standalone: true,
  imports: [CommonModule, IonToggle, IonItem, IonLabel],
  template: `
    <ion-item>
      <ion-label>Black & White</ion-label>
      <ion-toggle 
        slot="end"
        [checked]="editorState.bw()"
        (ionChange)="onBwChange($event)"
        aria-label="Black and White"
      ></ion-toggle>
    </ion-item>
    <ion-item>
      <ion-label>Dithering</ion-label>
      <ion-toggle 
        slot="end"
        [checked]="editorState.dither()"
        [disabled]="!editorState.bw()"
        (ionChange)="onDitherChange($event)"
        aria-label="Dithering"
      ></ion-toggle>
    </ion-item>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class BwPanelComponent {
  readonly editorState = inject(EditorStateService);

  onBwChange(event: Event): void {
    const checked = (event as CheckboxCustomEvent).detail.checked;
    this.editorState.setBw(checked);
  }

  onDitherChange(event: Event): void {
    const checked = (event as CheckboxCustomEvent).detail.checked;
    this.editorState.setDither(checked);
  }
}
