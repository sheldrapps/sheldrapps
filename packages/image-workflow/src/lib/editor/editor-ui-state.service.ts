import { Injectable, signal } from '@angular/core';

export type EditorMode = 'none' | 'tools' | 'adjustments';
export type GestureMode = 'none' | 'pan' | 'pinch' | 'pan+pinch';
export type ToolKey = 'crop' | 'rotate' | 'zoom' | 'model';
export type AdjustmentKey = 'brightness' | 'contrast' | 'saturation' | 'bw' | 'dither';

@Injectable({
  providedIn: 'root',
})
export class EditorUiStateService {
  readonly activeMode = signal<EditorMode>('none');
  readonly gestureMode = signal<GestureMode>('none');
  readonly activeTool = signal<ToolKey>('crop');
  readonly activeAdjustment = signal<AdjustmentKey>('brightness');

  setMode(mode: EditorMode): void {
    this.activeMode.set(mode);

    // Set sensible default gestureMode based on mode
    switch (mode) {
      case 'tools':
        this.gestureMode.set('pan+pinch');
        break;
      case 'adjustments':
        this.gestureMode.set('none');
        break;
      default:
        this.gestureMode.set('none');
    }
  }

  setTool(key: ToolKey): void {
    this.activeTool.set(key);
  }

  setAdjustment(key: AdjustmentKey): void {
    this.activeAdjustment.set(key);
  }
}
