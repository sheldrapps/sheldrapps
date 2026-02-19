import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
  effect,
} from "@angular/core";
import { CommonModule, NgComponentOutlet } from "@angular/common";
import {
  ActivatedRoute,
  Router,
  NavigationEnd,
  RouterModule,
} from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/angular/standalone";
import { EditorPanelComponent } from "@sheldrapps/ui-theme";
import { addIcons } from "ionicons";
import {
  cropOutline,
  optionsOutline,
  returnUpBackOutline,
  returnUpForwardOutline,
  closeOutline,
  checkmarkOutline,
  eyedropOutline,
} from "ionicons/icons";
import { filter } from "rxjs";

import { EditorSessionService, EditorSession } from "./editor-session.service";
import { EditorUiStateService } from "./editor-ui-state.service";
import { EditorStateService } from "./editor-state.service";
import { EditorHistoryService } from "./editor-history.service";
import { EditorPanelExitService } from "./editor-panel-exit.service";
import { EditorSessionExitService } from "./editor-session-exit.service";
import { EditorKindleStateService } from "./editor-kindle-state.service";
import { EditorColorSamplerService } from "./editor-color-sampler.service";
import { buildCssFilter } from "./editor-adjustments";
import { renderCompositionToCanvas } from "../core/pipeline/composition-render";
import type { CoverCropState, CropperResult } from "../types";

type Pt = { x: number; y: number };

type CanvasGestureStart = {
  type: "pan" | "pinch";
  startScale: number;
  startTx: number;
  startTy: number;
  startDist: number;
  startMid: Pt;
};

export interface EditorLabels {
  title: string;
  cancelLabel: string;
  doneLabel: string;
  undoLabel: string;
  redoLabel: string;
  discardLabel: string;
  applyLabel: string;
  loadingLabel: string;
  hintLabel: string;
  frameAriaLabel: string;
  controlsAriaLabel: string;
  toolsLabel: string;
  adjustmentsLabel: string;
}

const DEFAULT_LABELS: EditorLabels = {
  title: "EDITOR.SHELL.TITLE",
  cancelLabel: "EDITOR.SHELL.BUTTON.CANCEL",
  doneLabel: "EDITOR.SHELL.BUTTON.DONE",
  undoLabel: "EDITOR.SHELL.BUTTON.UNDO",
  redoLabel: "EDITOR.SHELL.BUTTON.REDO",
  discardLabel: "EDITOR.SHELL.BUTTON.DISCARD",
  applyLabel: "EDITOR.SHELL.BUTTON.APPLY",
  loadingLabel: "EDITOR.SHELL.LABEL.LOADING",
  hintLabel: "EDITOR.SHELL.HINT.PREVIEW",
  frameAriaLabel: "EDITOR.SHELL.ARIA.CROP_FRAME",
  controlsAriaLabel: "EDITOR.SHELL.ARIA.CONTROLS",
  toolsLabel: "EDITOR.SHELL.LABEL.TOOLS",
  adjustmentsLabel: "EDITOR.SHELL.LABEL.ADJUSTMENTS",
};

const DEFAULT_PICKER_SIZE = 120;
const PICKER_TIP_RATIO_X = 0.085;
const PICKER_TIP_RATIO_Y = 0.085;
const MAX_BG_BLUR_PX = 40;

@Component({
  selector: "cc-editor-shell-page",
  standalone: true,
  imports: [
    CommonModule,
    NgComponentOutlet,
    RouterModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    EditorPanelComponent,
    TranslateModule,
  ],
  templateUrl: "./editor-shell.page.html",
  styleUrls: ["./editor-shell.page.scss"],
})
export class EditorShellPage implements OnInit, AfterViewInit, OnDestroy {
  uiLabels: EditorLabels = DEFAULT_LABELS;

  @ViewChild("frame", { read: ElementRef }) frameRef!: ElementRef<HTMLElement>;
  @ViewChild("img", { read: ElementRef }) imgRef!: ElementRef<HTMLImageElement>;
  @ViewChild("picker", { read: ElementRef })
  pickerRef?: ElementRef<HTMLDivElement>;

  // Session
  sid = "";
  session: EditorSession | null = null;
  private returnUrl: string | null = null;
  private objectUrl?: string;

