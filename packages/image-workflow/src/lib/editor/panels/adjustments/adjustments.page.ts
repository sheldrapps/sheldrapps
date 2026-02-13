import { Component, inject } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from "@angular/common";
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorUiStateService } from "../../editor-ui-state.service";

@Component({
  selector: "cc-adjustments-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent, TranslateModule],
  templateUrl: "./adjustments.page.html",
  styleUrls: ["./adjustments.page.scss"],
})
export class AdjustmentsPage {
  readonly ui = inject(EditorUiStateService);

  readonly adjustmentItems = [
    {
      id: "brightness",
      labelKey:
        "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BRIGHTNESS",
    },
    {
      id: "saturation",
      labelKey:
        "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.SATURATION",
    },
    {
      id: "contrast",
      labelKey: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.CONTRAST",
    },
    {
      id: "bw",
      labelKey: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BW",
    },
    {
      id: "dither",
      labelKey: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.DITHER",
    },
  ] as ScrollableBarItem[];

  onSelectAdjustPanel(panelId: string): void {
    this.ui.togglePanel("adjustments", panelId);
  }
}
