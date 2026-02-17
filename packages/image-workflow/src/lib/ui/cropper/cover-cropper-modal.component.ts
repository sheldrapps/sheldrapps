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
import { Subscription } from "rxjs";
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
  IonSelect,
  IonSelectOption,
} from "@ionic/angular/standalone";
import {
  ModalController,
  AlertController,
  Platform,
} from "@ionic/angular/standalone";

import { addIcons } from "ionicons";
import {
  addOutline,
  removeOutline,
  refreshOutline,
  chevronUpOutline,
  closeOutline,
  optionsOutline,
  cropOutline,
  returnUpBackOutline,
  returnUpForwardOutline,
  checkmarkOutline,
} from "ionicons/icons";


import type {
  CoverCropState,
  CropTarget,
  CropperResult,
  CropFormatOption,
} from "../../types";
import { renderCroppedFile } from "../../core/pipeline/cropper-export";

// Local override: extend CropperLabels for all needed fields for this component
type CropperLabels = {
  title: string;
  cancelLabel: string;
  doneLabel: string;
  applyLabel: string;
  discardLabel: string;
  loadingLabel: string;
  hintLabel: string;
  adjustmentsLabel: string;
  toolsLabel: string;
  modelLabel: string;
  cropLabel: string;
  groupLabel: string;
  generationLabel: string;
  rotateLabel: string;
  rotateLeftLabel: string;
  rotateRightLabel: string;
  zoomLabel: string;
  resetAdjustmentsAriaLabel: string;
  brightnessLabel: string;
  saturationLabel: string;
  contrastLabel: string;
  bwLabel: string;
  ditherLabel: string;
  frameAriaLabel: string;
  controlsAriaLabel: string;
  resetAriaLabel: string;
  zoomOutAriaLabel: string;
  zoomInAriaLabel: string;
  adjustmentsAriaLabel: string;
  undoLabel?: string;
  redoLabel?: string;
  // New fields for full localizability
  confirmationTitle?: string;
  continueLabel?: string;
  unsavedBlockDiscardToUndoMessage?: string;
  unsavedBlockDiscardToRedoMessage?: string;
  discardBlockChangesMessage?: string;
  unsavedMainDiscardAndCloseMessage?: string;
  unsavedChangesInBlockToIncludeApplyMessage?: string;
  unsavedChangesInBlockToSaveApplyMessage?: string;
  // For new confirmation logic
  confirmDiscardBlockForUndo?: string;
  confirmDiscardBlockForRedo?: string;
  confirmDiscardBlock?: string;
  confirmDiscardMain?: string;
  confirmDiscardBlockForDone?: string;
  confirmDiscardBlockForUse?: string;
  confirmDiscardButton?: string;
  cancelButton?: string;
  confirmHeader?: string;
};

type Pt = { x: number; y: number };
type AdjustPanel = "brightness" | "saturation" | "contrast" | "bw";

interface HistoryEntry {
  before: CoverCropState;
  after: CoverCropState;
}

