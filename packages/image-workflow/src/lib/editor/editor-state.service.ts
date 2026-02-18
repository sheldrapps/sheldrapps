import { Injectable, signal, computed } from "@angular/core";
import {
  DEFAULT_EDITOR_ADJUSTMENTS,
  EditorAdjustmentsState,
} from "./editor-adjustments";

type ConstraintsCtx = {
  frameW: number;
  frameH: number;
  naturalW: number; // UNROTATED natural (real)
  naturalH: number; // UNROTATED natural (real)
  baseScale: number; // cover scale computed in shell (already accounts for rotation)
  mode: "tools" | "other";
  virtualSquare?: boolean; // if true: treat image as a square built from LONG side
};

@Injectable({
  providedIn: "root",
})
export class EditorStateService {
  // Transform state
  readonly scale = signal(1);
  readonly tx = signal(0);
  readonly ty = signal(0);
  readonly rot = signal(0);
  readonly flipX = signal(false);
  readonly flipY = signal(false);

  private ctx: ConstraintsCtx | null = null;

  // Adjustment state
  readonly brightness = signal(DEFAULT_EDITOR_ADJUSTMENTS.brightness);
  readonly saturation = signal(DEFAULT_EDITOR_ADJUSTMENTS.saturation);
  readonly contrast = signal(DEFAULT_EDITOR_ADJUSTMENTS.contrast);
  readonly bw = signal(DEFAULT_EDITOR_ADJUSTMENTS.bw);
  readonly dither = signal(DEFAULT_EDITOR_ADJUSTMENTS.dither);

