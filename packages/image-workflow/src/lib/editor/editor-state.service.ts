import { Injectable, signal, computed } from '@angular/core';

/**
 * Editor state service - manages the preview transformation state
 * Panels update values here, and the shell listens to render the preview
 */
@Injectable({
  providedIn: 'root',
})
export class EditorStateService {
  // Transform state
  readonly scale = signal(1);
  readonly tx = signal(0);
  readonly ty = signal(0);
  readonly rot = signal(0);

  // Adjustment state
  readonly brightness = signal(1);
  readonly saturation = signal(1);
  readonly contrast = signal(1);
  readonly bw = signal(false);
  readonly dither = signal(false);

  // Gesture tracking (for history/undo)
  private sliderInProgress = signal(false);
  private gestureInProgress = signal(false);

  readonly isAdjusting = computed(
    () => this.sliderInProgress() || this.gestureInProgress(),
  );

  // Methods for panels to call
  setBrightness(value: number): void {
    this.brightness.set(this.clamp(value, 0.5, 1.5));
  }

  setSaturation(value: number): void {
    this.saturation.set(this.clamp(value, 0, 2));
  }

  setContrast(value: number): void {
    this.contrast.set(this.clamp(value, 0.5, 1.8));
  }

  setBw(value: boolean): void {
    this.bw.set(value);
    if (!value) {
      this.dither.set(false);
    }
  }

  setDither(value: boolean): void {
    if (this.bw()) {
      this.dither.set(value);
    }
  }

  setScale(value: number): void {
    this.scale.set(this.clamp(value, 1, 6));
  }

  setTranslation(tx: number, ty: number): void {
    this.tx.set(tx);
    this.ty.set(ty);
  }

  setRotation(degrees: number): void {
    this.rot.set(this.normalizeRotation(degrees));
  }

  rotateLeft(): void {
    this.rot.set(this.normalizeRotation(this.rot() - 90));
  }

  rotateRight(): void {
    this.rot.set(this.normalizeRotation(this.rot() + 90));
  }

  zoomIn(step = 0.12): void {
    this.scale.set(this.clamp(this.scale() + step, 1, 6));
  }

  zoomOut(step = 0.12): void {
    this.scale.set(this.clamp(this.scale() - step, 1, 6));
  }

  // Gesture tracking for history
  onSliderStart(): void {
    this.sliderInProgress.set(true);
  }

  onSliderEnd(): void {
    this.sliderInProgress.set(false);
  }

  onGestureStart(): void {
    this.gestureInProgress.set(true);
  }

  onGestureEnd(): void {
    this.gestureInProgress.set(false);
  }

  // Reset methods
  resetAdjustments(): void {
    this.brightness.set(1);
    this.saturation.set(1);
    this.contrast.set(1);
    this.bw.set(false);
    this.dither.set(false);
  }

  resetTransform(): void {
    this.scale.set(1);
    this.tx.set(0);
    this.ty.set(0);
    this.rot.set(0);
  }

  resetAll(): void {
    this.resetAdjustments();
    this.resetTransform();
  }

  // Get snapshot for history/export
  getState() {
    return {
      scale: this.scale(),
      tx: this.tx(),
      ty: this.ty(),
      rot: this.rot(),
      brightness: this.brightness(),
      saturation: this.saturation(),
      contrast: this.contrast(),
      bw: this.bw(),
      dither: this.dither(),
    };
  }

  // Restore from snapshot
  setState(state: ReturnType<typeof this.getState>): void {
    this.scale.set(state.scale);
    this.tx.set(state.tx);
    this.ty.set(state.ty);
    this.rot.set(state.rot);
    this.brightness.set(state.brightness);
    this.saturation.set(state.saturation);
    this.contrast.set(state.contrast);
    this.bw.set(state.bw);
    this.dither.set(state.dither);
  }

  // Utilities
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private normalizeRotation(degrees: number): number {
    const normalized = degrees % 360;
    const positive = normalized < 0 ? normalized + 360 : normalized;
    return (Math.round(positive / 90) * 90) % 360;
  }
}
