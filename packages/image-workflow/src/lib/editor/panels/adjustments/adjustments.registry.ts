import { Type } from '@angular/core';
import { AdjustmentKey } from '../../editor-ui-state.service';
import { EditorStateService } from "../../editor-state.service";
import {
  BrightnessPanelComponent,
  SaturationPanelComponent,
  ContrastPanelComponent,
  BwPanelComponent,
} from "./widgets";

export interface AdjustmentPanelConfig {
  title?: string;
  titleKey?: string;
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
    title: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BRIGHTNESS",
    component: BrightnessPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
  saturation: {
    title: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.SATURATION",
    component: SaturationPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
  contrast: {
    title: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.CONTRAST",
    component: ContrastPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
  bw: {
    title: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BW",
    component: BwPanelComponent,
    canReset: false,
    showGrabber: true,
    reset: (state) => state.resetAdjustments(),
  },
  dither: {
    title: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.DITHER",
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