  // Preview
  aspectRatio = "3 / 4";
  imageUrl: string | null = null;
  ready = false;
  readonly cssFilter = computed(() =>
    buildCssFilter(this.editorState.adjustments()),
  );
  readonly isSampling = computed(() => this.colorSampler.active());
  readonly isDraggingSample = signal(false);
  readonly showSampleConfirm = computed(
    () => this.colorSampler.confirming() && !this.isDraggingSample(),
  );
  readonly displaySampleHex = computed(
    () => this.colorSampler.proposedHex() ?? this.colorSampler.sampleHex(),
  );
  readonly backgroundMode = computed(() => this.editorState.backgroundMode());
  readonly backgroundColor = computed(() => this.editorState.backgroundColor());
  readonly backgroundBlur = computed(() => this.editorState.backgroundBlur());
  readonly backgroundBlurPx = computed(() =>
    `${this.blurToPx(this.backgroundBlur())}px`,
  );
  readonly pickerPos = signal<Pt | null>(null);
  readonly pickerTip = signal<Pt>({ x: 0, y: 0 });
  readonly hintKey = computed(() =>
    this.ui.activeMode() === "tools"
      ? "EDITOR.SHELL.HINT.GESTURES"
      : "EDITOR.SHELL.HINT.PREVIEW",
  );
  private isExporting = false;

  readonly showDiscardApply = computed(() => this.history.mode() === "local");
  readonly showSessionActions = computed(
    () => this.history.mode() === "global",
  );

  // Minimal sizing state (kept here because shell owns the preview)
  private imageLoaded = false;
  private naturalW = 0;
  private naturalH = 0;
  private baseScale = 1;

  private scale = 1;
  private tx = 0;
  private ty = 0;
  private rot = 0;
  private flipX = false;
  private flipY = false;

  private samplingCanvas?: HTMLCanvasElement;
  private samplingCtx: CanvasRenderingContext2D | null = null;
  private samplingPointerId: number | null = null;
  private samplingWasActive = false;
  private pickerDragOffset: Pt | null = null;
  private lastSamplePos: Pt | null = null;
  private pickerTipOffset: Pt = { x: 0, y: 0 };

