import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRange, IonItem, IonLabel } from '@ionic/angular/standalone';
import { EditorStateService } from '../../../editor-state.service';
import { RangeCustomEvent } from '@ionic/angular';

@Component({
  selector: "cc-saturation-panel",
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel],
  templateUrl: "./saturation-panel.component.html",
  styleUrls: ["./saturation-panel.component.scss"],
})
export class SaturationPanelComponent {
  readonly editorState = inject(EditorStateService);

  onSaturationChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.editorState.setSaturation(value);
  }
}
