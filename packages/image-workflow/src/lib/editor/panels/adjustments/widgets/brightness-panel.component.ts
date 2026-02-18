import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRange, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { EditorHistoryService } from "../../../editor-history.service";
import { RangeCustomEvent } from '@ionic/angular';

@Component({
  selector: "cc-brightness-panel",
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel, TranslateModule],
  templateUrl: "./brightness-panel.component.html",
  styleUrls: ["./brightness-panel.component.scss"],
})
export class BrightnessPanelComponent {
  readonly history = inject(EditorHistoryService);

  onBrightnessChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.history.setBrightness(value);
  }
}