  readonly adjustments = computed<EditorAdjustmentsState>(() => ({
    brightness: this.brightness(),
    contrast: this.contrast(),
    saturation: this.saturation(),
    bw: this.bw(),
    dither: this.dither(),
  }));

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
      this.dither.set(DEFAULT_EDITOR_ADJUSTMENTS.dither);
    }
  }

  setDither(value: boolean): void {
    this.dither.set(value && this.bw());
  }

  setScale(value: number): void {
    const max = 6;
    const min = this.ctx?.mode === "tools" ? this.getMinToolsScale() : 1;
    this.scale.set(this.clamp(value, min, max));
    this.clampTranslationToCtx();
  }

  setTranslation(tx: number, ty: number): void {
    this.tx.set(tx);
    this.ty.set(ty);
    this.clampTranslationToCtx();
  }

  setRotation(degrees: number): void {
    this.rot.set(this.normalizeRotation(degrees));
    this.clampScaleToCtx();
    this.clampTranslationToCtx();
  }

  rotateLeft(): void {
    this.rot.set(this.normalizeRotation(this.rot() - 90));
    this.clampScaleToCtx();
    this.clampTranslationToCtx();
  }

  rotateRight(): void {
    this.rot.set(this.normalizeRotation(this.rot() + 90));
    this.clampScaleToCtx();
    this.clampTranslationToCtx();
  }

  toggleFlipX(): void {
    this.flipX.set(!this.flipX());
  }

  toggleFlipY(): void {
    this.flipY.set(!this.flipY());
  }

  private clampScaleToCtx(): void {
    if (!this.ctx || this.ctx.mode !== "tools") return;
    const max = 6;
    const min = this.getMinToolsScale();
    const s = this.scale();
    const next = this.clamp(s, min, max);
    if (next !== s) this.scale.set(next);
  }

  zoomIn(step = 0.12): void {
    this.setScale(this.scale() + step);
  }

  zoomOut(step = 0.12): void {
    this.setScale(this.scale() - step);
  }

  resetViewToCover(): void {
    this.setScale(1);
    this.setTranslation(0, 0);
  }

  setConstraintsContext(ctx: ConstraintsCtx): void {
    this.ctx = ctx;
    // When ctx changes, re-clamp existing state in tools
    this.clampScaleToCtx();
    this.clampTranslationToCtx();
  }

  /**
   * Minimum zoom-out allowed in Tools.
   * Goal: allow zooming out until the image can be fully contained (with "terrain")
   * based on a virtual square built from the LONG side (if virtualSquare=true).
   */
  getMinToolsScale(): number {
    const c = this.ctx;
    if (!c || c.mode !== "tools") return 1;
    if (c.baseScale <= 0) return 1;

    // natural con rotación, pero SIN inventar tamaños virtuales
    const rn = this.getRotatedNaturalSizeFromCtx();

    const contain = Math.min(c.frameW / rn.w, c.frameH / rn.h);
    const min = contain / c.baseScale;

    // debug duro
    console.log("MIN_SCALE", {
      frameW: c.frameW,
      frameH: c.frameH,
      rn,
      baseScale: c.baseScale,
      contain,
      minBeforeClamp: min,
    });

    return this.clamp(min, 0.05, 1);
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
  resetBrightness(): void {
    this.brightness.set(DEFAULT_EDITOR_ADJUSTMENTS.brightness);
  }

  resetSaturation(): void {
    this.saturation.set(DEFAULT_EDITOR_ADJUSTMENTS.saturation);
  }

  resetContrast(): void {
    this.contrast.set(DEFAULT_EDITOR_ADJUSTMENTS.contrast);
  }

  resetBw(): void {
    this.bw.set(DEFAULT_EDITOR_ADJUSTMENTS.bw);
    this.dither.set(DEFAULT_EDITOR_ADJUSTMENTS.dither);
  }

  resetDither(): void {
    this.dither.set(DEFAULT_EDITOR_ADJUSTMENTS.dither);
  }

  resetAdjustments(): void {
    this.brightness.set(DEFAULT_EDITOR_ADJUSTMENTS.brightness);
    this.saturation.set(DEFAULT_EDITOR_ADJUSTMENTS.saturation);
    this.contrast.set(DEFAULT_EDITOR_ADJUSTMENTS.contrast);
    this.bw.set(DEFAULT_EDITOR_ADJUSTMENTS.bw);
    this.dither.set(DEFAULT_EDITOR_ADJUSTMENTS.dither);
  }

  resetTransform(): void {
    this.scale.set(1);
    this.tx.set(0);
    this.ty.set(0);
    this.rot.set(0);
    this.flipX.set(false);
    this.flipY.set(false);
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
      flipX: this.flipX(),
      flipY: this.flipY(),
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
    this.flipX.set(!!state.flipX);
    this.flipY.set(!!state.flipY);
    this.brightness.set(state.brightness);
    this.saturation.set(state.saturation);
    this.contrast.set(state.contrast);
    this.bw.set(state.bw);
    this.dither.set(
      state.bw ? state.dither : DEFAULT_EDITOR_ADJUSTMENTS.dither,
    );
    this.clampScaleToCtx();
    this.clampTranslationToCtx();
  }

  // Utilities
  private clampTranslationToCtx(): void {
    const c = this.ctx;
    if (!c || c.mode !== "tools") return;

    const scale = this.scale();
    const dispScale = c.baseScale * scale;

    // IMPORTANT: use virtual-natural size so "terrain" exists for pan bounds too
    const vn = this.getVirtualNaturalSize();
    const imgDispW = vn.w * dispScale;
    const imgDispH = vn.h * dispScale;

    const rangeX = Math.abs(imgDispW - c.frameW);
    const rangeY = Math.abs(imgDispH - c.frameH);

    const minX = -rangeX / 2;
    const maxX = rangeX / 2;
    const minY = -rangeY / 2;
    const maxY = rangeY / 2;

    const currentTx = this.tx();
    const currentTy = this.ty();
    const nextTx = this.clamp(currentTx, minX, maxX);
    const nextTy = this.clamp(currentTy, minY, maxY);

    if (nextTx !== currentTx) this.tx.set(nextTx);
    if (nextTy !== currentTy) this.ty.set(nextTy);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private normalizeRotation(degrees: number): number {
    const normalized = degrees % 360;
    const positive = normalized < 0 ? normalized + 360 : normalized;
    return (Math.round(positive / 90) * 90) % 360;
  }

  /**
   * Returns the "natural" size after rotation and optional virtual-square.
   * - rotation 90/270 swaps w/h
   * - virtualSquare uses LONG side to create an LxL canvas (so zoom-out can contain full image)
   */
  private getVirtualNaturalSize(): { w: number; h: number } {
    const rn = this.getRotatedNaturalSizeFromCtx();

    // Si tu regla virtualSquare está activa:
    // cuadrado basado en el lado LARGO
    const long = Math.max(rn.w, rn.h);

    // Si no quieres siempre square, puedes condicionar con un flag del ctx:
    // if (!this.ctx?.virtualSquare) return rn;

    return { w: long, h: long };
  }

  private getRotatedNaturalSizeFromCtx(): { w: number; h: number } {
    const c = this.ctx!;
    const r = this.rot();
    const rr = (((r % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    if (rr === 90 || rr === 270) return { w: c.naturalH, h: c.naturalW };
    return { w: c.naturalW, h: c.naturalH };
  }
}