  private resizeObs?: ResizeObserver;
  private gestureStart?: CanvasGestureStart;
  private lastTapAt = 0;
  private lastTapPos: Pt | null = null;
  private gesturesEnabled = false;
  private readonly pointers = new Map<number, Pt>();
  private readonly capturedPointers = new Set<number>();
  private cleanupGestures?: () => void;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private editorSession: EditorSessionService,
    readonly ui: EditorUiStateService,
    private editorState: EditorStateService,
    readonly history: EditorHistoryService,
    private panelExit: EditorPanelExitService,
    private sessionExit: EditorSessionExitService,
    private zone: NgZone,
    private kindleState: EditorKindleStateService,
    private colorSampler: EditorColorSamplerService,
  ) {
    addIcons({
      cropOutline,
      optionsOutline,
      returnUpBackOutline,
      returnUpForwardOutline,
      closeOutline,
      checkmarkOutline,
      eyedropOutline,
    });

    // Listen to EditorStateService changes and update preview
    effect(() => {
      const nextRot = this.editorState.rot();
      const rotChanged = this.rot !== nextRot;
      const nextFlipX = this.editorState.flipX();
      const nextFlipY = this.editorState.flipY();

      this.scale = this.editorState.scale();
      this.tx = this.editorState.tx();
      this.ty = this.editorState.ty();
      this.rot = nextRot;
      this.flipX = nextFlipX;
      this.flipY = nextFlipY;

      if (rotChanged) {
        // Recompute baseScale (cover) when rotation changes
        this.tryReady();
      }

      this.renderTransform();
    });

    effect(() => {
      const active = this.colorSampler.active();
      if (!active) {
        this.samplingWasActive = false;
        this.samplingCanvas = undefined;
        this.samplingCtx = null;
        this.samplingPointerId = null;
        this.pickerDragOffset = null;
        this.lastSamplePos = null;
        this.isDraggingSample.set(false);
        this.pickerPos.set(null);
        return;
      }
      if (!this.samplingWasActive) {
        this.samplingWasActive = true;
        this.centerPicker();
        this.updatePickerMetrics();
        requestAnimationFrame(() => this.updatePickerMetrics());
      }
      void this.prepareSamplingCanvas();
    });

    effect(() => {
      if (this.colorSampler.active() && this.ui.panelId() === "fill") {
        this.ui.closePanel();
      }
    });

    effect(() => {
      const target = this.kindleState.target();
      if (!this.session || !target) return;

      this.session.target = target;
      this.aspectRatio = `${target.width} / ${target.height}`;

      if (this.session.tools?.kindle) {
        this.session.tools.kindle.selectedGroupId =
          this.kindleState.selectedGroupId() ?? undefined;
        this.session.tools.kindle.selectedModel =
          this.kindleState.selectedModel() ?? undefined;
      }
    });
  }

  ngOnInit(): void {
    this.sid = this.route.snapshot.queryParamMap.get("sid") ?? "";
    this.session = this.sid ? this.editorSession.getSession(this.sid) : null;
    this.returnUrl =
      this.session?.returnUrl ??
      this.route.snapshot.queryParamMap.get("returnUrl");

    this.sessionExit.setReturnUrl(this.returnUrl ?? null);

    this.kindleState.reset();

    if (!this.session?.file) return;

    if (this.session.initialState) {
      this.editorState.setState(this.session.initialState);
    }

    this.history.startSession();

    // Set session ID and tools configuration in UI state
    this.ui.setSessionId(this.sid);

    if (this.session.tools?.kindle) {
      this.kindleState.initFromTools(this.session.tools.kindle);
    }

    if (this.session.tools) {
      this.ui.setToolsConfig(this.session.tools);
    }

    this.objectUrl = URL.createObjectURL(this.session.file);
    this.imageUrl = this.objectUrl;

    this.aspectRatio = `${this.session.target.width} / ${this.session.target.height}`;
    const kindleTarget = this.kindleState.target();
    if (kindleTarget) {
      this.session.target = kindleTarget;
      this.aspectRatio = `${kindleTarget.width} / ${kindleTarget.height}`;
    }

    // Route detection
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateModeFromRoute();
      });

    // Initial route check
    this.updateModeFromRoute();
  }

  ngAfterViewInit(): void {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return;

    this.resizeObs = new ResizeObserver(() => this.tryReady());
    this.resizeObs.observe(frameEl);

    const capture = (id: number) => {
      if (this.capturedPointers.has(id)) return;
      try {
        frameEl.setPointerCapture(id);
        this.capturedPointers.add(id);
      } catch {}
    };

    const release = (id: number) => {
      if (!this.capturedPointers.has(id)) return;
      try {
        frameEl.releasePointerCapture(id);
      } catch {}
      this.capturedPointers.delete(id);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (this.colorSampler.active()) {
        if (!this.isPointerInPicker(e)) return;
        if (this.colorSampler.confirming()) {
          this.colorSampler.clearProposal();
        }
        this.samplingPointerId = e.pointerId;
        this.pickerDragOffset = this.getPickerDragOffset(e);
        this.lastSamplePos = null;
        this.isDraggingSample.set(true);
        capture(e.pointerId);
        this.updatePickerPositionFromPointer(e);
        e.preventDefault();
        return;
      }
      if (!this.gesturesEnabled) return;
      if (!this.ready) {
        e.preventDefault();
        return;
      }

      const wasEmpty = this.pointers.size === 0;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      capture(e.pointerId);

      if (wasEmpty) {
        this.history.onGestureStart();
      }

      if (this.pointers.size === 1) {
        this.gestureStart = {
          type: "pan",
          startScale: this.editorState.scale(),
          startTx: this.editorState.tx(),
          startTy: this.editorState.ty(),
          startDist: 0,
          startMid: { x: e.clientX, y: e.clientY },
        };
        e.preventDefault();
        return;
      }

      if (this.pointers.size >= 2) {
        const [a, b] = Array.from(this.pointers.values());
        this.gestureStart = {
          type: "pinch",
          startScale: this.editorState.scale(),
          startTx: this.editorState.tx(),
          startTy: this.editorState.ty(),
          startDist: this.distance(a, b),
          startMid: this.midpoint(a, b),
        };
        e.preventDefault();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (this.colorSampler.active()) {
        if (this.colorSampler.confirming()) {
          return;
        }
        if (this.samplingPointerId !== e.pointerId) return;
        if (!this.isDraggingSample()) {
          this.isDraggingSample.set(true);
        }
        this.updatePickerPositionFromPointer(e);
        e.preventDefault();
        return;
      }
      if (!this.gesturesEnabled || !this.ready) return;
      if (!this.pointers.has(e.pointerId)) return;

      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!this.gestureStart) return;

      if (this.pointers.size === 1 && this.gestureStart.type === "pan") {
        const p = this.pointers.values().next().value as Pt;
        const dx = p.x - this.gestureStart.startMid.x;
        const dy = p.y - this.gestureStart.startMid.y;

        this.history.setTranslation(
          this.gestureStart.startTx + dx,
          this.gestureStart.startTy + dy,
        );
        e.preventDefault();
        return;
      }

      if (this.pointers.size >= 2) {
        const [a, b] = Array.from(this.pointers.values());
        const mid = this.midpoint(a, b);
        const dist = this.distance(a, b);

        const ratio =
          this.gestureStart.startDist > 0
            ? dist / this.gestureStart.startDist
            : 1;

        this.history.setScale(this.gestureStart.startScale * ratio);

        const mdx = mid.x - this.gestureStart.startMid.x;
        const mdy = mid.y - this.gestureStart.startMid.y;

        this.history.setTranslation(
          this.gestureStart.startTx + mdx,
          this.gestureStart.startTy + mdy,
        );
        e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.colorSampler.active()) {
        if (this.samplingPointerId !== e.pointerId) return;
        this.samplingPointerId = null;
        this.pickerDragOffset = null;
        release(e.pointerId);
        this.isDraggingSample.set(false);
        if (!this.colorSampler.confirming()) {
          if (this.lastSamplePos) {
            this.sampleAt(this.lastSamplePos.x, this.lastSamplePos.y);
          }
          this.colorSampler.propose();
        }
        e.preventDefault();
        return;
      }
      if (this.pointers.has(e.pointerId)) {
        this.pointers.delete(e.pointerId);
      }
      release(e.pointerId);

      if (!this.gesturesEnabled) return;

      const isPointerUp = e.type === "pointerup";
      const isSingleRelease = this.pointers.size === 0;

      if (isPointerUp && isSingleRelease) {
        if (this.gestureStart?.type === "pinch") {
          this.lastTapAt = 0;
          this.lastTapPos = null;
        } else {
          const now = Date.now();
          const pos = { x: e.clientX, y: e.clientY };
          const withinTime = now - this.lastTapAt <= 280;
          const withinDist = this.lastTapPos
            ? this.distance(this.lastTapPos, pos) <= 24
            : false;

          if (withinTime && withinDist) {
            e.preventDefault();
            this.lastTapAt = 0;
            this.lastTapPos = null;
            this.cancelActivePointers();
            this.history.onGestureStart();
            this.history.resetViewToCover();
            this.history.onGestureEnd();
            return;
          }

          this.lastTapAt = now;
          this.lastTapPos = pos;
        }
      }

      if (this.pointers.size === 1) {
        const p = this.pointers.values().next().value as Pt;
        this.gestureStart = {
          type: "pan",
          startScale: this.editorState.scale(),
          startTx: this.editorState.tx(),
          startTy: this.editorState.ty(),
          startDist: 0,
          startMid: { x: p.x, y: p.y },
        };
      } else if (this.pointers.size >= 2) {
        const [a, b] = Array.from(this.pointers.values());
        this.gestureStart = {
          type: "pinch",
          startScale: this.editorState.scale(),
          startTx: this.editorState.tx(),
          startTy: this.editorState.ty(),
          startDist: this.distance(a, b),
          startMid: this.midpoint(a, b),
        };
      } else {
        this.endGesture();
      }

      e.preventDefault();
    };

    frameEl.addEventListener("pointerdown", onPointerDown, { passive: false });
    frameEl.addEventListener("pointermove", onPointerMove, { passive: false });
    frameEl.addEventListener("pointerup", onPointerUp, { passive: false });
    frameEl.addEventListener("pointercancel", onPointerUp, { passive: false });

    this.cleanupGestures = () => {
      frameEl.removeEventListener("pointerdown", onPointerDown as any);
      frameEl.removeEventListener("pointermove", onPointerMove as any);
      frameEl.removeEventListener("pointerup", onPointerUp as any);
      frameEl.removeEventListener("pointercancel", onPointerUp as any);
      this.cancelActivePointers();
    };

    this.updateCanvasGestures();
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.cleanupGestures?.();
    this.sessionExit.clearReturnUrl();
    this.colorSampler.stop();
  }

  private updateModeFromRoute(): void {
    const url = this.router.url;
    if (url.includes("/editor/tools")) {
      this.ui.setMode("tools");
    } else if (url.includes("/editor/adjustments")) {
      this.ui.setMode("adjustments");
    } else {
      this.ui.setMode("none");
    }
    this.updateCanvasGestures();
    this.updateConstraintsContext();
    this.updateHistoryMode();
  }

  private updateHistoryMode(): void {
    const mode = this.ui.activeMode();
    if (mode === "tools" || mode === "adjustments") {
      this.history.enterPanel(mode);
      return;
    }
    this.ui.closePanel();
    this.history.exitPanel();
  }

  cancel(): void {
    void this.sessionExit.cancelSession();
  }

  async done(): Promise<void> {
    if (this.isExporting) return;

    if (!this.ready || !this.session?.file) {
      this.sessionExit.exitAfterDone();
      return;
    }

    this.isExporting = true;
    const wasReady = this.ready;
    this.ready = false;
    let shouldExit = false;

    try {
      const state: CoverCropState = {
        ...this.editorState.getState(),
      };
      const frameEl = this.frameRef?.nativeElement;
      if (frameEl) {
        state.frameWidth = frameEl.clientWidth;
        state.frameHeight = frameEl.clientHeight;
      }
      const result: CropperResult = {
        file: this.session.file,
        state,
        formatId: this.session.tools?.formats?.selectedId,
      };
      this.editorSession.setResult(this.sid, result);
      shouldExit = true;
    } finally {
      this.isExporting = false;
      this.ready = wasReady;
      if (shouldExit) {
        this.sessionExit.exitAfterDone();
      }
    }
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }

  async discardPanel(): Promise<void> {
    if (this.history.mode() !== "local") return;
    const canExit = await this.panelExit.discardPanelIfNeeded();
    if (!canExit) return;
    this.router.navigate(["./"], { relativeTo: this.route });
  }

  applyPanel(): void {
    if (this.history.mode() !== "local") return;
    if (!this.history.isDirty()) return;

    const applied = this.history.applyPanel();
    if (!applied) return;

    this.ui.closePanel();
    this.router.navigate(["./"], { relativeTo: this.route });
  }

  private updateCanvasGestures(): void {
    const enabled = this.isToolsRouteActive();
    if (this.gesturesEnabled === enabled) return;
    this.gesturesEnabled = enabled;
    if (!enabled) {
      this.cancelActivePointers();
      this.lastTapAt = 0;
      this.lastTapPos = null;
    }
  }

  private isToolsRouteActive(): boolean {
    return this.router.url.includes("/editor/tools");
  }

  onResetPanel(): void {
    const reset = this.ui.activePanelReset();
    if (reset) {
      reset(this.history);
    }
  }

  openTools(): void {
    this.router.navigate(["tools"], { relativeTo: this.route });
  }

  openAdjustments(): void {
    this.router.navigate(["adjustments"], { relativeTo: this.route });
  }

  onBottomBarItemClick(id: string): void {
    switch (id) {
      case "tools":
        this.openTools();
        break;
      case "adjustments":
        this.openAdjustments();
        break;
    }
  }

  reset(): void {
    if (this.history.mode() !== "local") return;
    this.history.resetViewToCover();
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
  }

  onImgError(_: Event): void {
    // No-op
  }

  private tryReady(): void {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return;

    const w = frameEl.clientWidth;
    const h = frameEl.clientHeight;
    if (!this.imageLoaded || !this.naturalW || !this.naturalH) return;
    if (w <= 0 || h <= 0) return;

    // baseScale = COVER (no black by default), based on ROTATED natural
    const rn = this.getRotatedNaturalSize();
    const needW = w / rn.w;
    const needH = h / rn.h;
    this.baseScale = Math.max(needW, needH);

    if (!this.ready) this.ready = true;

    // Push ctx on every sizing/rotation change
    this.updateConstraintsContext();
    this.renderTransform();
    if (this.colorSampler.active()) {
      const currentPos = this.pickerPos();
      this.updatePickerMetrics();
      if (!currentPos) {
        this.centerPicker();
      } else {
        const clamped = this.clampPickerPos(currentPos);
        if (clamped.x !== currentPos.x || clamped.y !== currentPos.y) {
          this.pickerPos.set(clamped);
        }
      }
      void this.prepareSamplingCanvas();
    }
  }

  private getRotatedNaturalSize(): { w: number; h: number } {
    const r = (((this.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    if (r === 90 || r === 270) return { w: this.naturalH, h: this.naturalW };
    return { w: this.naturalW, h: this.naturalH };
  }

  private updateConstraintsContext(): void {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return;
    if (!this.imageLoaded || !this.naturalW || !this.naturalH) return;

    const w = frameEl.clientWidth;
    const h = frameEl.clientHeight;
    if (w <= 0 || h <= 0) return;

    this.editorState.setConstraintsContext({
      frameW: w,
      frameH: h,
      naturalW: this.naturalW, // IMPORTANT: UNROTATED real natural
      naturalH: this.naturalH, // IMPORTANT: UNROTATED real natural
      baseScale: this.baseScale,
      mode: this.isToolsRouteActive() ? "tools" : "other",
      virtualSquare: this.isToolsRouteActive(), // only in Tools we allow terrain rules
    });
    console.log("CTX_SET", {
      mode: this.isToolsRouteActive() ? "tools" : "other",
      frameW: w,
      frameH: h,
      naturalW: this.naturalW,
      naturalH: this.naturalH,
      baseScale: this.baseScale,
    });
  }

  private renderTransform(): void {
    const img = this.imgRef?.nativeElement;
    if (!img) return;

    const dispScale = this.baseScale * this.scale;
    const sx = this.flipX ? -1 : 1;
    const sy = this.flipY ? -1 : 1;
    img.style.transform =
      `translate(calc(-50% + ${this.tx}px), calc(-50% + ${this.ty}px)) ` +
      `rotate(${this.rot}deg) ` +
      `scale(${dispScale * sx}, ${dispScale * sy})`;
  }

  private async prepareSamplingCanvas(): Promise<void> {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl || !this.session?.target) return;

    const scale = frameEl.clientWidth / this.session.target.width;
    const canvas = await this.buildSamplingCanvas(scale);
    if (!canvas) return;
    this.samplingCanvas = canvas;
    this.samplingCtx = canvas.getContext("2d");
    const pos = this.pickerPos();
    if (pos) {
      this.sampleAt(pos.x, pos.y);
    }
  }

  private sampleAt(x: number, y: number): void {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl || !this.samplingCtx || !this.samplingCanvas) return;

    const fw = frameEl.clientWidth;
    const fh = frameEl.clientHeight;
    if (!fw || !fh) return;

    const tip = this.pickerTipOffset;
    const sampleX = this.clamp(x + tip.x, 0, fw);
    const sampleY = this.clamp(y + tip.y, 0, fh);
    const sx = Math.round(
      this.clamp(
        (sampleX / fw) * this.samplingCanvas.width,
        0,
        this.samplingCanvas.width - 1,
      ),
    );
    const sy = Math.round(
      this.clamp(
        (sampleY / fh) * this.samplingCanvas.height,
        0,
        this.samplingCanvas.height - 1,
      ),
    );
    const data = this.samplingCtx.getImageData(sx, sy, 1, 1).data;

    const rgba = {
      r: data[0],
      g: data[1],
      b: data[2],
      a: data[3] / 255,
    };

    this.colorSampler.setSample(rgba, { x: sampleX, y: sampleY });
  }

  private centerPicker(): void {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return;
    const fw = frameEl.clientWidth;
    const fh = frameEl.clientHeight;
    if (!fw || !fh) return;

    const next = this.clampPickerPos({ x: fw / 2, y: fh / 2 });
    this.pickerPos.set(next);
    this.lastSamplePos = next;
    this.sampleAt(next.x, next.y);
  }

  private updatePickerPositionFromPointer(e: PointerEvent): void {
    const point = this.pointerToFramePoint(e);
    if (!point) return;
    const offset = this.pickerDragOffset ?? { x: 0, y: 0 };
    const next = this.clampPickerPos({
      x: point.x - offset.x,
      y: point.y - offset.y,
    });
    this.pickerPos.set(next);
    this.lastSamplePos = next;
    this.sampleAt(next.x, next.y);
  }

  private pointerToFramePoint(e: PointerEvent): Pt | null {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return null;
    const rect = frameEl.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private isPointerInPicker(e: PointerEvent): boolean {
    const pos = this.pickerPos();
    if (!pos) return false;
    const point = this.pointerToFramePoint(e);
    if (!point) return false;
    const r = this.getPickerRadius();
    const dx = point.x - pos.x;
    const dy = point.y - pos.y;
    return Math.hypot(dx, dy) <= r;
  }

  private getPickerDragOffset(e: PointerEvent): Pt {
    const pos = this.pickerPos();
    const point = this.pointerToFramePoint(e);
    if (!pos || !point) return { x: 0, y: 0 };
    return { x: point.x - pos.x, y: point.y - pos.y };
  }

  private clampPickerPos(pos: Pt): Pt {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return pos;
    const fw = frameEl.clientWidth;
    const fh = frameEl.clientHeight;
    const tip = this.pickerTipOffset;

    return {
      x: this.clamp(pos.x, 0 - tip.x, fw - tip.x),
      y: this.clamp(pos.y, 0 - tip.y, fh - tip.y),
    };
  }

  private getPickerRadius(): number {
    const size = this.getPickerSize();
    return size / 2;
  }

  private getPickerSize(): number {
    const el = this.pickerRef?.nativeElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) return rect.width;
    }
    return DEFAULT_PICKER_SIZE;
  }

  private updatePickerMetrics(): void {
    const size = this.getPickerSize();
    const nextTip = {
      x: size * PICKER_TIP_RATIO_X,
      y: size * PICKER_TIP_RATIO_Y,
    };
    this.pickerTipOffset = nextTip;
    this.pickerTip.set(nextTip);
    if (this.colorSampler.active() && this.lastSamplePos) {
      this.sampleAt(this.lastSamplePos.x, this.lastSamplePos.y);
    }
  }

  confirmSample(): void {
    const proposed =
      this.colorSampler.proposedHex() ?? this.colorSampler.sampleHex();
    this.history.setBackground({ mode: "color", color: proposed });
    this.colorSampler.stop();
    this.isDraggingSample.set(false);
    this.ui.openPanel("tools", "fill");
  }

  cancelSample(): void {
    this.colorSampler.clearProposal();
    this.isDraggingSample.set(false);
  }


  private async buildSamplingCanvas(
    outputScale: number,
  ): Promise<HTMLCanvasElement | null> {
    if (!this.session?.file) return null;
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return null;

    return renderCompositionToCanvas(
      {
        file: this.session.file,
        target: this.session.target,
        frameWidth: frameEl.clientWidth,
        frameHeight: frameEl.clientHeight,
        baseScale: this.baseScale,
        naturalWidth: this.naturalW,
        naturalHeight: this.naturalH,
        state: this.editorState.getState(),
      },
      {
        mode: "preview",
        outputScale,
      },
    );
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private blurToPx(value: number): number {
    const clamped = this.clamp(value ?? 0, 0, 100);
    return (clamped / 100) * MAX_BG_BLUR_PX;
  }

  private endGesture(): void {
    if (!this.gestureStart) return;
    this.gestureStart = undefined;
    this.history.onGestureEnd();
  }

  private cancelActivePointers(): void {
    const frameEl = this.frameRef?.nativeElement;

    for (const id of this.capturedPointers) {
      try {
        frameEl?.releasePointerCapture(id);
      } catch {}
    }

    this.capturedPointers.clear();
    this.pointers.clear();

    if (this.gestureStart) {
      this.endGesture();
    }
  }

  private distance(a: Pt, b: Pt): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  private midpoint(a: Pt, b: Pt): Pt {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
}
