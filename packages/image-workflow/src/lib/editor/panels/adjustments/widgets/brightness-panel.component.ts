import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRange, IonItem, IonLabel } from '@ionic/angular/standalone';
import { EditorStateService } from '../../../editor-state.service';
import { RangeCustomEvent } from '@ionic/angular';

@Component({
  selector: "cc-brightness-panel",
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel],
  templateUrl: "./brightness-panel.component.html",
  styleUrls: ["./brightness-panel.component.scss"],
})
export class BrightnessPanelComponent {
  readonly editorState = inject(EditorStateService);

  onBrightnessChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.editorState.setBrightness(value);
  }
}
