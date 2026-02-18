import { Type } from '@angular/core';
import { AdjustmentKey } from '../../editor-ui-state.service';
import type { EditorHistoryService } from "../../editor-history.service";
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
  reset?: (history: EditorHistoryService) => void;
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
    reset: (history) => history.resetBrightness(),
  },
  saturation: {
    title: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.SATURATION",
    component: SaturationPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (history) => history.resetSaturation(),
  },
  contrast: {
    title: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.CONTRAST",
    component: ContrastPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (history) => history.resetContrast(),
  },
  bw: {
    title: "EDITOR.PANELS.ADJUSTMENTS.ADJUSTMENTS.REGISTRY.TITLE.BW",
    component: BwPanelComponent,
    canReset: true,
    showGrabber: true,
    reset: (history) => history.resetBw(),
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
};
