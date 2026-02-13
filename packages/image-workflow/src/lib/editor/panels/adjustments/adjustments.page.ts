import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorUiStateService } from "../../editor-ui-state.service";

@Component({
  selector: "cc-adjustments-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent],
  templateUrl: "./adjustments.page.html",
  styleUrls: ["./adjustments.page.scss"],
})
export class AdjustmentsPage {
  readonly ui = inject(EditorUiStateService);

  readonly adjustmentItems = [
    { id: "brightness", label: "Brightness" },
    { id: "saturation", label: "Saturation" },
    { id: "contrast", label: "Contrast" },
    { id: "bw", label: "B/W" },
  ] as ScrollableBarItem[];

  onSelectAdjustPanel(panelId: string): void {
    this.ui.togglePanel("adjustments", panelId);
  }
}
