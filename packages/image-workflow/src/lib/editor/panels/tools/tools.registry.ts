import { Type } from '@angular/core';
import { ToolKey } from '../../editor-ui-state.service';
import type { EditorHistoryService } from "../../editor-history.service";
import { CropPanelComponent } from "./widgets/crop-panel.component";
import { RotatePanelComponent } from "./widgets/rotate-panel.component";
import { ZoomPanelComponent } from "./widgets/zoom-panel.component";

export interface ToolPanelConfig {
  title?: string;
  titleKey?: string;
  component: Type<any>;
  canReset: boolean;
  showGrabber: boolean;
  reset?: (history: EditorHistoryService) => void;
}

export const TOOLS_REGISTRY: Record<ToolKey, ToolPanelConfig> = {
  crop: {
    titleKey: "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.CROP",
    component: CropPanelComponent,
    canReset: false,
    showGrabber: true,
  },
  rotate: {
    titleKey: "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.ROTATE",
    component: RotatePanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (history) => history.setRotation(0),
  },
  zoom: {
    titleKey: "EDITOR.PANELS.TOOLS.TOOLS.REGISTRY.TITLE.ZOOM",
    component: ZoomPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (history) => history.setScale(1),
  },
};

// Legacy async loaders (kept for compatibility, but prefer sync TOOLS_REGISTRY)
export const TOOL_LOADERS: Record<ToolKey, () => Promise<Type<any>>> = {
  crop: async () => CropPanelComponent,
  rotate: async () => RotatePanelComponent,
  zoom: async () => ZoomPanelComponent,
};
