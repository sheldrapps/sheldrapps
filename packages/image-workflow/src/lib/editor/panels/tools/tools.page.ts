import { Component, inject, computed } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from "@angular/common";
import {
  ScrollableButtonBarComponent,
  ScrollableBarItem,
} from "@sheldrapps/ui-theme";
import { EditorUiStateService } from "../../editor-ui-state.service";
import { TOOLS_REGISTRY } from "./tools.registry";

@Component({
  selector: "cc-tools-page",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent, TranslateModule],
  templateUrl: "./tools.page.html",
  styleUrls: ["./tools.page.scss"],
})
export class ToolsPage {
  readonly ui = inject(EditorUiStateService);

  readonly toolItems = computed(() => {
    return [
      { id: "crop", labelKey: TOOLS_REGISTRY.crop.titleKey },
      { id: "rotate", labelKey: TOOLS_REGISTRY.rotate.titleKey },
      { id: "zoom", labelKey: TOOLS_REGISTRY.zoom.titleKey },
    ] as ScrollableBarItem[];
  });

  onSelectTool(panelId: string): void {
    this.ui.togglePanel("tools", panelId);
  }
}
