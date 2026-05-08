import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from "@ionic/angular/standalone";
import {
  CheckboxCustomEvent,
  SelectCustomEvent,
} from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";
import { EditorHistoryService } from "../../../editor-history.service";
import type { DitheringMode } from "../../../../types";

@Component({
  selector: "cc-dither-panel",
  standalone: true,
  imports: [
    CommonModule,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonToggle,
    TranslateModule,
  ],
  templateUrl: "./dither-panel.component.html",
  styleUrls: ["./dither-panel.component.scss"],
})
export class DitherPanelComponent {
  readonly history = inject(EditorHistoryService);

  onDitheringChange(event: Event): void {
    const checked = (event as CheckboxCustomEvent).detail.checked;
    this.history.setDitheringEnabled(checked);
  }

  onModeChange(event: Event): void {
    const value =
      (event as SelectCustomEvent<DitheringMode>).detail.value ??
      "floyd-steinberg";
    this.history.setDitheringMode(value);
  }
}
