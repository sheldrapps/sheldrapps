import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonToggle,
  IonRange,
  IonItem,
  IonLabel,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
} from "@ionic/angular/standalone";
import { ModalController } from "@ionic/angular/standalone";
import type {
  SegmentCustomEvent,
  SegmentChangeEventDetail,
} from "@ionic/angular";

import { addIcons } from "ionicons";
import {
  addOutline,
  removeOutline,
  refreshOutline,
  chevronUpOutline,
  closeOutline,
  returnUpBackOutline,
  returnUpForwardOutline,
} from "ionicons/icons";

import type {
  CoverCropState,
  CropTarget,
  CropperResult,
  CropFormatOption,
  CropperLabels,
} from "../../types";

type Pt = { x: number; y: number };

/**
 * Base Cropper Component (without i18n).
 * For use with ngx-translate, wrap this component or use it within a module that provides TranslateModule.
 */
@Component({
  selector: "app-cover-cropper-modal",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonRange,
    IonToggle,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
  ],
  templateUrl: "./cover-cropper-modal-base.component.html",
  styleUrls: ["./cover-cropper-modal.component.scss"],
})
export class CoverCropperModalComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  @Input() file!: File;
  @Input() model!: CropTarget;
  @Input() initialState?: CoverCropState;
  @Input() onReady?: () => void;
  @Input() formatOptions?: CropFormatOption[];
  @Input() formatId?: string;

  @Input() locale?: string;
  @Input() labels?: Partial<CropperLabels>;
  @Input() showAdjustments = true;
  @Input() showRotate = true;
  @Input() showFormatSelector = true;
  @Input() showHint = true;
  @Input() showGrid = true;

  // i18n Labels - default to English
  @Input() title?: string;
  @Input() cancelLabel?: string;
  @Input() doneLabel?: string;
  @Input() loadingLabel?: string;
  @Input() hintLabel?: string;
  @Input() adjustmentsLabel?: string;
  @Input() resetAdjustmentsAriaLabel?: string;
  @Input() rotateLabel?: string;
  @Input() brightnessLabel?: string;
  @Input() saturationLabel?: string;
  @Input() contrastLabel?: string;
  @Input() bwLabel?: string;
  @Input() ditherLabel?: string;

  // Aria labels
  @Input() frameAriaLabel?: string;
  @Input() controlsAriaLabel?: string;
  @Input() resetAriaLabel?: string;
  @Input() zoomOutAriaLabel?: string;
  @Input() zoomInAriaLabel?: string;
  @Input() adjustmentsAriaLabel?: string;

  @ViewChild("frame", { read: ElementRef }) frameRef!: ElementRef<HTMLElement>;
  @ViewChild("img", { read: ElementRef }) imgRef!: ElementRef<HTMLImageElement>;

  readonly minScale = 1;
  readonly maxScale = 6;
  private readonly step = 0.12;

  ready = false;

  imageUrl = "";
  private naturalW = 0;
  private naturalH = 0;

  scale = 1;
  tx = 0;
  ty = 0;

  brightness = 1;
  saturation = 1;
  contrast = 1;
  bw = false;
  dither = false;
  rot = 0;

  private baseScale = 1;

  adjustOpen = false;

  private pointers = new Map<number, Pt>();
  private gestureStart?: {
    type: "pan" | "pinch";
    startScale: number;
    startTx: number;
    startTy: number;
    startDist: number;
    startMid: Pt;
  };

  private resizeObs?: ResizeObserver;
  private cleanup?: () => void;

  private sourceBitmap?: ImageBitmap;
  private sourceBitmapPromise?: Promise<ImageBitmap>;

  private didEmitReady = false;
  private imageLoaded = false;
  selectedFormatId?: string;
  uiLabels: CropperLabels = DEFAULT_LABELS["en"];

  constructor(private modalCtrl: ModalController) {
    addIcons({
      removeOutline,
      refreshOutline,
      addOutline,
      closeOutline,
      returnUpBackOutline,
      returnUpForwardOutline,
      chevronUpOutline,
    });
  }

  get aspectRatio(): number {
    const t = this.getActiveTarget();
    return t.width / t.height;
  }

  toggleAdjustments(): void {
    this.adjustOpen = !this.adjustOpen;
  }

  closeAdjustments(): void {
    this.adjustOpen = false;
  }

  resetAdjustments(): void {
    this.brightness = 1;
    this.saturation = 1;
    this.contrast = 1;
    this.bw = false;
    this.dither = false;
    this.onAdjustChanged();
  }

  ngOnInit(): void {
    this.refreshLabels();
    this.ready = false;
    this.didEmitReady = false;
    this.imageLoaded = false;
    this.adjustOpen = false;
    this.selectedFormatId =
      this.formatId ?? this.formatOptions?.[0]?.id ?? undefined;

    this.imageUrl = URL.createObjectURL(this.file);

    this.sourceBitmapPromise = createImageBitmap(this.file).then(
      (b) => {
        this.sourceBitmap = b;
        return b;
      },
      (err) => {
        console.error("[cropper] createImageBitmap failed", err, {
          name: this.file?.name,
          type: this.file?.type,
          size: this.file?.size,
        });
        throw err;
      },
    );

    if (this.initialState) {
      this.scale = this.sanitize(
        this.initialState.scale,
        this.minScale,
        this.maxScale,
        1,
      );
      this.tx = Number(this.initialState.tx ?? 0);
      this.ty = Number(this.initialState.ty ?? 0);

      this.brightness = this.sanitize(
        this.initialState.brightness ?? 1,
        0.5,
        1.5,
        1,
      );
      this.saturation = this.sanitize(
        this.initialState.saturation ?? 1,
        0,
        2,
        1,
      );
      this.contrast = this.sanitize(
        this.initialState.contrast ?? 1,
        0.5,
        1.8,
        1,
      );

      this.bw = !!this.initialState.bw;
      this.dither = !!this.initialState.dither;
      if (!this.bw) this.dither = false;

      this.rot = ((Number(this.initialState.rot ?? 0) % 360) + 360) % 360;
      if (this.rot % 90 !== 0) this.rot = 0;
    }
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.refreshLabels();
  }

  ngAfterViewInit(): void {
    const frame = this.frameRef?.nativeElement;
    if (!frame) return;

    const captured = new Set<number>();

    const capture = (id: number) => {
      if (captured.has(id)) return;
      try {
        frame.setPointerCapture(id);
        captured.add(id);
      } catch {}
    };

    const release = (id: number) => {
      if (!captured.has(id)) return;
      try {
        frame.releasePointerCapture(id);
      } catch {}
      captured.delete(id);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!this.ready) e.preventDefault();

      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      capture(e.pointerId);

      if (this.pointers.size === 1) {
        this.gestureStart = {
          type: "pan",
          startScale: this.scale,
          startTx: this.tx,
          startTy: this.ty,
          startDist: 0,
          startMid: { x: e.clientX, y: e.clientY },
        };
        e.preventDefault();
        return;
      }

      if (this.pointers.size >= 2) {
        for (const id of this.pointers.keys()) capture(id);

        const [a, b] = Array.from(this.pointers.values());
        this.gestureStart = {
          type: "pinch",
          startScale: this.scale,
          startTx: this.tx,
          startTy: this.ty,
          startDist: distance(a, b),
          startMid: midpoint(a, b),
        };
        e.preventDefault();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.ready) return;
      if (!this.pointers.has(e.pointerId)) return;

      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!this.gestureStart) return;

      if (this.pointers.size === 1 && this.gestureStart.type === "pan") {
        const p = this.pointers.values().next().value as Pt;
        const dx = p.x - this.gestureStart.startMid.x;
        const dy = p.y - this.gestureStart.startMid.y;

        this.tx = this.gestureStart.startTx + dx;
        this.ty = this.gestureStart.startTy + dy;

        this.clampAndRender();
        e.preventDefault();
        return;
      }

      if (this.pointers.size >= 2) {
        const [a, b] = Array.from(this.pointers.values());
        const mid = midpoint(a, b);
        const dist = distance(a, b);

        const ratio =
          this.gestureStart.startDist > 0
            ? dist / this.gestureStart.startDist
            : 1;

        this.scale = this.sanitize(
          this.gestureStart.startScale * ratio,
          this.minScale,
          this.maxScale,
          this.minScale,
        );

        const mdx = mid.x - this.gestureStart.startMid.x;
        const mdy = mid.y - this.gestureStart.startMid.y;

        this.tx = this.gestureStart.startTx + mdx;
        this.ty = this.gestureStart.startTy + mdy;

        this.clampAndRender();
        e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      release(e.pointerId);

      if (this.pointers.size === 1) {
        const p = this.pointers.values().next().value as Pt;
        this.gestureStart = {
          type: "pan",
          startScale: this.scale,
          startTx: this.tx,
          startTy: this.ty,
          startDist: 0,
          startMid: { x: p.x, y: p.y },
        };
      } else if (this.pointers.size >= 2) {
        const [a, b] = Array.from(this.pointers.values());
        this.gestureStart = {
          type: "pinch",
          startScale: this.scale,
          startTx: this.tx,
          startTy: this.ty,
          startDist: distance(a, b),
          startMid: midpoint(a, b),
        };
      } else {
        this.gestureStart = undefined;
      }

      this.clampAndRender();
      e.preventDefault();
    };

    frame.addEventListener("pointerdown", onPointerDown, { passive: false });
    frame.addEventListener("pointermove", onPointerMove, { passive: false });
    frame.addEventListener("pointerup", onPointerUp, { passive: false });
    frame.addEventListener("pointercancel", onPointerUp, { passive: false });

    this.cleanup = () => {
      frame.removeEventListener("pointerdown", onPointerDown as any);
      frame.removeEventListener("pointermove", onPointerMove as any);
      frame.removeEventListener("pointerup", onPointerUp as any);
      frame.removeEventListener("pointercancel", onPointerUp as any);
    };

    this.tryReady();
  }

  onImgLoad(ev: Event): void {
    const img = ev.target as HTMLImageElement | null;
    if (!img) return;

    this.naturalW = img.naturalWidth || 0;
    this.naturalH = img.naturalHeight || 0;

    img.style.width = `${this.naturalW}px`;
    img.style.height = `${this.naturalH}px`;

    this.imageLoaded = true;
    this.tryReady();

    this.resizeObs?.disconnect();
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return;

    this.resizeObs = new ResizeObserver(() => this.tryReady());
    this.resizeObs.observe(frameEl);
  }

  ngOnDestroy(): void {
    this.cleanup?.();
    this.resizeObs?.disconnect();
    this.sourceBitmap?.close?.();
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
  }

  zoomIn(): void {
    this.setScale(this.scale + this.step);
  }

  zoomOut(): void {
    this.setScale(this.scale - this.step);
  }

  onAdjustChanged(): void {
    if (!this.ready) return;
    if (!this.bw) this.dither = false;
    this.renderTransform();
  }

  reset(): void {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;

    this.brightness = 1;
    this.saturation = 1;
    this.contrast = 1;
    this.bw = false;
    this.dither = false;
    this.rot = 0;

    this.clampAndRender();
  }

  private emitReadyOnce(): void {
    if (this.didEmitReady) return;
    this.didEmitReady = true;
    this.onReady?.();
  }

  private getRotatedNaturalSize(): { w: number; h: number } {
    const r = (((this.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    if (r === 90 || r === 270) return { w: this.naturalH, h: this.naturalW };
    return { w: this.naturalW, h: this.naturalH };
  }

  private tryReady(): void {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return;

    const w = frameEl.clientWidth;
    const h = frameEl.clientHeight;

    if (!this.imageLoaded || !this.naturalW || !this.naturalH) return;
    if (w <= 0 || h <= 0) return;

    const rn = this.getRotatedNaturalSize();

    const needW = w / rn.w;
    const needH = h / rn.h;
    this.baseScale = Math.max(needW, needH);

    if (!this.ready) {
      this.ready = true;
      this.emitReadyOnce();
    }

    this.clampAndRender();
  }

  private setScale(next: number): void {
    this.scale = this.sanitize(next, this.minScale, this.maxScale, 1);
    this.clampAndRender();
  }

  private clampAndRender(): void {
    if (!this.ready) return;

    const frameEl = this.frameRef.nativeElement;
    const frW = frameEl.clientWidth;
    const frH = frameEl.clientHeight;

    const rn = this.getRotatedNaturalSize();

    const dispScale = this.baseScale * this.scale;
    const imgW = rn.w * dispScale;
    const imgH = rn.h * dispScale;

    const maxTx = Math.max(0, (imgW - frW) / 2);
    const maxTy = Math.max(0, (imgH - frH) / 2);

    this.tx = clamp(this.tx, -maxTx, maxTx);
    this.ty = clamp(this.ty, -maxTy, maxTy);

    this.renderTransform();
  }

  private renderTransform(): void {
    const img = this.imgRef.nativeElement;
    const dispScale = this.baseScale * this.scale;

    img.style.transform =
      `translate(calc(-50% + ${this.tx}px), calc(-50% + ${this.ty}px)) ` +
      `rotate(${this.rot}deg) ` +
      `scale(${dispScale})`;

    const sat = this.bw ? 1 : this.saturation;
    const gray = this.bw ? 1 : 0;
    img.style.filter = `brightness(${this.brightness}) contrast(${this.contrast}) saturate(${sat}) grayscale(${gray})`;
  }

  private getState(): CoverCropState {
    return {
      scale: this.scale,
      tx: this.tx,
      ty: this.ty,
      brightness: this.brightness,
      saturation: this.saturation,
      contrast: this.contrast,
      bw: this.bw,
      dither: this.dither,
      rot: this.rot,
    };
  }

  onFormatChange(ev: SegmentCustomEvent) {
    const nextValue = (ev?.detail as SegmentChangeEventDetail | undefined)
      ?.value;
    const next =
      typeof nextValue === "string"
        ? nextValue
        : nextValue != null
          ? String(nextValue)
          : undefined;
    if (!next || next === this.selectedFormatId) return;
    this.selectedFormatId = next;
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.tryReady();
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, "cancel");
  }

  async use(): Promise<void> {
    if (!this.ready) return;

    const target = this.getActiveTarget();

    const frameEl = this.frameRef.nativeElement;
    const fw = frameEl.clientWidth;
    const fh = frameEl.clientHeight;

    const dispScale = this.baseScale * this.scale;

    const r = (((this.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    const rotW = r === 90 || r === 270 ? this.naturalH : this.naturalW;
    const rotH = r === 90 || r === 270 ? this.naturalW : this.naturalH;

    // Calculate crop dimensions and round to integers to avoid subpixel sampling
    let sWidthR = Math.floor(fw / dispScale);
    let sHeightR = Math.floor(fh / dispScale);

    sWidthR = Math.min(sWidthR, rotW);
    sHeightR = Math.min(sHeightR, rotH);

    let sxR = Math.round(rotW / 2 - sWidthR / 2 - this.tx / dispScale);
    let syR = Math.round(rotH / 2 - sHeightR / 2 - this.ty / dispScale);

    const maxSxR = Math.max(0, rotW - sWidthR);
    const maxSyR = Math.max(0, rotH - sHeightR);

    sxR = clamp(sxR, 0, maxSxR);
    syR = clamp(syR, 0, maxSyR);

    // Ensure crop stays within bounds using integer math
    if (sxR + sWidthR > rotW) sxR = rotW - sWidthR;
    if (syR + sHeightR > rotH) syR = rotH - sHeightR;

    const bitmap =
      this.sourceBitmap ??
      (this.sourceBitmapPromise
        ? await this.sourceBitmapPromise
        : await createImageBitmap(this.file));

    const rotCanvas = document.createElement("canvas");
    rotCanvas.width = rotW;
    rotCanvas.height = rotH;

    const rctx = rotCanvas.getContext("2d");
    if (!rctx) return;

    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = "high";

    rctx.save();
    if (r === 0) {
      rctx.drawImage(bitmap, 0, 0);
    } else if (r === 90) {
      rctx.translate(rotW, 0);
      rctx.rotate(Math.PI / 2);
      rctx.drawImage(bitmap, 0, 0);
    } else if (r === 180) {
      rctx.translate(rotW, rotH);
      rctx.rotate(Math.PI);
      rctx.drawImage(bitmap, 0, 0);
    } else {
      rctx.translate(0, rotH);
      rctx.rotate(-Math.PI / 2);
      rctx.drawImage(bitmap, 0, 0);
    }
    rctx.restore();

    const outMode = target.output ?? "target";
    const outW =
      outMode === "source" ? Math.max(1, Math.round(sWidthR)) : target.width;
    const outH =
      outMode === "source" ? Math.max(1, Math.round(sHeightR)) : target.height;

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, outW, outH);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(rotCanvas, sxR, syR, sWidthR, sHeightR, 0, 0, outW, outH);

    const imgData = ctx.getImageData(0, 0, outW, outH);
    const d = imgData.data;

    const b = this.brightness;
    const s = this.saturation;
    const c = this.contrast;

    if (!this.bw) {
      for (let i = 0; i < d.length; i += 4) {
        let rr = d[i],
          g = d[i + 1],
          bl = d[i + 2];

        rr = (rr - 128) * c + 128;
        g = (g - 128) * c + 128;
        bl = (bl - 128) * c + 128;

        rr *= b;
        g *= b;
        bl *= b;

        const l = 0.2126 * rr + 0.7152 * g + 0.0722 * bl;
        rr = l + (rr - l) * s;
        g = l + (g - l) * s;
        bl = l + (bl - l) * s;

        d[i] = rr < 0 ? 0 : rr > 255 ? 255 : rr;
        d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        d[i + 2] = bl < 0 ? 0 : bl > 255 ? 255 : bl;
      }

      ctx.putImageData(imgData, 0, 0);
    } else {
      const gray = new Float32Array(outW * outH);

      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
          const i = (y * outW + x) * 4;
          let rr = d[i],
            g = d[i + 1],
            bl = d[i + 2];

          rr = (rr - 128) * c + 128;
          g = (g - 128) * c + 128;
          bl = (bl - 128) * c + 128;

          rr *= b;
          g *= b;
          bl *= b;

          let l = 0.2126 * rr + 0.7152 * g + 0.0722 * bl;
          l = l < 0 ? 0 : l > 255 ? 255 : l;

          gray[y * outW + x] = l;
        }
      }

      if (this.dither) {
        for (let y = 0; y < outH; y++) {
          for (let x = 0; x < outW; x++) {
            const idx = y * outW + x;
            const oldVal = gray[idx];
            const newVal = oldVal < 128 ? 0 : 255;
            const err = oldVal - newVal;
            gray[idx] = newVal;

            if (x + 1 < outW) gray[idx + 1] += (err * 7) / 16;
            if (y + 1 < outH) {
              if (x > 0) gray[idx + outW - 1] += (err * 3) / 16;
              gray[idx + outW] += (err * 5) / 16;
              if (x + 1 < outW) gray[idx + outW + 1] += err / 16;
            }
          }
        }
      }

      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
          const idx = y * outW + x;
          let v = gray[idx];
          v = v < 0 ? 0 : v > 255 ? 255 : v;

          const i = idx * 4;
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    const quality = 0.92;
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((bb) => resolve(bb), "image/jpeg", quality),
    );

    if (!blob) return;

    const name =
      this.file.name.replace(/\.(png|jpg|jpeg|webp)$/i, "") + `_cropped.jpg`;

    const croppedFile = new File([blob], name, { type: "image/jpeg" });

    const result: CropperResult = {
      file: croppedFile,
      state: this.getState(),
      formatId: this.selectedFormatId,
    };

    this.modalCtrl.dismiss(result, "done");
  }

  private sanitize(
    v: number,
    min: number,
    max: number,
    fallback: number,
  ): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return clamp(n, min, max);
  }

  rotateLeft(): void {
    this.rot = (this.rot + 270) % 360;
    this.onRotateApplied();
  }

  rotateRight(): void {
    this.rot = (this.rot + 90) % 360;
    this.onRotateApplied();
  }

  private onRotateApplied(): void {
    if (!this.ready) {
      this.tryReady();
      return;
    }
    this.tryReady();
  }

  private refreshLabels(): void {
    const resolvedLocale = resolveLocale(this.locale);
    const base = DEFAULT_LABELS[resolvedLocale] ?? DEFAULT_LABELS["en"];
    const inputOverrides: Partial<CropperLabels> = {
      title: this.title,
      cancelLabel: this.cancelLabel,
      doneLabel: this.doneLabel,
      loadingLabel: this.loadingLabel,
      hintLabel: this.hintLabel,
      adjustmentsLabel: this.adjustmentsLabel,
      resetAdjustmentsAriaLabel: this.resetAdjustmentsAriaLabel,
      rotateLabel: this.rotateLabel,
      brightnessLabel: this.brightnessLabel,
      saturationLabel: this.saturationLabel,
      contrastLabel: this.contrastLabel,
      bwLabel: this.bwLabel,
      ditherLabel: this.ditherLabel,
      frameAriaLabel: this.frameAriaLabel,
      controlsAriaLabel: this.controlsAriaLabel,
      resetAriaLabel: this.resetAriaLabel,
      zoomOutAriaLabel: this.zoomOutAriaLabel,
      zoomInAriaLabel: this.zoomInAriaLabel,
      adjustmentsAriaLabel: this.adjustmentsAriaLabel,
    };

    this.uiLabels = applyLabelOverrides(base, this.labels, inputOverrides);
  }

  private getActiveTarget(): CropTarget {
    if (this.formatOptions?.length) {
      const match = this.formatOptions.find(
        (opt) => opt.id === this.selectedFormatId,
      );
      if (match) return match.target;
      return this.formatOptions[0].target;
    }
    return this.model;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function distance(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const DEFAULT_LABELS: Record<string, CropperLabels> = {
  en: {
    title: "Crop",
    cancelLabel: "Cancel",
    doneLabel: "Done",
    loadingLabel: "Loading…",
    hintLabel: "Pinch to zoom · Drag to move",
    adjustmentsLabel: "Adjustments",
    resetAdjustmentsAriaLabel: "Reset adjustments",
    rotateLabel: "Rotate",
    brightnessLabel: "Brightness",
    saturationLabel: "Saturation",
    contrastLabel: "Contrast",
    bwLabel: "B/W",
    ditherLabel: "Dither",
    frameAriaLabel: "Crop area",
    controlsAriaLabel: "Controls",
    resetAriaLabel: "Reset",
    zoomOutAriaLabel: "Zoom out",
    zoomInAriaLabel: "Zoom in",
    adjustmentsAriaLabel: "Image adjustments",
  },
  es: {
    title: "Recortar",
    cancelLabel: "Cancelar",
    doneLabel: "Listo",
    loadingLabel: "Cargando…",
    hintLabel: "Pellizca para hacer zoom · Arrastra para mover",
    adjustmentsLabel: "Ajustes",
    resetAdjustmentsAriaLabel: "Restablecer ajustes",
    rotateLabel: "Rotar",
    brightnessLabel: "Brillo",
    saturationLabel: "Saturación",
    contrastLabel: "Contraste",
    bwLabel: "B/N",
    ditherLabel: "Dither (tramado)",
    frameAriaLabel: "Área de recorte",
    controlsAriaLabel: "Controles",
    resetAriaLabel: "Restablecer",
    zoomOutAriaLabel: "Alejar",
    zoomInAriaLabel: "Acercar",
    adjustmentsAriaLabel: "Ajustes de imagen",
  },
  de: {
    title: "Zuschneiden",
    cancelLabel: "Abbrechen",
    doneLabel: "Fertig",
    loadingLabel: "Wird geladen…",
    hintLabel: "Zum Zoomen ziehen · Zum Verschieben wischen",
    adjustmentsLabel: "Anpassungen",
    resetAdjustmentsAriaLabel: "Anpassungen zurücksetzen",
    rotateLabel: "Drehen",
    brightnessLabel: "Helligkeit",
    saturationLabel: "Sättigung",
    contrastLabel: "Kontrast",
    bwLabel: "S/W",
    ditherLabel: "Dithering",
    frameAriaLabel: "Zuschneidebereich",
    controlsAriaLabel: "Steuerung",
    resetAriaLabel: "Zurücksetzen",
    zoomOutAriaLabel: "Verkleinern",
    zoomInAriaLabel: "Vergrößern",
    adjustmentsAriaLabel: "Bildanpassungen",
  },
  pt: {
    title: "Recortar",
    cancelLabel: "Cancelar",
    doneLabel: "Concluído",
    loadingLabel: "Carregando…",
    hintLabel: "Aperte para zoom · Arraste para mover",
    adjustmentsLabel: "Ajustes",
    resetAdjustmentsAriaLabel: "Redefinir ajustes",
    rotateLabel: "Girar",
    brightnessLabel: "Brilho",
    saturationLabel: "Saturação",
    contrastLabel: "Contraste",
    bwLabel: "P/B",
    ditherLabel: "Dither",
    frameAriaLabel: "Área de recorte",
    controlsAriaLabel: "Controles",
    resetAriaLabel: "Redefinir",
    zoomOutAriaLabel: "Diminuir zoom",
    zoomInAriaLabel: "Aumentar zoom",
    adjustmentsAriaLabel: "Ajustes de imagem",
  },
  it: {
    title: "Ritaglia",
    cancelLabel: "Annulla",
    doneLabel: "Fatto",
    loadingLabel: "Caricamento…",
    hintLabel: "Pizzica per zoom · Trascina per spostare",
    adjustmentsLabel: "Regolazioni",
    resetAdjustmentsAriaLabel: "Ripristina regolazioni",
    rotateLabel: "Ruota",
    brightnessLabel: "Luminosità",
    saturationLabel: "Saturazione",
    contrastLabel: "Contrasto",
    bwLabel: "B/N",
    ditherLabel: "Dithering",
    frameAriaLabel: "Area di ritaglio",
    controlsAriaLabel: "Controlli",
    resetAriaLabel: "Ripristina",
    zoomOutAriaLabel: "Riduci",
    zoomInAriaLabel: "Ingrandisci",
    adjustmentsAriaLabel: "Regolazioni immagine",
  },
  fr: {
    title: "Recadrer",
    cancelLabel: "Annuler",
    doneLabel: "Terminé",
    loadingLabel: "Chargement…",
    hintLabel: "Pincez pour zoomer · Glissez pour déplacer",
    adjustmentsLabel: "Réglages",
    resetAdjustmentsAriaLabel: "Réinitialiser les réglages",
    rotateLabel: "Faire pivoter",
    brightnessLabel: "Luminosité",
    saturationLabel: "Saturation",
    contrastLabel: "Contraste",
    bwLabel: "N/B",
    ditherLabel: "Tramage",
    frameAriaLabel: "Zone de recadrage",
    controlsAriaLabel: "Contrôles",
    resetAriaLabel: "Réinitialiser",
    zoomOutAriaLabel: "Dézoomer",
    zoomInAriaLabel: "Zoomer",
    adjustmentsAriaLabel: "Réglages de l'image",
  },
};

function resolveLocale(input?: string): string {
  const navLocale =
    typeof navigator !== "undefined"
      ? (navigator.languages?.[0] ?? navigator.language)
      : undefined;
  const raw = (input ?? navLocale ?? "en").trim().toLowerCase();
  if (DEFAULT_LABELS[raw]) return raw;
  const base = raw.split("-")[0];
  if (DEFAULT_LABELS[base]) return base;
  return "en";
}

function applyLabelOverrides(
  base: CropperLabels,
  overrides?: Partial<CropperLabels>,
  inputOverrides?: Partial<CropperLabels>,
): CropperLabels {
  const merged: CropperLabels = { ...base };
  assignDefined(merged, overrides);
  assignDefined(merged, inputOverrides);
  return merged;
}

function assignDefined(
  target: CropperLabels,
  src?: Partial<CropperLabels>,
): void {
  if (!src) return;
  (Object.keys(src) as (keyof CropperLabels)[]).forEach((key) => {
    const value = src[key];
    if (value !== undefined) target[key] = value;
  });
}
