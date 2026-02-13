import { Type } from '@angular/core';
import { ToolKey } from '../../editor-ui-state.service';
import { EditorStateService } from "../../editor-state.service";
import { CropPanelComponent } from "./widgets/crop-panel.component";
import { RotatePanelComponent } from "./widgets/rotate-panel.component";
import { ZoomPanelComponent } from "./widgets/zoom-panel.component";

export interface ToolPanelConfig {
  title: string;
  component: Type<any>;
  canReset: boolean;
  showGrabber: boolean;
  reset?: (state: EditorStateService) => void;
}

export const TOOLS_REGISTRY: Record<ToolKey, ToolPanelConfig> = {
  crop: {
    title: "Crop",
    component: CropPanelComponent,
    canReset: false,
    showGrabber: true,
  },
  rotate: {
    title: "Rotate",
    component: RotatePanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (state) => state.rot.set(0),
  },
  zoom: {
    title: "Zoom",
    component: ZoomPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (state) => state.scale.set(1),
  },
};

// Legacy async loaders (kept for compatibility, but prefer sync TOOLS_REGISTRY)
export const TOOL_LOADERS: Record<ToolKey, () => Promise<Type<any>>> = {
  crop: async () => CropPanelComponent,
  rotate: async () => RotatePanelComponent,
  zoom: async () => ZoomPanelComponent,
};
