import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonRange, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { EditorHistoryService } from "../../../editor-history.service";
import { RangeCustomEvent } from '@ionic/angular';

@Component({
  selector: "cc-contrast-panel",
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel, TranslateModule],
  templateUrl: "./contrast-panel.component.html",
  styleUrls: ["./contrast-panel.component.scss"],
})
export class ContrastPanelComponent {
  readonly history = inject(EditorHistoryService);

  onContrastChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.history.setContrast(value);
  }
}
