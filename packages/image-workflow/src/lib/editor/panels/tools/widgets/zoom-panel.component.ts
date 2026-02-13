import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollableButtonBarComponent } from "@sheldrapps/ui-theme";
import type { ScrollableBarItem } from "@sheldrapps/ui-theme";
import { addIcons } from "ionicons";
import { addOutline, removeOutline } from "ionicons/icons";
import { EditorStateService } from "../../../editor-state.service";

@Component({
  selector: "cc-zoom-panel",
  standalone: true,
  imports: [CommonModule, ScrollableButtonBarComponent],
  templateUrl: "./zoom-panel.component.html",
  styleUrls: ["./zoom-panel.component.scss"],
})
export class ZoomPanelComponent {
  readonly editorState = inject(EditorStateService);

  readonly zoomItems: ScrollableBarItem[] = [
    {
      id: "out",
      labelKey: "EDITOR.PANELS.TOOLS.WIDGETS.ZOOM_PANEL.BUTTON.ZOOM_OUT",
      icon: "remove-outline",
    },
    {
      id: "in",
      labelKey: "EDITOR.PANELS.TOOLS.WIDGETS.ZOOM_PANEL.BUTTON.ZOOM_IN",
      icon: "add-outline",
    },
  ];

  get disabledZoomIds(): string[] {
    const scale = this.editorState.scale();
    const ids: string[] = [];
    if (scale <= 1) ids.push("out");
    if (scale >= 6) ids.push("in");
    return ids;
  }

  constructor() {
    addIcons({ addOutline, removeOutline });
  }

  onSelectZoom(id: string): void {
    if (id === "out") {
      this.editorState.zoomOut();
      return;
    }

    if (id === "in") {
      this.editorState.zoomIn();
    }
  }
}
