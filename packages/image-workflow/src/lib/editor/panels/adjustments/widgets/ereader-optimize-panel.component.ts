import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonItem, IonLabel, IonNote, IonToggle } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { EditorHistoryService } from "../../../editor-history.service";
import { CheckboxCustomEvent } from "@ionic/angular";

@Component({
  selector: "cc-ereader-optimize-panel",
  standalone: true,
  imports: [CommonModule, IonItem, IonLabel, IonNote, IonToggle, TranslateModule],
  templateUrl: "./ereader-optimize-panel.component.html",
  styleUrls: ["./ereader-optimize-panel.component.scss"],
})
export class EreaderOptimizePanelComponent {
  readonly history = inject(EditorHistoryService);

  onOptimizationToggle(event: Event): void {
    const enabled = (event as CheckboxCustomEvent).detail.checked;
    this.history.toggleEReaderOptimization(enabled);
  }
}
