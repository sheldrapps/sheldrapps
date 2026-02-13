import { Component, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorUiStateService } from "../../editor-ui-state.service";

@Component({
  selector: "cc-tools-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent],
  templateUrl: "./tools.page.html",
  styleUrls: ["./tools.page.scss"],
})
export class ToolsPage {
  readonly ui = inject(EditorUiStateService);

  readonly toolItems = computed(() => {
    const config = this.ui.toolsConfig();
    const cropLabel = config?.labels?.cropLabel ?? "Crop";
    const rotateLabel = "Rotate";
    const zoomLabel = "Zoom";

    return [
      { id: "crop", label: cropLabel },
      { id: "rotate", label: rotateLabel },
      { id: "zoom", label: zoomLabel },
    ] as ScrollableBarItem[];
  });

  onSelectTool(panelId: string): void {
    this.ui.togglePanel("tools", panelId);
  }
}
