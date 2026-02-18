import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonToggle, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { EditorHistoryService } from "../../../editor-history.service";
import { CheckboxCustomEvent } from '@ionic/angular';

@Component({
  selector: "cc-bw-panel",
  standalone: true,
  imports: [CommonModule, IonToggle, IonItem, IonLabel, TranslateModule],
  templateUrl: "./bw-panel.component.html",
  styleUrls: ["./bw-panel.component.scss"],
})
export class BwPanelComponent {
  readonly history = inject(EditorHistoryService);

  onBwChange(event: Event): void {
    const checked = (event as CheckboxCustomEvent).detail.checked;
    this.history.setBw(checked);
  }

  onDitherChange(event: Event): void {
    const checked = (event as CheckboxCustomEvent).detail.checked;
    this.history.setDither(checked);
  }
}
