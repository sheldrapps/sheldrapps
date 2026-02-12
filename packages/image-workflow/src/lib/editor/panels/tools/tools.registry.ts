import { Type } from '@angular/core';
import { ToolKey } from '../../editor-ui-state.service';

export const TOOL_LOADERS: Record<ToolKey, () => Promise<Type<any>>> = {
  crop: () =>
    import('./widgets/crop-tool.component').then((m) => m.CropToolComponent),
  rotate: () =>
    import('./widgets/rotate-tool.component').then((m) => m.RotateToolComponent),
  zoom: () =>
    import('./widgets/zoom-tool.component').then((m) => m.ZoomToolComponent),
  model: () =>
    import('./widgets/model-tool.component').then((m) => m.ModelToolComponent),
};
