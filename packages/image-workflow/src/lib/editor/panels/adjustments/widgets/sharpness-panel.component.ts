import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonRange, IonItem, IonLabel, RangeCustomEvent } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { EditorHistoryService } from "../../../editor-history.service";

@Component({
  selector: "cc-sharpness-panel",
  standalone: true,
  imports: [CommonModule, IonRange, IonItem, IonLabel, TranslateModule],
  templateUrl: "./sharpness-panel.component.html",
  styleUrls: ["./sharpness-panel.component.scss"],
})
export class SharpnessPanelComponent {
  readonly history = inject(EditorHistoryService);

  onSharpnessChange(event: Event): void {
    const value = (event as RangeCustomEvent).detail.value as number;
    this.history.setSharpness(value);
  }
}

