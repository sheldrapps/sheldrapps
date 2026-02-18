import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRange, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { EditorHistoryService } from "../../../editor-history.service";
import { RangeCustomEvent } from '@ionic/angular';

@Component({
  selector: "cc-saturation-panel",
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel, TranslateModule],
  templateUrl: "./saturation-panel.component.html",
  styleUrls: ["./saturation-panel.component.scss"],
})
export class SaturationPanelComponent {
  readonly history = inject(EditorHistoryService);

  onSaturationChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.history.setSaturation(value);
  }
}