interface BlockSession {
  baseSnapshot: CoverCropState;
  draftState: CoverCropState;
  commitSnapshot: CoverCropState;
}

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
    IonSelect,
    IonSelectOption,
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

  @Input() kindleGroups?: any[];
  @Input() kindleGroupLabels?: Map<string, string>;
  @Input() kindleModelLabels?: Map<string, string>;
  @Input() kindleSelectedGroupId?: string;
  @Input() kindleSelectedModel?: any;
  @Input() onKindleModelChange?: (model: any) => void;

  @Input() title?: string;
  @Input() cancelLabel?: string;
  @Input() doneLabel?: string;
  @Input() applyLabel?: string;
  @Input() discardLabel?: string;
  @Input() loadingLabel?: string;
  @Input() hintLabel?: string;
  @Input() adjustmentsLabel?: string;
  @Input() resetAdjustmentsAriaLabel?: string;
  @Input() rotateLabel?: string;
  @Input() rotateLeftLabel?: string;
  @Input() rotateRightLabel?: string;
  @Input() brightnessLabel?: string;
  @Input() saturationLabel?: string;
  @Input() contrastLabel?: string;
  @Input() bwLabel?: string;
  @Input() ditherLabel?: string;

  @Input() frameAriaLabel?: string;
  @Input() controlsAriaLabel?: string;
  @Input() resetAriaLabel?: string;
  @Input() zoomOutAriaLabel?: string;
  @Input() zoomInAriaLabel?: string;
  @Input() adjustmentsAriaLabel?: string;

  @ViewChild("frame", { read: ElementRef }) frameRef!: ElementRef<HTMLElement>;
  @ViewChild("img", { read: ElementRef }) imgRef!: ElementRef<HTMLImageElement>;
  @ViewChild("adjustTabsContainer", { read: ElementRef })
  adjustTabsContainerRef?: ElementRef<HTMLElement>;
  @ViewChild("cropTabsContainer", { read: ElementRef })
  cropTabsContainerRef?: ElementRef<HTMLElement>;

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

  toolsMode = false;
  adjustmentsMode = false;
  activeToolPanel: string | null = null;
  activeAdjustPanel: AdjustPanel | null = null;

  showFadeRight = false;
  showFadeLeft = false;
  private didNudgeTabsScroll = false;
  private scrollHintSubscriptions: Subscription[] = [];

  showCropFadeRight = false;
  showCropFadeLeft = false;
  private didNudgeCropTabsScroll = false;
  private cropScrollHintSubscriptions: Subscription[] = [];

  private globalUndoStack: HistoryEntry[] = [];
  private globalRedoStack: HistoryEntry[] = [];
  private gestureStartSnapshot: CoverCropState | null = null;
  private sliderStartSnapshot: CoverCropState | null = null;

  private originalOpenState: CoverCropState | null = null;

  private blockSession: BlockSession | null = null;

  get canUndo(): boolean {
    return this.globalUndoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.globalRedoStack.length > 0;
  }

  get blockSessionDirty(): boolean {
    if (!this.blockSession) return false;
    return !this.isEqualEditorState(
      this.blockSession.baseSnapshot,
      this.blockSession.draftState,
    );
  }

  get showDiscardApply(): boolean {
    return this.blockSession !== null;
  }

  get hasUnsavedMainChanges(): boolean {
    if (!this.originalOpenState) return false;
    return !this.isEqualEditorState(this.originalOpenState, this.getState());
  }

  internalKindleSelectedGroupId?: string;
  internalKindleSelectedModel?: any;

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
  private backButtonSub?: Subscription;

  private sourceBitmap?: ImageBitmap;
  private sourceBitmapPromise?: Promise<ImageBitmap>;

  private didEmitReady = false;
  private imageLoaded = false;
  selectedFormatId?: string;
  uiLabels: CropperLabels = DEFAULT_LABELS["en"];

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private platform: Platform,
  ) {
    addIcons({
      removeOutline,
      refreshOutline,
      addOutline,
      closeOutline,
      chevronUpOutline,
      optionsOutline,
      cropOutline,
      returnUpBackOutline,
      returnUpForwardOutline,
      checkmarkOutline,
    });
  }

  get aspectRatio(): number {
    const t = this.getActiveTarget();
    return t.width / t.height;
  }

  get currentKindleModels(): any[] {
    if (!this.internalKindleSelectedGroupId || !this.kindleGroups) return [];
    const group = this.kindleGroups.find(
      (g) => g.id === this.internalKindleSelectedGroupId,
    );
    return group?.items ?? [];
  }

  compareKindleModels(m1: any, m2: any): boolean {
    return m1 && m2 ? m1.id === m2.id : m1 === m2;
  }

  onKindleGroupChange(): void {
    if (this.internalKindleSelectedGroupId) {
      const group = this.kindleGroups?.find(
        (g) => g.id === this.internalKindleSelectedGroupId,
      );
      if (group && group.items.length > 0) {
        this.internalKindleSelectedModel = group.items[0];
        this.onKindleModelChangeInternal();
      }
    }
  }

  onKindleModelChangeInternal(): void {
    if (this.internalKindleSelectedModel && this.onKindleModelChange) {
      this.onKindleModelChange(this.internalKindleSelectedModel);
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
      this.tryReady();
    }
  }

  onFormatOptionClick(formatId: string): void {
    if (formatId === this.selectedFormatId) return;
    this.selectedFormatId = formatId;
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.tryReady();
  }

  toggleAdjustmentsMode(): void {
    if (this.adjustmentsMode) {
      this.adjustmentsMode = false;
      this.activeAdjustPanel = null;
      this.blockSession = null;
    } else {
      this.toolsMode = false;
      this.activeToolPanel = null;
      this.adjustmentsMode = true;
      this.openBlockSession();
      this.activeAdjustPanel = this.activeAdjustPanel ?? "brightness";

      setTimeout(() => {
        this.recalculateTabsOverflow();
        this.nudgeTabsScroll();
      }, 100);
    }
  }

  resetAdjustments(): void {
    this.brightness = 1;
    this.saturation = 1;
    this.contrast = 1;
    this.bw = false;
    this.dither = false;
    this.onAdjustChanged();
  }

  toggleToolsMode(): void {
    if (this.toolsMode) {
      this.toolsMode = false;
      this.activeToolPanel = null;
      this.blockSession = null;
    } else {
      this.adjustmentsMode = false;
      this.activeAdjustPanel = null;
      this.toolsMode = true;
      this.openBlockSession();
      if (this.formatOptions && this.formatOptions.length > 0) {
        this.activeToolPanel = this.activeToolPanel ?? "crop";
        setTimeout(() => {
          this.recalculateCropTabsOverflow();
          this.nudgeCropTabsScroll();
        }, 100);
      } else {
        this.activeToolPanel = this.activeToolPanel ?? "model";
      }
    }
  }

  togglePanel(panelName: string): void {
    if (this.activeToolPanel === panelName) {
      this.activeToolPanel = null;
    } else {
      this.activeToolPanel = panelName;
      if (panelName === "crop") {
        setTimeout(() => {
          this.recalculateCropTabsOverflow();
          this.nudgeCropTabsScroll();
        }, 100);
      }
    }
  }

  toggleAdjustPanel(panel: AdjustPanel): void {
    if (this.activeAdjustPanel === panel) {
      this.activeAdjustPanel = null;
    } else {
      this.activeAdjustPanel = panel;
    }
  }

  private recalculateTabsOverflow(): void {
    if (!this.adjustTabsContainerRef) return;

    const container = this.adjustTabsContainerRef.nativeElement;
    const hasOverflow = container.scrollWidth > container.clientWidth;

    if (!hasOverflow) {
      this.showFadeRight = false;
      this.showFadeLeft = false;
      return;
    }

    const atStart = container.scrollLeft <= 0;
    const atEnd =
      Math.ceil(container.scrollLeft + container.clientWidth) >=
      container.scrollWidth - 1;

    this.showFadeRight = !atEnd;
    this.showFadeLeft = !atStart;
  }

  private onTabsScroll(): void {
    this.recalculateTabsOverflow();
  }

  private nudgeTabsScroll(): void {
    if (this.didNudgeTabsScroll || !this.adjustTabsContainerRef) return;

    const container = this.adjustTabsContainerRef.nativeElement;
    if (container.scrollWidth <= container.clientWidth) {
      return;
    }

    this.didNudgeTabsScroll = true;

    const nudgeDistance = 14;
    const duration = 600;

    const startTime = performance.now();
    const startScroll = container.scrollLeft;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = 1 - Math.pow(1 - progress, 3);
      container.scrollLeft = startScroll + nudgeDistance * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const returnStartTime = performance.now();
        const returnAnimate = (returnCurrentTime: number) => {
          const returnElapsed = returnCurrentTime - returnStartTime;
          const returnProgress = Math.min(returnElapsed / duration, 1);
          const returnEaseProgress = 1 - Math.pow(1 - returnProgress, 3);

          container.scrollLeft =
            startScroll + nudgeDistance * (1 - returnEaseProgress);

          if (returnProgress < 1) {
            requestAnimationFrame(returnAnimate);
          } else {
            container.scrollLeft = startScroll;
            this.recalculateTabsOverflow();
          }
        };

        requestAnimationFrame(returnAnimate);
      }
    };

    requestAnimationFrame(animate);
  }

  private recalculateCropTabsOverflow(): void {
    if (!this.cropTabsContainerRef) return;

    const container = this.cropTabsContainerRef.nativeElement;
    const hasOverflow = container.scrollWidth > container.clientWidth;

    if (!hasOverflow) {
      this.showCropFadeRight = false;
      this.showCropFadeLeft = false;
      return;
    }

    const atStart = container.scrollLeft <= 0;
    const atEnd =
      Math.ceil(container.scrollLeft + container.clientWidth) >=
      container.scrollWidth - 1;

    this.showCropFadeRight = !atEnd;
    this.showCropFadeLeft = !atStart;
  }

  private onCropTabsScroll(): void {
    this.recalculateCropTabsOverflow();
  }

  private nudgeCropTabsScroll(): void {
    if (this.didNudgeCropTabsScroll || !this.cropTabsContainerRef) return;

    const container = this.cropTabsContainerRef.nativeElement;
    if (container.scrollWidth <= container.clientWidth) {
      return;
    }

    this.didNudgeCropTabsScroll = true;

    const nudgeDistance = 14;
    const duration = 600;

    const startTime = performance.now();
    const startScroll = container.scrollLeft;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = 1 - Math.pow(1 - progress, 3);
      container.scrollLeft = startScroll + nudgeDistance * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const returnStartTime = performance.now();
        const returnAnimate = (returnCurrentTime: number) => {
          const returnElapsed = returnCurrentTime - returnStartTime;
          const returnProgress = Math.min(returnElapsed / duration, 1);
          const returnEaseProgress = 1 - Math.pow(1 - returnProgress, 3);

          container.scrollLeft =
            startScroll + nudgeDistance * (1 - returnEaseProgress);

          if (returnProgress < 1) {
            requestAnimationFrame(returnAnimate);
          } else {
            container.scrollLeft = startScroll;
            this.recalculateCropTabsOverflow();
          }
        };

        requestAnimationFrame(returnAnimate);
      }
    };

    requestAnimationFrame(animate);
  }

  ngOnInit(): void {
    this.refreshLabels();
    this.ready = false;
    this.didEmitReady = false;
    this.imageLoaded = false;
    this.toolsMode = false;
    this.adjustmentsMode = false;
    this.activeToolPanel = null;
    this.activeAdjustPanel = null;
    this.selectedFormatId =
      this.formatId ?? this.formatOptions?.[0]?.id ?? undefined;

    this.internalKindleSelectedGroupId = this.kindleSelectedGroupId;
    this.internalKindleSelectedModel = this.kindleSelectedModel;

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

      this.rot = this.normalizeRotation(Number(this.initialState.rot ?? 0));
    }

    this.backButtonSub = this.platform.backButton.subscribeWithPriority(
      999,
      async () => {
        if (this.blockSession) {
          const canExit = await this.attemptExitBlock();
          if (canExit) {
            await this.attemptModalDismiss();
          }
        } else {
          const canDismiss = await this.attemptModalDismiss();
          if (canDismiss) {
            this.modalCtrl.dismiss(null, "cancel");
          }
        }
      },
    );

    this.originalOpenState = this.captureSnapshot();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.refreshLabels();

    // If kindleSelectedModel changes from parent, update internal state and reset view
    if (
      _changes["kindleSelectedModel"] &&
      !_changes["kindleSelectedModel"].firstChange
    ) {
      this.internalKindleSelectedModel = this.kindleSelectedModel;
      // Reset zoom and position when model changes
      if (this.kindleSelectedModel && this.ready) {
        this.scale = 1;
        this.tx = 0;
        this.ty = 0;
        this.tryReady();
      }
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
        this.onGestureStart();
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
        if (!this.gestureStart) this.onGestureStart();
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
        this.onGestureEnd();
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

    if (this.adjustTabsContainerRef) {
      const tabsScroll = () => this.onTabsScroll();
      const tabsResize = () => this.recalculateTabsOverflow();

      const tabsContainer = this.adjustTabsContainerRef.nativeElement;
      tabsContainer.addEventListener("scroll", tabsScroll, { passive: true });
      window.addEventListener("resize", tabsResize, { passive: true });

      const tabsCleanup = () => {
        tabsContainer.removeEventListener("scroll", tabsScroll as any);
        window.removeEventListener("resize", tabsResize as any);
      };

      this.scrollHintSubscriptions.push({
        unsubscribe: tabsCleanup,
      } as any);
    }

    if (this.cropTabsContainerRef) {
      const cropScroll = () => this.onCropTabsScroll();
      const cropResize = () => this.recalculateCropTabsOverflow();

      const cropContainer = this.cropTabsContainerRef.nativeElement;
      cropContainer.addEventListener("scroll", cropScroll, { passive: true });
      window.addEventListener("resize", cropResize, { passive: true });

      const cropCleanup = () => {
        cropContainer.removeEventListener("scroll", cropScroll as any);
        window.removeEventListener("resize", cropResize as any);
      };

      this.cropScrollHintSubscriptions.push({
        unsubscribe: cropCleanup,
      } as any);
    }

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
    this.backButtonSub?.unsubscribe();
    this.scrollHintSubscriptions.forEach((sub) => sub.unsubscribe?.());
    this.cropScrollHintSubscriptions.forEach((sub) => sub.unsubscribe?.());
    this.resizeObs?.disconnect();
    this.sourceBitmap?.close?.();
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
  }

  zoomIn(): void {
    const before = this.captureSnapshot();
    this.setScale(this.scale + this.step);
    const after = this.getState();

    if (this.blockSession) {
      this.blockSession.draftState = after;
    } else {
      if (!this.isEqualEditorState(before, after)) {
        this.globalUndoStack.push({ before, after });
        this.globalRedoStack = [];
      }
    }
  }

  zoomOut(): void {
    const before = this.captureSnapshot();
    this.setScale(this.scale - this.step);
    const after = this.getState();

    if (this.blockSession) {
      this.blockSession.draftState = after;
    } else {
      if (!this.isEqualEditorState(before, after)) {
        this.globalUndoStack.push({ before, after });
        this.globalRedoStack = [];
      }
    }
  }

  onAdjustChanged(): void {
    if (!this.ready) return;
    if (!this.bw) this.dither = false;

    if (this.blockSession) {
      this.blockSession.draftState = this.getState();
    }

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

  private setState(state: CoverCropState): void {
    this.scale = state.scale;
    this.tx = state.tx;
    this.ty = state.ty;
    this.brightness = state.brightness;
    this.saturation = state.saturation;
    this.contrast = state.contrast;
    this.bw = state.bw;
    this.dither = state.dither;
    this.rot = this.normalizeRotation(state.rot);
    this.clampAndRender();
  }

  private normalizeRotation(degrees: number): number {
    const normalized = degrees % 360;
    const positive = normalized < 0 ? normalized + 360 : normalized;
    return (Math.round(positive / 90) * 90) % 360;
  }

  private captureSnapshot(): CoverCropState {
    return { ...this.getState() };
  }

  private isEqualEditorState(
    s1: CoverCropState,
    s2: CoverCropState,
    tolerance = 0.001,
  ): boolean {
    const floatEqual = (a: number, b: number) => Math.abs(a - b) < tolerance;

    return (
      floatEqual(s1.scale, s2.scale) &&
      floatEqual(s1.tx, s2.tx) &&
      floatEqual(s1.ty, s2.ty) &&
      floatEqual(s1.brightness, s2.brightness) &&
      floatEqual(s1.saturation, s2.saturation) &&
      floatEqual(s1.contrast, s2.contrast) &&
      s1.bw === s2.bw &&
      s1.dither === s2.dither &&
      s1.rot === s2.rot
    );
  }

  private statesEqual(s1: CoverCropState, s2: CoverCropState): boolean {
    return this.isEqualEditorState(s1, s2);
  }

  private markDirtyIfNeeded(): void {}

  openBlockSession(): void {
    if (this.blockSession) return;
    const snapshot = this.captureSnapshot();
    this.blockSession = {
      baseSnapshot: snapshot,
      draftState: { ...snapshot },
      commitSnapshot: snapshot,
    };
  }

  closeBlockSession(apply: boolean): void {
    if (!this.blockSession) return;

    if (apply && this.blockSessionDirty) {
      const finalState = this.getState();
      if (
        !this.isEqualEditorState(this.blockSession.commitSnapshot, finalState)
      ) {
        const entry: HistoryEntry = {
          before: this.blockSession.commitSnapshot,
          after: finalState,
        };
        this.globalUndoStack.push(entry);
        this.globalRedoStack = [];
      }
    }

    if (!apply) {
      this.setState(this.blockSession.baseSnapshot);
    }

    this.blockSession = null;
    this.toolsMode = false;
    this.adjustmentsMode = false;
    this.activeToolPanel = null;
    this.activeAdjustPanel = null;
  }

  onGestureStart(): void {
    this.gestureStartSnapshot = this.captureSnapshot();
  }

  onGestureEnd(): void {
    if (!this.gestureStartSnapshot) return;

    const currentState = this.getState();

    if (this.blockSession) {
      this.blockSession.draftState = currentState;
    } else {
      if (!this.isEqualEditorState(this.gestureStartSnapshot, currentState)) {
        const entry: HistoryEntry = {
          before: this.gestureStartSnapshot,
          after: currentState,
        };
        this.globalUndoStack.push(entry);
        this.globalRedoStack = [];
      }
    }

    this.gestureStartSnapshot = null;
  }

  onSliderStart(): void {
    this.sliderStartSnapshot = this.captureSnapshot();
  }

  onSliderEnd(): void {
    if (!this.sliderStartSnapshot) return;

    if (this.blockSession) {
      this.blockSession.draftState = this.getState();
    } else {
      const currentState = this.getState();
      if (!this.isEqualEditorState(this.sliderStartSnapshot, currentState)) {
        const entry: HistoryEntry = {
          before: this.sliderStartSnapshot,
          after: currentState,
        };
        this.globalUndoStack.push(entry);
        this.globalRedoStack = [];
      }
    }

    this.sliderStartSnapshot = null;
  }

  async undo(): Promise<void> {
    if (this.blockSession && this.blockSessionDirty) {
      const confirmed = await this.showConfirmation(
        this.uiLabels.confirmDiscardBlockForUndo ||
          this.uiLabels.unsavedBlockDiscardToUndoMessage ||
          "",
        this.uiLabels.confirmDiscardButton ||
          this.uiLabels.discardLabel ||
          "Discard",
        this.uiLabels.cancelButton || this.uiLabels.cancelLabel || "Cancel",
      );
      if (!confirmed) return;
      this.closeBlockSession(false);
    }

    if (this.globalUndoStack.length === 0) return;

    const entry = this.globalUndoStack.pop()!;
    this.globalRedoStack.push(entry);
    this.setState(entry.before);
  }

  async redo(): Promise<void> {
    if (this.blockSession && this.blockSessionDirty) {
      const confirmed = await this.showConfirmation(
        this.uiLabels.confirmDiscardBlockForRedo ||
          this.uiLabels.unsavedBlockDiscardToRedoMessage ||
          "",
        this.uiLabels.confirmDiscardButton ||
          this.uiLabels.discardLabel ||
          "Discard",
        this.uiLabels.cancelButton || this.uiLabels.cancelLabel || "Cancel",
      );
      if (!confirmed) return;
      this.closeBlockSession(false);
    }

    if (this.globalRedoStack.length === 0) return;

    const entry = this.globalRedoStack.pop()!;
    this.globalUndoStack.push(entry);
    this.setState(entry.after);
  }

  async attemptExitBlock(): Promise<boolean> {
    if (!this.blockSession) return true;

    if (this.blockSessionDirty) {
      const confirmed = await this.showConfirmation(
        this.uiLabels.confirmDiscardBlock ||
          this.uiLabels.discardBlockChangesMessage ||
          "",
        this.uiLabels.confirmDiscardButton ||
          this.uiLabels.discardLabel ||
          "Discard",
        this.uiLabels.cancelButton || this.uiLabels.cancelLabel || "Cancel",
      );
      if (!confirmed) return false;
    }

    this.closeBlockSession(false);
    return false;
  }

  async attemptModalDismiss(): Promise<boolean> {
    if (this.blockSession) {
      return await this.attemptExitBlock();
    }

    if (this.hasUnsavedMainChanges) {
      const confirmed = await this.showConfirmation(
        this.uiLabels.confirmDiscardMain ||
          this.uiLabels.unsavedMainDiscardAndCloseMessage ||
          "",
        this.uiLabels.confirmDiscardButton ||
          this.uiLabels.discardLabel ||
          "Discard",
        this.uiLabels.cancelButton || this.uiLabels.cancelLabel || "Cancel",
      );
      if (!confirmed) return false;

      if (this.originalOpenState) {
        this.setState(this.originalOpenState);
      }
      this.globalUndoStack = [];
      this.globalRedoStack = [];
    }

    return true;
  }

  async canDismissModal(): Promise<boolean> {
    return await this.attemptModalDismiss();
  }

  async discardBlockSession(): Promise<void> {
    await this.attemptExitBlock();
  }

  async applyBlockSession(): Promise<void> {
    if (!this.blockSession) return;
    this.closeBlockSession(true);
  }

  private async showConfirmation(
    message: string,
    confirmText: string,
    cancelText: string,
  ): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: this.uiLabels.confirmHeader,
      message: message,
      buttons: [
        {
          text: cancelText,
          role: "cancel",
          handler: () => false,
        },
        {
          text: confirmText,
          role: "confirm",
          handler: () => true,
        },
      ],
    });

    let result = false;
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === "confirm") result = true;
    return result;
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
      rot: this.normalizeRotation(this.rot),
    };
  }

  async cancel(): Promise<void> {
    if (this.blockSession) {
      await this.attemptExitBlock();
      return;
    }

    const canDismiss = await this.attemptModalDismiss();
    if (canDismiss) {
      this.modalCtrl.dismiss(null, "cancel");
    }
  }

  async done(): Promise<void> {
    if (this.blockSession) {
      if (this.blockSessionDirty) {
        const confirmed = await this.showConfirmation(
          this.uiLabels.confirmDiscardBlockForDone ||
            this.uiLabels.unsavedChangesInBlockToIncludeApplyMessage ||
            "",
          this.uiLabels.confirmDiscardButton ||
            this.uiLabels.discardLabel ||
            "Discard",
          this.uiLabels.cancelButton || this.uiLabels.cancelLabel || "Cancel",
        );
        if (!confirmed) return;
      }
      this.closeBlockSession(false);
    }

    await this.use();
  }

  async use(): Promise<void> {
    if (this.blockSession) {
      if (this.blockSessionDirty) {
        const confirmed = await this.showConfirmation(
          this.uiLabels.confirmDiscardBlockForUse ||
            this.uiLabels.unsavedChangesInBlockToSaveApplyMessage ||
            "",
          this.uiLabels.confirmDiscardButton ||
            this.uiLabels.discardLabel ||
            "Discard",
          this.uiLabels.cancelButton || this.uiLabels.cancelLabel || "Cancel",
        );
        if (!confirmed) return;
      }
      this.closeBlockSession(false);
    }

    if (!this.ready) return;

    const target = this.getActiveTarget();

    const frameEl = this.frameRef.nativeElement;
    const state = this.getState();
    const croppedFile = await renderCroppedFile({
      file: this.file,
      target,
      frameWidth: frameEl.clientWidth,
      frameHeight: frameEl.clientHeight,
      baseScale: this.baseScale,
      naturalWidth: this.naturalW,
      naturalHeight: this.naturalH,
      state,
      sourceBitmap: this.sourceBitmap,
      sourceBitmapPromise: this.sourceBitmapPromise,
    });

    if (!croppedFile) return;

    const result: CropperResult = {
      file: croppedFile,
      state,
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
    this.applyDiscreteAction(() => {
      this.rot = (this.rot + 270) % 360;
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
    });
  }

  rotateRight(): void {
    this.applyDiscreteAction(() => {
      this.rot = (this.rot + 90) % 360;
      this.scale = 1;
      this.tx = 0;
      this.ty = 0;
    });
  }

  private applyDiscreteAction(action: () => void): void {
    const beforeSnapshot = this.captureSnapshot();

    action();

    if (!this.ready) {
      this.tryReady();
      return;
    }
    this.tryReady();

    const afterSnapshot = this.getState();

    if (this.blockSession) {
      this.blockSession.draftState = afterSnapshot;
    } else {
      if (!this.isEqualEditorState(beforeSnapshot, afterSnapshot)) {
        const entry: HistoryEntry = {
          before: beforeSnapshot,
          after: afterSnapshot,
        };
        this.globalUndoStack.push(entry);
        this.globalRedoStack = [];
      }
    }
  }

  private refreshLabels(): void {
    const resolvedLocale = resolveLocale(this.locale);
    const base = DEFAULT_LABELS[resolvedLocale] ?? DEFAULT_LABELS["en"];
    const inputOverrides: Partial<CropperLabels> = {
      title: this.title,
      cancelLabel: this.cancelLabel,
      doneLabel: this.doneLabel,
      applyLabel: this.applyLabel,
      discardLabel: this.discardLabel,
      loadingLabel: this.loadingLabel,
      hintLabel: this.hintLabel,
      adjustmentsLabel: this.adjustmentsLabel,
      resetAdjustmentsAriaLabel: this.resetAdjustmentsAriaLabel,
      rotateLabel: this.rotateLabel,
      rotateLeftLabel: this.rotateLeftLabel,
      rotateRightLabel: this.rotateRightLabel,
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
    if (this.kindleGroups?.length && this.internalKindleSelectedModel) {
      return {
        width: this.internalKindleSelectedModel.width,
        height: this.internalKindleSelectedModel.height,
      };
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
    undoLabel: "Undo",
    redoLabel: "Redo",
    confirmationTitle: "Confirmation",
    continueLabel: "Continue",
    unsavedBlockDiscardToUndoMessage:
      "You have unsaved changes in this block. Discard to continue with global undo?",
    unsavedBlockDiscardToRedoMessage:
      "You have unsaved changes in this block. Discard to continue with global redo?",
    discardBlockChangesMessage: "Discard changes in this block?",
    unsavedMainDiscardAndCloseMessage:
      "You have unsaved changes. Discard changes and close?",
    unsavedChangesInBlockToIncludeApplyMessage:
      "You have unsaved changes. To include them, press 'Apply'. Discard and continue?",
    unsavedChangesInBlockToSaveApplyMessage:
      "You have unsaved changes. To include them in the image, press 'Apply'. Discard changes and save?",
    title: "Crop",
    cancelLabel: "Cancel",
    doneLabel: "Done",
    applyLabel: "Apply",
    discardLabel: "Discard",
    loadingLabel: "Loading…",
    hintLabel: "Pinch to zoom · Drag to move",
    adjustmentsLabel: "Adjustments",
    toolsLabel: "Tools",
    modelLabel: "Model",
    cropLabel: "Crop",
    groupLabel: "Group",
    generationLabel: "Generation",
    rotateLabel: "Rotate",
    rotateLeftLabel: "Left",
    rotateRightLabel: "Right",
    zoomLabel: "Zoom",
    resetAdjustmentsAriaLabel: "Reset adjustments",
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
    undoLabel: "Deshacer",
    redoLabel: "Rehacer",
    confirmationTitle: "Confirmación",
    continueLabel: "Continuar",
    unsavedBlockDiscardToUndoMessage:
      "Tienes cambios sin aplicar en este bloque. ¿Descartar para continuar con deshacer global?",
    unsavedBlockDiscardToRedoMessage:
      "Tienes cambios sin aplicar en este bloque. ¿Descartar para continuar con rehacer global?",
    discardBlockChangesMessage: "¿Descartar cambios en este bloque?",
    unsavedMainDiscardAndCloseMessage:
      "Tienes cambios sin guardar. ¿Descartar cambios y cerrar?",
    unsavedChangesInBlockToIncludeApplyMessage:
      "Tienes cambios sin aplicar. Para incluirlos, presiona 'Aplicar'. ¿Descartar y continuar?",
    unsavedChangesInBlockToSaveApplyMessage:
      "Tienes cambios sin aplicar. Para incluirlos en la imagen, presiona 'Aplicar'. ¿Descartar cambios y guardar?",
    title: "Recortar",
    cancelLabel: "Cancelar",
    doneLabel: "Listo",
    applyLabel: "Aplicar",
    discardLabel: "Descartar",
    loadingLabel: "Cargando…",
    hintLabel: "Pellizca para hacer zoom · Arrastra para mover",
    adjustmentsLabel: "Ajustes",
    toolsLabel: "Herramientas",
    modelLabel: "Modelo",
    cropLabel: "Recorte",
    groupLabel: "Grupo",
    generationLabel: "Generación",
    rotateLabel: "Rotar",
    rotateLeftLabel: "Izquierda",
    rotateRightLabel: "Derecha",
    zoomLabel: "Zoom",
    resetAdjustmentsAriaLabel: "Restablecer ajustes",
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
    undoLabel: "Rückgängig",
    redoLabel: "Wiederholen",
    confirmationTitle: "Bestätigung",
    continueLabel: "Fortfahren",
    unsavedBlockDiscardToUndoMessage:
      "Sie haben nicht gespeicherte Änderungen in diesem Block. Verwerfen, um mit globalem Rückgängig fortzufahren?",
    unsavedBlockDiscardToRedoMessage:
      "Sie haben nicht gespeicherte Änderungen in diesem Block. Verwerfen, um mit globalem Wiederholen fortzufahren?",
    discardBlockChangesMessage: "Änderungen in diesem Block verwerfen?",
    unsavedMainDiscardAndCloseMessage:
      "Sie haben nicht gespeicherte Änderungen. Änderungen verwerfen und schließen?",
    unsavedChangesInBlockToIncludeApplyMessage:
      "Sie haben nicht gespeicherte Änderungen. Um sie einzubeziehen, drücken Sie 'Anwenden'. Verwerfen und fortfahren?",
    unsavedChangesInBlockToSaveApplyMessage:
      "Sie haben nicht gespeicherte Änderungen. Um sie im Bild zu speichern, drücken Sie 'Anwenden'. Änderungen verwerfen und speichern?",
    title: "Zuschneiden",
    cancelLabel: "Abbrechen",
    doneLabel: "Fertig",
    applyLabel: "Anwenden",
    discardLabel: "Verwerfen",
    loadingLabel: "Wird geladen…",
    hintLabel: "Zum Zoomen ziehen · Zum Verschieben wischen",
    adjustmentsLabel: "Anpassungen",
    toolsLabel: "Werkzeuge",
    modelLabel: "Modell",
    cropLabel: "Zuschnitt",
    groupLabel: "Gruppe",
    generationLabel: "Generation",
    rotateLabel: "Drehen",
    rotateLeftLabel: "Links",
    rotateRightLabel: "Rechts",
    zoomLabel: "Zoom",
    resetAdjustmentsAriaLabel: "Anpassungen zurücksetzen",
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
    undoLabel: "Desfazer",
    redoLabel: "Refazer",
    confirmationTitle: "Confirmação",
    continueLabel: "Continuar",
    unsavedBlockDiscardToUndoMessage:
      "Você tem alterações não aplicadas neste bloco. Descartar para continuar com desfazer global?",
    unsavedBlockDiscardToRedoMessage:
      "Você tem alterações não aplicadas neste bloco. Descartar para continuar com refazer global?",
    discardBlockChangesMessage: "Descartar alterações neste bloco?",
    unsavedMainDiscardAndCloseMessage:
      "Você tem alterações não salvas. Descartar alterações e fechar?",
    unsavedChangesInBlockToIncludeApplyMessage:
      "Você tem alterações não aplicadas. Para incluí-las, pressione 'Aplicar'. Descartar e continuar?",
    unsavedChangesInBlockToSaveApplyMessage:
      "Você tem alterações não aplicadas. Para incluí-las na imagem, pressione 'Aplicar'. Descartar alterações e salvar?",
    title: "Recortar",
    cancelLabel: "Cancelar",
    doneLabel: "Concluir",
    applyLabel: "Aplicar",
    discardLabel: "Descartar",
    loadingLabel: "Carregando…",
    hintLabel: "Aperte para zoom · Arraste para mover",
    adjustmentsLabel: "Ajustes",
    toolsLabel: "Ferramentas",
    modelLabel: "Modelo",
    cropLabel: "Recorte",
    groupLabel: "Grupo",
    generationLabel: "Geração",
    rotateLabel: "Girar",
    rotateLeftLabel: "Esquerda",
    rotateRightLabel: "Direita",
    zoomLabel: "Zoom",
    resetAdjustmentsAriaLabel: "Redefinir ajustes",
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
    undoLabel: "Annulla",
    redoLabel: "Ripristina",
    confirmationTitle: "Conferma",
    continueLabel: "Continua",
    unsavedBlockDiscardToUndoMessage:
      "Hai modifiche non applicate in questo blocco. Scartare per continuare con annulla globale?",
    unsavedBlockDiscardToRedoMessage:
      "Hai modifiche non applicate in questo blocco. Scartare per continuare con ripristina globale?",
    discardBlockChangesMessage: "Scartare le modifiche in questo blocco?",
    unsavedMainDiscardAndCloseMessage:
      "Hai modifiche non salvate. Scartare le modifiche e chiudere?",
    unsavedChangesInBlockToIncludeApplyMessage:
      "Hai modifiche non applicate. Per includerle, premi 'Applica'. Scartare e continuare?",
    unsavedChangesInBlockToSaveApplyMessage:
      "Hai modifiche non applicate. Per includerle nell'immagine, premi 'Applica'. Scartare le modifiche e salvare?",
    title: "Ritaglia",
    cancelLabel: "Annulla",
    doneLabel: "Fatto",
    applyLabel: "Applica",
    discardLabel: "Scarta",
    loadingLabel: "Caricamento…",
    hintLabel: "Pizzica per zoom · Trascina per spostare",
    adjustmentsLabel: "Regolazioni",
    toolsLabel: "Strumenti",
    modelLabel: "Modello",
    cropLabel: "Ritaglio",
    groupLabel: "Gruppo",
    generationLabel: "Generazione",
    rotateLabel: "Ruota",
    rotateLeftLabel: "Sinistra",
    rotateRightLabel: "Destra",
    zoomLabel: "Zoom",
    resetAdjustmentsAriaLabel: "Ripristina regolazioni",
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
    undoLabel: "Annuler",
    redoLabel: "Rétablir",
    confirmationTitle: "Confirmation",
    continueLabel: "Continuer",
    unsavedBlockDiscardToUndoMessage:
      "Vous avez des modifications non appliquées dans ce bloc. Abandonner pour continuer avec l'annulation globale ?",
    unsavedBlockDiscardToRedoMessage:
      "Vous avez des modifications non appliquées dans ce bloc. Abandonner pour continuer avec la réinitialisation globale ?",
    discardBlockChangesMessage: "Abandonner les modifications dans ce bloc ?",
    unsavedMainDiscardAndCloseMessage:
      "Vous avez des modifications non enregistrées. Abandonner les modifications et fermer ?",
    unsavedChangesInBlockToIncludeApplyMessage:
      "Vous avez des modifications non appliquées. Pour les inclure, appuyez sur 'Appliquer'. Abandonner et continuer ?",
    unsavedChangesInBlockToSaveApplyMessage:
      "Vous avez des modifications non appliquées. Pour les inclure dans l'image, appuyez sur 'Appliquer'. Abandonner les modifications et enregistrer ?",
    title: "Recadrer",
    cancelLabel: "Annuler",
    doneLabel: "Terminé",
    applyLabel: "Appliquer",
    discardLabel: "Abandonner",
    loadingLabel: "Chargement…",
    hintLabel: "Pincez pour zoomer · Glissez pour déplacer",
    adjustmentsLabel: "Réglages",
    toolsLabel: "Outils",
    modelLabel: "Modèle",
    cropLabel: "Recadrage",
    groupLabel: "Groupe",
    generationLabel: "Génération",
    rotateLabel: "Faire pivoter",
    rotateLeftLabel: "Gauche",
    rotateRightLabel: "Droite",
    zoomLabel: "Zoom",
    resetAdjustmentsAriaLabel: "Réinitialiser les réglages",
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
