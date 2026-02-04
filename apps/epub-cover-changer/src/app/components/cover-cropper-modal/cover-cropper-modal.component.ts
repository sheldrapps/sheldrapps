import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

import { addIcons } from 'ionicons';
import {
  addOutline,
  removeOutline,
  refreshOutline,
  chevronUpOutline,
  closeOutline,
  returnUpBackOutline,
  returnUpForwardOutline,
} from 'ionicons/icons';

type Pt = { x: number; y: number };
type CropTarget = { width: number; height: number };

export type CoverCropState = {
  scale: number;
  tx: number;
  ty: number;

  brightness: number;
  saturation: number;
  contrast: number;

  bw: boolean;
  dither: boolean;

  rot: number;
};

@Component({
  selector: 'app-cover-cropper-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,

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
  ],
  templateUrl: './cover-cropper-modal.component.html',
  styleUrls: ['./cover-cropper-modal.component.scss'],
})
export class CoverCropperModalComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  private modalCtrl = inject(ModalController);

  @Input() file!: File;
  @Input() model!: CropTarget;
  @Input() initialState?: CoverCropState;
  @Input() onReady?: () => void;

  @ViewChild('frame', { read: ElementRef }) frameRef!: ElementRef<HTMLElement>;
  @ViewChild('img', { read: ElementRef }) imgRef!: ElementRef<HTMLImageElement>;

  readonly minScale = 1;
  readonly maxScale = 6;
  private readonly step = 0.12;

  ready = false;

  imageUrl = '';
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
    type: 'pan' | 'pinch';
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

  constructor() {
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
    return this.model.width / this.model.height;
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
    this.ready = false;
    this.didEmitReady = false;
    this.imageLoaded = false;
    this.adjustOpen = false;

    this.imageUrl = URL.createObjectURL(this.file);

    this.sourceBitmapPromise = createImageBitmap(this.file).then(
      (b) => {
        this.sourceBitmap = b;
        return b;
      },
      (err) => {
        console.error('[cropper] createImageBitmap failed', err, {
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
          type: 'pan',
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
          type: 'pinch',
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

      if (this.pointers.size === 1 && this.gestureStart.type === 'pan') {
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
          type: 'pan',
          startScale: this.scale,
          startTx: this.tx,
          startTy: this.ty,
          startDist: 0,
          startMid: { x: p.x, y: p.y },
        };
      } else if (this.pointers.size >= 2) {
        const [a, b] = Array.from(this.pointers.values());
        this.gestureStart = {
          type: 'pinch',
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

    frame.addEventListener('pointerdown', onPointerDown, { passive: false });
    frame.addEventListener('pointermove', onPointerMove, { passive: false });
    frame.addEventListener('pointerup', onPointerUp, { passive: false });
    frame.addEventListener('pointercancel', onPointerUp, { passive: false });

    this.cleanup = () => {
      frame.removeEventListener('pointerdown', onPointerDown as any);
      frame.removeEventListener('pointermove', onPointerMove as any);
      frame.removeEventListener('pointerup', onPointerUp as any);
      frame.removeEventListener('pointercancel', onPointerUp as any);
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

    const fr = this.frameRef.nativeElement.getBoundingClientRect();

    const rn = this.getRotatedNaturalSize();

    const dispScale = this.baseScale * this.scale;
    const imgW = rn.w * dispScale;
    const imgH = rn.h * dispScale;

    const maxTx = Math.max(0, (imgW - fr.width) / 2);
    const maxTy = Math.max(0, (imgH - fr.height) / 2);

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

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  async use(): Promise<void> {
    if (!this.ready) return;

    const outW = this.model.width;
    const outH = this.model.height;

    const frameEl = this.frameRef.nativeElement;
    const fw = frameEl.clientWidth;
    const fh = frameEl.clientHeight;

    const dispScale = this.baseScale * this.scale;

    // Rotated “natural” size (what the user sees after rot)
    const r = (((this.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    const rotW = r === 90 || r === 270 ? this.naturalH : this.naturalW;
    const rotH = r === 90 || r === 270 ? this.naturalW : this.naturalH;

    // Crop rect in ROTATED image coordinates
    let sWidthR = fw / dispScale;
    let sHeightR = fh / dispScale;

    sWidthR = Math.min(sWidthR, rotW);
    sHeightR = Math.min(sHeightR, rotH);

    let sxR = rotW / 2 - sWidthR / 2 - this.tx / dispScale;
    let syR = rotH / 2 - sHeightR / 2 - this.ty / dispScale;

    const eps = 1e-3;
    const maxSxR = Math.max(0, rotW - sWidthR);
    const maxSyR = Math.max(0, rotH - sHeightR);

    sxR = clamp(sxR, 0, maxSxR);
    syR = clamp(syR, 0, maxSyR);

    if (sxR + sWidthR > rotW) sxR = Math.max(0, rotW - sWidthR - eps);
    if (syR + sHeightR > rotH) syR = Math.max(0, rotH - sHeightR - eps);

    const bitmap =
      this.sourceBitmap ??
      (this.sourceBitmapPromise
        ? await this.sourceBitmapPromise
        : await createImageBitmap(this.file));

    // 1) Build a rotated canvas (pixel-perfect, no stretching)
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = rotW;
    rotCanvas.height = rotH;

    const rctx = rotCanvas.getContext('2d');
    if (!rctx) return;

    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = 'high';

    rctx.save();
    // Draw the ORIGINAL bitmap into rotCanvas applying rotation,
    // but ensuring final buffer is rotW x rotH.
    if (r === 0) {
      rctx.drawImage(bitmap, 0, 0);
    } else if (r === 90) {
      // rotCanvas: width=H, height=W
      rctx.translate(rotW, 0);
      rctx.rotate(Math.PI / 2);
      rctx.drawImage(bitmap, 0, 0);
    } else if (r === 180) {
      rctx.translate(rotW, rotH);
      rctx.rotate(Math.PI);
      rctx.drawImage(bitmap, 0, 0);
    } else {
      // 270
      rctx.translate(0, rotH);
      rctx.rotate(-Math.PI / 2);
      rctx.drawImage(bitmap, 0, 0);
    }
    rctx.restore();

    // 2) Draw crop from rotated canvas into OUTPUT canvas (no rotate here)
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, outW, outH);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(rotCanvas, sxR, syR, sWidthR, sHeightR, 0, 0, outW, outH);

    // 3) Post-process (same as before)
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
      canvas.toBlob((bb) => resolve(bb), 'image/jpeg', quality),
    );

    if (!blob) return;

    const name =
      this.file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '') + `_cropped.jpg`;

    const croppedFile = new File([blob], name, { type: 'image/jpeg' });

    this.modalCtrl.dismiss(
      { file: croppedFile, state: this.getState() },
      'done',
    );
  }

  private mapRotatedRectToSource(
    sxR: number,
    syR: number,
    sWR: number,
    sHR: number,
    rot: 0 | 90 | 180 | 270,
  ): { sx: number; sy: number; sWidth: number; sHeight: number } {
    const W = this.naturalW;
    const H = this.naturalH;

    if (rot === 0) {
      return { sx: sxR, sy: syR, sWidth: sWR, sHeight: sHR };
    }

    if (rot === 180) {
      return {
        sx: W - (sxR + sWR),
        sy: H - (syR + sHR),
        sWidth: sWR,
        sHeight: sHR,
      };
    }

    if (rot === 90) {
      return {
        sx: sxR,
        sy: H - (syR + sHR),
        sWidth: sWR,
        sHeight: sHR,
      };
    }

    return {
      sx: W - (sxR + sWR),
      sy: syR,
      sWidth: sWR,
      sHeight: sHR,
    };
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
