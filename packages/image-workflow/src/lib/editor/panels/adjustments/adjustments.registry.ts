import { Type } from '@angular/core';
import { AdjustmentKey } from '../../editor-ui-state.service';

export const ADJUSTMENT_LOADERS: Record<AdjustmentKey, () => Promise<Type<any>>> = {
  brightness: () =>
    import('./widgets/brightness-adjustment.component').then(
      (m) => m.BrightnessAdjustmentComponent
    ),
  contrast: () =>
    import('./widgets/contrast-adjustment.component').then(
      (m) => m.ContrastAdjustmentComponent
    ),
  saturation: () =>
    import('./widgets/saturation-adjustment.component').then(
      (m) => m.SaturationAdjustmentComponent
    ),
  bw: () =>
    import('./widgets/bw-adjustment.component').then(
      (m) => m.BwAdjustmentComponent
    ),
  dither: () =>
    import('./widgets/dither-adjustment.component').then(
      (m) => m.DitherAdjustmentComponent
    ),
};
