import { Type } from '@angular/core';
import { AdjustmentKey } from '../../editor-ui-state.service';
import { EditorStateService } from "../../editor-state.service";
import { BrightnessPanelComponent } from "./widgets/brightness-panel.component";
import { SaturationPanelComponent } from "./widgets/saturation-panel.component";
import { ContrastPanelComponent } from "./widgets/contrast-panel.component";
import { BwPanelComponent } from "./widgets/bw-panel.component";

export interface AdjustmentPanelConfig {
  title: string;
  component: Type<any>;
  canReset: boolean;
  showGrabber: boolean;
  reset?: (state: EditorStateService) => void;
}

export const ADJUSTMENTS_REGISTRY: Record<
  AdjustmentKey,
  AdjustmentPanelConfig
> = {
  brightness: {
    title: "Brightness",
    component: BrightnessPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
  saturation: {
    title: "Saturation",
    component: SaturationPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
  contrast: {
    title: "Contrast",
    component: ContrastPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
  bw: {
    title: "B/W",
    component: BwPanelComponent,
    canReset: false,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
  dither: {
    title: "B/W",
    component: BwPanelComponent, // Using same component as bw for now
    canReset: false,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
};

// Legacy async loaders (kept for compatibility, but prefer sync ADJUSTMENTS_REGISTRY)
export const ADJUSTMENT_LOADERS: Record<
  AdjustmentKey,
  () => Promise<Type<any>>
> = {
  brightness: async () => BrightnessPanelComponent,
  contrast: async () => ContrastPanelComponent,
  saturation: async () => SaturationPanelComponent,
  bw: async () => BwPanelComponent,
  dither: async () => BwPanelComponent,
};
