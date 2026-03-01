import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
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
import { TranslateModule, TranslateService } from "@ngx-translate/core";
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
import {
  EditorPanelComponent,
  ScrollableBarItem,
  ScrollableButtonBarComponent,
} from "@sheldrapps/ui-theme";
import { addIcons } from "ionicons";
import {
  cropOutline,
  optionsOutline,
  returnUpBackOutline,
  returnUpForwardOutline,
  closeOutline,
  checkmarkOutline,
  eyedropOutline,
  textOutline,
} from "ionicons/icons";
import { filter, merge } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { EditorSessionService, EditorSession } from "./editor-session.service";
import { EditorUiStateService } from "./editor-ui-state.service";
import { EditorStateService } from "./editor-state.service";
import { EditorHistoryService } from "./editor-history.service";
import { EditorPanelExitService } from "./editor-panel-exit.service";
import { EditorSessionExitService } from "./editor-session-exit.service";
import { EditorKindleStateService } from "./editor-kindle-state.service";
import { EditorColorSamplerService } from "./editor-color-sampler.service";
import { EditorTextEditService } from "./editor-text-edit.service";
import { buildCssFilter } from "./editor-adjustments";
import {
  renderCompositionToCanvas,
  measureTextLayer,
  type CompositionRenderInput,
} from "../core/pipeline/composition-render";
import type { CoverCropState, CropperResult } from "../types";
import { TextOverlayComponent } from "./components/text-overlay.component";

type Pt = { x: number; y: number };

type CanvasGestureStart = {
  type: "pan" | "pinch";
  startScale: number;
  startTx: number;
  startTy: number;
  startDist: number;
  startMid: Pt;
};

type ImageGuideState = {
  active: boolean;
  stageCenterX: number;
  stageCenterY: number;
  stageVActive: boolean;
  stageHActive: boolean;
};

type EditViewportLockState = {
  windowScrollX: number;
  windowScrollY: number;
  documentOverflow: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyLeft: string;
  bodyRight: string;
  scrollEl: HTMLElement | null;
  scrollTop: number;
  scrollOverflow: string;
  scrollOverscrollBehavior: string;
};

type EditShiftSnapshot = {
  windowScrollY: number;
  documentScrollTop: number | null;
  ionContentScrollTop: number | null;
  visualViewportHeight: number | null;
  visualViewportOffsetTop: number | null;
  frameTop: number | null;
  stageTop: number | null;
  activeTag: string | null;
  activeClass: string | null;
  activeRectTop: number | null;
  activeRectLeft: number | null;
  activeRectWidth: number | null;
  activeRectHeight: number | null;
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

type TopBarLabelSet = {
  undo: string;
  redo: string;
  discard: string;
  apply: string;
};

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
const PICKER_ICON_RATIO = 0.17;
const PICKER_TIP_RATIO_X = -PICKER_ICON_RATIO / 2;
const PICKER_TIP_RATIO_Y = PICKER_ICON_RATIO / 2;
const MAX_BG_BLUR_PX = 40;
const DEBUG_EDIT_VIEWPORT_LOCK = false;
const DEBUG_ANDROID_SHIFT_DETECTOR = true;
const EDIT_SHIFT_PROBE_EVENT = "__cc_text_edit_shift_probe__";

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
    ScrollableButtonBarComponent,
    TranslateModule,
    TextOverlayComponent,
  ],
  templateUrl: "./editor-shell.page.html",
  styleUrls: ["./editor-shell.page.scss"],
})
export class EditorShellPage implements OnInit, AfterViewInit, OnDestroy {
  uiLabels: EditorLabels = DEFAULT_LABELS;

  @ViewChild(IonContent) contentRef?: IonContent;
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
  readonly pickerConfirmPos = signal<Pt | null>(null);
  readonly imageGuides = signal<ImageGuideState>({
    active: false,
    stageCenterX: 0,
    stageCenterY: 0,
    stageVActive: false,
    stageHActive: false,
  });
  readonly hintKey = computed(() =>
    this.ui.activeMode() === "tools"
      ? "EDITOR.SHELL.HINT.GESTURES"
      : "EDITOR.SHELL.HINT.PREVIEW",
  );
  private isExporting = false;
  private readonly measureCanvas = document.createElement("canvas");
  private readonly measureCtx = this.measureCanvas.getContext("2d");

  readonly showDiscardApply = computed(() => this.history.mode() === "local");
  readonly showSessionActions = computed(
    () => this.history.mode() === "global",
  );
  private readonly topBarLabels = signal<TopBarLabelSet>({
    undo: "",
    redo: "",
    discard: "",
    apply: "",
  });
  readonly topBarItems = computed<ScrollableBarItem[]>(() => {
    const labels = this.topBarLabels();
    if (this.textEdit.isEditing()) {
      return [
        {
          id: "discard",
          label: labels.discard,
          icon: "close-outline",
        },
        {
          id: "apply",
          label: labels.apply,
          icon: "checkmark-outline",
        },
      ];
    }
    const items: ScrollableBarItem[] = [
      {
        id: "redo",
        label: labels.redo,
        icon: "return-up-forward-outline",
      },
      {
        id: "undo",
        label: labels.undo,
        icon: "return-up-back-outline",
      },
    ];

    if (this.showDiscardApply()) {
      items.push(
        {
          id: "discard",
          label: labels.discard,
          icon: "close-outline",
        },
        {
          id: "apply",
          label: labels.apply,
          icon: "checkmark-outline",
        },
      );
    }

    return items;
  });
  readonly topBarDisabledIds = computed(() => {
    if (this.textEdit.isEditing()) return [];
    const ids: string[] = [];
    if (!this.history.canUndo()) ids.push("undo");
    if (!this.history.canRedo()) ids.push("redo");
    if (this.showDiscardApply() && !this.history.isDirty()) ids.push("apply");
    return ids;
  });

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
  private cleanupViewportLock?: () => void;
  private editViewportLock: EditViewportLockState | null = null;
  private editViewportLockVersion = 0;
  private cleanupShiftDetector?: () => void;
  private editShiftDetectorVersion = 0;
  private lastEditShiftSnapshot: EditShiftSnapshot | null = null;
  private hasLoggedFirstShift = false;
  private readonly loggedShiftCallTags = new Set<string>();

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
    private textEdit: EditorTextEditService,
    private translate: TranslateService,
    private destroyRef: DestroyRef,
  ) {
    addIcons({
      cropOutline,
      optionsOutline,
      returnUpBackOutline,
      returnUpForwardOutline,
      closeOutline,
      checkmarkOutline,
      eyedropOutline,
      textOutline,
    });

    this.refreshTopBarLabels();
    merge(
      this.translate.onLangChange,
      this.translate.onTranslationChange,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshTopBarLabels());

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
        this.pickerConfirmPos.set(null);
        this.setImageGuidesInactive();
        return;
      }
      this.setImageGuidesInactive();
      if (!this.samplingWasActive) {
        this.samplingWasActive = true;
        this.centerPicker();
        this.updatePickerMetrics();
        requestAnimationFrame(() => this.updatePickerMetrics());
      }
      void this.prepareSamplingCanvas();
    });

    effect(() => {
      const panelId = this.ui.panelId();
      if (
        this.colorSampler.active() &&
        (panelId === "fill" || panelId === "text")
      ) {
        this.ui.closePanel();
      }
    });

    effect(() => {
      if (this.ui.activeMode() !== "text" && this.textEdit.isEditing()) {
        this.textEdit.discard();
      }
    });

    effect(() => {
      const isEditing = this.textEdit.isEditing();
      void this.syncEditViewportLock(isEditing);
    });

    effect(() => {
      const isEditing = this.textEdit.isEditing();
      void this.syncAndroidShiftDetector(isEditing);
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

    effect(() => {
      const tools = this.ui.toolsConfig();
      const formats = tools?.formats?.options ?? [];
      const hasKindleCatalog =
        !!tools?.kindle?.modelCatalog?.length || !!tools?.kindle?.groups?.length;
      if (!this.session || !formats.length || hasKindleCatalog) return;

      const selectedId = tools?.formats?.selectedId ?? formats[0]?.id;
      const selected =
        formats.find((format) => format.id === selectedId) ?? formats[0];
      if (!selected) return;

      this.session.target = {
        width: selected.target.width,
        height: selected.target.height,
      };
      this.aspectRatio = `${selected.target.width} / ${selected.target.height}`;

      if (this.session.tools?.formats) {
        this.session.tools.formats.selectedId = selected.id;
      }
    });
  }

  isEditingText(): boolean {
    return this.textEdit.isEditing();
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
      if (!this.isPointerOnImage(e)) {
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
        this.updateImageGuidesFromTxTy(
          this.gestureStart.startTx,
          this.gestureStart.startTy,
          e.pointerType,
        );
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
        this.setImageGuidesInactive();
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
        const nextTx = this.gestureStart.startTx + dx;
        const nextTy = this.gestureStart.startTy + dy;
        this.history.setTranslation(
          nextTx,
          nextTy,
        );
        this.updateImageGuidesFromTxTy(
          nextTx,
          nextTy,
          e.pointerType,
        );
        e.preventDefault();
        return;
      }

      if (this.pointers.size >= 2) {
        this.setImageGuidesInactive();
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

        if (this.gestureStart?.type === "pan") {
          const currentTx = this.editorState.tx();
          const currentTy = this.editorState.ty();
          const snapped = this.snapTranslationToCenter(
            currentTx,
            currentTy,
            e.pointerType,
          );
          if (snapped.tx !== currentTx || snapped.ty !== currentTy) {
            this.history.setTranslation(snapped.tx, snapped.ty);
          }
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
      if (this.pointers.size === 0) {
        this.setImageGuidesInactive();
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
    void this.syncEditViewportLock(this.textEdit.isEditing());
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.cleanupGestures?.();
    this.unlockEditViewportLock();
    this.stopAndroidShiftDetector();
    this.sessionExit.clearReturnUrl();
    this.colorSampler.stop();
  }

  private updateModeFromRoute(): void {
    const url = this.router.url;
    if (url.includes("/editor/tools")) {
      this.ui.setMode("tools");
    } else if (url.includes("/editor/adjustments")) {
      this.ui.setMode("adjustments");
    } else if (url.includes("/editor/text")) {
      this.ui.setMode("text");
    } else {
      this.ui.setMode("none");
    }
    this.updateCanvasGestures();
    this.updateConstraintsContext();
    this.updateHistoryMode();
  }

  private async syncEditViewportLock(isEditing: boolean): Promise<void> {
    const version = ++this.editViewportLockVersion;
    if (!this.shouldLockViewportDuringTextEdit()) {
      if (!isEditing) {
        this.unlockEditViewportLock();
      }
      return;
    }
    if (!isEditing) {
      this.unlockEditViewportLock();
      return;
    }
    await this.lockEditViewport(version);
  }

  private async syncAndroidShiftDetector(isEditing: boolean): Promise<void> {
    const version = ++this.editShiftDetectorVersion;
    if (!this.shouldRunAndroidShiftDetector()) {
      this.stopAndroidShiftDetector();
      return;
    }
    if (!isEditing) {
      this.stopAndroidShiftDetector();
      return;
    }
    await this.startAndroidShiftDetector(version);
  }

  private shouldLockViewportDuringTextEdit(): boolean {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }
    const cap = (globalThis as any).Capacitor;
    const platform =
      typeof cap?.getPlatform === "function" ? cap.getPlatform() : null;
    if (platform === "android") return true;
    return /Android/i.test(window.navigator?.userAgent ?? "");
  }

  private shouldRunAndroidShiftDetector(): boolean {
    return DEBUG_ANDROID_SHIFT_DETECTOR && this.shouldLockViewportDuringTextEdit();
  }

  private async lockEditViewport(version: number): Promise<void> {
    if (this.editViewportLock) {
      this.restoreLockedViewportPosition();
      return;
    }
    const scrollEl =
      (await this.contentRef?.getScrollElement().catch(() => null)) ?? null;
    if (
      version !== this.editViewportLockVersion ||
      !this.textEdit.isEditing() ||
      !this.shouldLockViewportDuringTextEdit()
    ) {
      return;
    }

    const docEl = document.documentElement;
    const body = document.body;
    this.editViewportLock = {
      windowScrollX: window.scrollX,
      windowScrollY: window.scrollY,
      documentOverflow: docEl.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      scrollEl,
      scrollTop: scrollEl?.scrollTop ?? 0,
      scrollOverflow: scrollEl?.style.overflow ?? "",
      scrollOverscrollBehavior: scrollEl?.style.overscrollBehavior ?? "",
    };

    docEl.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${this.editViewportLock.windowScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    if (scrollEl) {
      scrollEl.style.overflow = "hidden";
      scrollEl.style.overscrollBehavior = "none";
      scrollEl.scrollTop = this.editViewportLock.scrollTop;
    }

    this.installViewportLockListeners();
    this.restoreLockedViewportPosition();
    void this.logEditViewportDiagnostics("[EDIT_VIEWPORT_LOCK]");
    requestAnimationFrame(() => {
      if (
        version !== this.editViewportLockVersion ||
        !this.editViewportLock ||
        !this.textEdit.isEditing()
      ) {
        return;
      }
      this.restoreLockedViewportPosition();
      void this.logEditViewportDiagnostics("[EDIT_VIEWPORT_LOCK_RAF1]");
    });
  }

  private async startAndroidShiftDetector(version: number): Promise<void> {
    if (this.cleanupShiftDetector) return;
    const scrollEl =
      (await this.contentRef?.getScrollElement().catch(() => null)) ?? null;
    if (
      version !== this.editShiftDetectorVersion ||
      !this.textEdit.isEditing() ||
      !this.shouldRunAndroidShiftDetector()
    ) {
      return;
    }

    this.lastEditShiftSnapshot = this.captureEditShiftSnapshot(scrollEl);
    this.hasLoggedFirstShift = false;
    this.loggedShiftCallTags.clear();

    const patchCleanups: Array<() => void> = [];
    const listeners: Array<() => void> = [];
    const owner = this;
    const capture = (reason: string) => this.logEditShiftDiff(reason, scrollEl);
    const captureWithRafs = (reason: string) => {
      capture(reason);
      requestAnimationFrame(() => {
        if (!this.textEdit.isEditing()) return;
        capture(`${reason}:raf1`);
        requestAnimationFrame(() => {
          if (!this.textEdit.isEditing()) return;
          capture(`${reason}:raf2`);
        });
      });
    };

    const addListener = (
      target: EventTarget | null | undefined,
      type: string,
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
    ) => {
      if (!target) return;
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };

    const patchFn = <T extends object, K extends keyof T>(
      obj: T,
      key: K,
      wrap: (orig: any) => any,
    ) => {
      const orig = (obj as any)[key];
      if (typeof orig !== "function") return;
      (obj as any)[key] = wrap(orig);
      patchCleanups.push(() => {
        (obj as any)[key] = orig;
      });
    };

    const logCall = (tag: string, extra?: unknown) => {
      if (this.loggedShiftCallTags.has(tag)) return;
      this.loggedShiftCallTags.add(tag);
      console.warn(tag, extra ?? "", new Error().stack);
      captureWithRafs(`${tag}:after`);
    };

    patchFn(window as Window & typeof globalThis, "scrollTo", (orig) =>
      (...args: any[]) => {
        logCall("[SHIFT] window.scrollTo", args);
        return orig.apply(window, args);
      },
    );
    patchFn(window as Window & typeof globalThis, "scrollBy", (orig) =>
      (...args: any[]) => {
        logCall("[SHIFT] window.scrollBy", args);
        return orig.apply(window, args);
      },
    );
    patchFn(Element.prototype as Element, "scrollIntoView", (orig) =>
      function (this: Element, ...args: any[]) {
        logCall("[SHIFT] scrollIntoView", {
          el: owner.describeShiftElement(this),
          args,
        });
        return orig.apply(this, args);
      },
    );
    patchFn(Element.prototype as any, "scrollTo", (orig) =>
      function (this: Element, ...args: any[]) {
        logCall("[SHIFT] element.scrollTo", {
          el: owner.describeShiftElement(this),
          args,
        });
        return orig.apply(this, args);
      },
    );
    patchFn(Element.prototype as any, "scrollBy", (orig) =>
      function (this: Element, ...args: any[]) {
        logCall("[SHIFT] element.scrollBy", {
          el: owner.describeShiftElement(this),
          args,
        });
        return orig.apply(this, args);
      },
    );

    const scrollTopProto =
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop") ??
      Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    if (scrollTopProto?.get && scrollTopProto.set) {
      const targetProto = Object.prototype.hasOwnProperty.call(
        HTMLElement.prototype,
        "scrollTop",
      )
        ? HTMLElement.prototype
        : Element.prototype;
      try {
        Object.defineProperty(targetProto, "scrollTop", {
          configurable: true,
          enumerable: scrollTopProto.enumerable ?? false,
          get: scrollTopProto.get,
          set(this: Element, value: number) {
            logCall("[SHIFT] scrollTop=", {
              el: owner.describeShiftElement(this),
              value,
            });
            scrollTopProto.set!.call(this, value);
          },
        });
        patchCleanups.push(() =>
          Object.defineProperty(targetProto, "scrollTop", scrollTopProto),
        );
      } catch {
        // ignore descriptor patch failures on OEM WebViews
      }
    }

    const onProbe = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string }>).detail;
      captureWithRafs(detail?.label ?? EDIT_SHIFT_PROBE_EVENT);
    };

    addListener(window, "scroll", () => capture("window:scroll"), {
      passive: true,
    });
    addListener(scrollEl, "scroll", () => capture("ion-content:scroll"), {
      passive: true,
    });
    addListener(window.visualViewport, "resize", () =>
      capture("visualViewport:resize"),
    );
    addListener(window.visualViewport, "scroll", () =>
      capture("visualViewport:scroll"),
    );
    addListener(window, EDIT_SHIFT_PROBE_EVENT, onProbe as EventListener);

    captureWithRafs("shift-detector:start");

    this.cleanupShiftDetector = () => {
      for (const cleanup of listeners.splice(0)) cleanup();
      for (const cleanup of patchCleanups.splice(0)) cleanup();
      this.cleanupShiftDetector = undefined;
      this.lastEditShiftSnapshot = null;
      this.hasLoggedFirstShift = false;
      this.loggedShiftCallTags.clear();
    };
  }

  private installViewportLockListeners(): void {
    this.cleanupViewportLock?.();
    const restore = () => this.restoreLockedViewportPosition();
    window.addEventListener("scroll", restore, { passive: true });
    window.visualViewport?.addEventListener("resize", restore);
    window.visualViewport?.addEventListener("scroll", restore);
    this.cleanupViewportLock = () => {
      window.removeEventListener("scroll", restore);
      window.visualViewport?.removeEventListener("resize", restore);
      window.visualViewport?.removeEventListener("scroll", restore);
      this.cleanupViewportLock = undefined;
    };
  }

  private restoreLockedViewportPosition(): void {
    const lock = this.editViewportLock;
    if (!lock) return;
    if (window.scrollX !== lock.windowScrollX || window.scrollY !== lock.windowScrollY) {
      window.scrollTo(lock.windowScrollX, lock.windowScrollY);
    }
    if (lock.scrollEl && lock.scrollEl.scrollTop !== lock.scrollTop) {
      lock.scrollEl.scrollTop = lock.scrollTop;
    }
    const desiredTop = `-${lock.windowScrollY}px`;
    if (document.body.style.top !== desiredTop) {
      document.body.style.top = desiredTop;
    }
  }

  private unlockEditViewportLock(): void {
    const lock = this.editViewportLock;
    this.cleanupViewportLock?.();
    if (!lock) return;

    document.documentElement.style.overflow = lock.documentOverflow;
    document.body.style.overflow = lock.bodyOverflow;
    document.body.style.position = lock.bodyPosition;
    document.body.style.top = lock.bodyTop;
    document.body.style.width = lock.bodyWidth;
    document.body.style.left = lock.bodyLeft;
    document.body.style.right = lock.bodyRight;

    if (lock.scrollEl) {
      lock.scrollEl.style.overflow = lock.scrollOverflow;
      lock.scrollEl.style.overscrollBehavior = lock.scrollOverscrollBehavior;
      lock.scrollEl.scrollTop = lock.scrollTop;
    }

    this.editViewportLock = null;
    window.scrollTo(lock.windowScrollX, lock.windowScrollY);
    void this.logEditViewportDiagnostics("[EDIT_VIEWPORT_UNLOCK]");
  }

  private stopAndroidShiftDetector(): void {
    this.cleanupShiftDetector?.();
  }

  private logEditShiftDiff(reason: string, scrollEl: HTMLElement | null): void {
    const next = this.captureEditShiftSnapshot(scrollEl);
    const prev = this.lastEditShiftSnapshot;
    this.lastEditShiftSnapshot = next;
    if (!prev) return;
    const diff = this.diffEditShiftSnapshots(prev, next);
    if (!diff) return;
    if (!this.hasLoggedFirstShift) {
      this.hasLoggedFirstShift = true;
      console.warn("[SHIFT_DIFF]", {
        reason,
        diff,
        snapshot: next,
      });
    }
  }

  private captureEditShiftSnapshot(
    scrollEl: HTMLElement | null,
  ): EditShiftSnapshot {
    const vv = window.visualViewport;
    const frameRect = this.frameRef?.nativeElement?.getBoundingClientRect() ?? null;
    const stageRect =
      this.frameRef?.nativeElement?.closest(".stage")?.getBoundingClientRect() ?? null;
    const activeEl = document.activeElement instanceof Element
      ? document.activeElement
      : null;
    const activeRect =
      activeEl instanceof HTMLElement || activeEl instanceof SVGElement
        ? activeEl.getBoundingClientRect()
        : null;
    return {
      windowScrollY: window.scrollY,
      documentScrollTop: document.scrollingElement?.scrollTop ?? null,
      ionContentScrollTop: scrollEl?.scrollTop ?? null,
      visualViewportHeight: vv?.height ?? null,
      visualViewportOffsetTop: vv?.offsetTop ?? null,
      frameTop: frameRect ? Math.round(frameRect.top * 10) / 10 : null,
      stageTop: stageRect ? Math.round(stageRect.top * 10) / 10 : null,
      activeTag: activeEl?.tagName ?? null,
      activeClass:
        activeEl instanceof HTMLElement ? activeEl.className || null : null,
      activeRectTop: activeRect ? Math.round(activeRect.top * 10) / 10 : null,
      activeRectLeft: activeRect ? Math.round(activeRect.left * 10) / 10 : null,
      activeRectWidth: activeRect ? Math.round(activeRect.width * 10) / 10 : null,
      activeRectHeight: activeRect ? Math.round(activeRect.height * 10) / 10 : null,
    };
  }

  private diffEditShiftSnapshots(
    prev: EditShiftSnapshot,
    next: EditShiftSnapshot,
  ): Record<string, { from: unknown; to: unknown }> | null {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    const pushNumberDiff = (
      key: keyof EditShiftSnapshot,
      threshold: number,
    ) => {
      const from = prev[key];
      const to = next[key];
      if (typeof from !== "number" || typeof to !== "number") {
        if (from !== to) diff[String(key)] = { from, to };
        return;
      }
      if (Math.abs(from - to) > threshold) {
        diff[String(key)] = { from, to };
      }
    };
    pushNumberDiff("windowScrollY", 0.5);
    pushNumberDiff("documentScrollTop", 0.5);
    pushNumberDiff("ionContentScrollTop", 0.5);
    pushNumberDiff("visualViewportHeight", 0.5);
    pushNumberDiff("visualViewportOffsetTop", 0.5);
    pushNumberDiff("frameTop", 0.5);
    pushNumberDiff("stageTop", 0.5);
    pushNumberDiff("activeRectTop", 0.5);
    pushNumberDiff("activeRectLeft", 0.5);
    pushNumberDiff("activeRectWidth", 0.5);
    pushNumberDiff("activeRectHeight", 0.5);
    if (prev.activeTag !== next.activeTag) {
      diff["activeTag"] = { from: prev.activeTag, to: next.activeTag };
    }
    if (prev.activeClass !== next.activeClass) {
      diff["activeClass"] = { from: prev.activeClass, to: next.activeClass };
    }
    return Object.keys(diff).length ? diff : null;
  }

  private describeShiftElement(el: Element | null): {
    tagName: string | null;
    className: string | null;
    top: number | null;
    left: number | null;
    width: number | null;
    height: number | null;
  } {
    const rect =
      el instanceof HTMLElement || el instanceof SVGElement
        ? el.getBoundingClientRect()
        : null;
    return {
      tagName: el?.tagName ?? null,
      className: el instanceof HTMLElement ? el.className || null : null,
      top: rect ? Math.round(rect.top * 10) / 10 : null,
      left: rect ? Math.round(rect.left * 10) / 10 : null,
      width: rect ? Math.round(rect.width * 10) / 10 : null,
      height: rect ? Math.round(rect.height * 10) / 10 : null,
    };
  }

  private async logEditViewportDiagnostics(label: string): Promise<void> {
    if (!DEBUG_EDIT_VIEWPORT_LOCK) return;
    const scrollEl =
      this.editViewportLock?.scrollEl ??
      ((await this.contentRef?.getScrollElement().catch(() => null)) ?? null);
    const vv = window.visualViewport;
    const stageRect = this.frameRef?.nativeElement?.getBoundingClientRect() ?? null;
    console.warn(label, {
      editingId: this.textEdit.editingTextId(),
      windowScrollY: window.scrollY,
      ionContentScrollTop: scrollEl?.scrollTop ?? null,
      visualViewportHeight: vv?.height ?? null,
      visualViewportOffsetTop: vv?.offsetTop ?? null,
      stageTop: stageRect ? Math.round(stageRect.top * 10) / 10 : null,
    });
  }

  private updateHistoryMode(): void {
    const mode = this.ui.activeMode();
    if (mode === "tools" || mode === "adjustments" || mode === "text") {
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
      const ctx = this.editorState.constraintsContext();
      const frameSize = this.getFrameSize();
      const frameEl = this.frameRef?.nativeElement;
      const fw =
        (Number.isFinite(ctx?.frameW) ? ctx?.frameW : undefined) ??
        frameSize?.width ??
        frameEl?.clientWidth;
      const fh =
        (Number.isFinite(ctx?.frameH) ? ctx?.frameH : undefined) ??
        frameSize?.height ??
        frameEl?.clientHeight;
      if (fw && fh) {
        state.frameWidth = fw;
        state.frameHeight = fh;
      }
      const target = this.session.target;
      let renderedBlob: Blob | undefined;
      let renderedWidth: number | undefined;
      let renderedHeight: number | undefined;
      let renderedMimeType: string | undefined;

      const renderInput = this.buildRenderInput(state);
      if (renderInput) {
        const canvas = await renderCompositionToCanvas(renderInput, {
          mode: "export",
          outputScale: 1,
        });
        if (canvas) {
          const tryBlob = async (
            mimeType: string,
            quality?: number,
          ): Promise<Blob | null> =>
            new Promise((resolve) =>
              canvas.toBlob((bb) => resolve(bb), mimeType, quality),
            );

          const preferredMime = "image/png";
          const png = await tryBlob(preferredMime);
          if (png) {
            renderedBlob = png;
            renderedMimeType = preferredMime;
            renderedWidth = canvas.width;
            renderedHeight = canvas.height;
          } else {
            const jpegMime = "image/jpeg";
            const jpg = await tryBlob(jpegMime, 0.93);
            if (jpg) {
              renderedBlob = jpg;
              renderedMimeType = jpegMime;
              renderedWidth = canvas.width;
              renderedHeight = canvas.height;
            }
          }
        }
      }

      const result: CropperResult = {
        file: this.session.file,
        state,
        formatId: this.session.tools?.formats?.selectedId,
        renderedBlob,
        renderedWidth,
        renderedHeight,
        renderedMimeType,
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
    if (this.colorSampler.active()) {
      this.colorSampler.stop();
      this.isDraggingSample.set(false);
      this.pickerPos.set(null);
      this.pickerConfirmPos.set(null);
    }
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
      this.setImageGuidesInactive();
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

  openText(): void {
    this.router.navigate(["text"], { relativeTo: this.route });
  }

  onBottomBarItemClick(id: string): void {
    switch (id) {
      case "tools":
        this.openTools();
        break;
      case "adjustments":
        this.openAdjustments();
        break;
      case "text":
        this.openText();
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

    const frameSize = this.getFrameSize();
    const w = frameSize?.width ?? frameEl.clientWidth;
    const h = frameSize?.height ?? frameEl.clientHeight;
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
        this.updatePickerConfirmPosition(clamped);
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

    const frameSize = this.getFrameSize();
    const w = frameSize?.width ?? frameEl.clientWidth;
    const h = frameSize?.height ?? frameEl.clientHeight;
    if (w <= 0 || h <= 0) return;

    this.editorState.setConstraintsContext({
      frameW: w,
      frameH: h,
      naturalW: this.naturalW, // IMPORTANT: UNROTATED real natural
      naturalH: this.naturalH, // IMPORTANT: UNROTATED real natural
      baseScale: this.baseScale,
      mode: this.isToolsRouteActive() ? "tools" : "other",
      virtualSquare: false,
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

    const frameSize = this.getFrameSize();
    const fw = frameSize?.width ?? frameEl.clientWidth;
    const scale = fw / this.session.target.width;
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

    const frameSize = this.getFrameSize();
    const fw = frameSize?.width ?? frameEl.clientWidth;
    const fh = frameSize?.height ?? frameEl.clientHeight;
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
    this.updatePickerConfirmPosition(next);
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
    this.updatePickerConfirmPosition(next);
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
    this.updatePickerConfirmPosition();
    if (this.colorSampler.active() && this.lastSamplePos) {
      this.sampleAt(this.lastSamplePos.x, this.lastSamplePos.y);
    }
  }

  private updatePickerConfirmPosition(pos?: Pt | null): void {
    const frameEl = this.frameRef?.nativeElement;
    const nextPos = pos ?? this.pickerPos();
    if (!frameEl || !nextPos) {
      this.pickerConfirmPos.set(null);
      return;
    }
    const fw = frameEl.clientWidth;
    const fh = frameEl.clientHeight;
    if (!fw || !fh) {
      this.pickerConfirmPos.set(null);
      return;
    }

    const size = this.getPickerSize();
    const radius = size / 2;
    const gap = 12;
    const btnSize = 36;
    const btnGap = 8;
    const boxW = btnSize * 2 + btnGap;
    const boxH = btnSize;

    // Default: top-right of the picker
    let x = nextPos.x + radius + gap;
    let y = nextPos.y - radius - gap - boxH;

    // Reposition only if outside stage
    if (x + boxW > fw) {
      x = nextPos.x - radius - gap - boxW;
    }
    if (x < 0) {
      x = 0;
    }

    if (y < 0) {
      y = nextPos.y + radius + gap;
    }
    if (y + boxH > fh) {
      y = fh - boxH;
    }

    this.pickerConfirmPos.set({ x, y });
  }

  private updateImageGuidesFromTxTy(
    tx: number,
    ty: number,
    pointerType?: string,
  ): void {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return;
    const w = frameEl.clientWidth;
    const h = frameEl.clientHeight;
    if (!w || !h) return;
    const threshold = pointerType === "mouse" ? 6 : 10;
    this.imageGuides.set({
      active: true,
      stageCenterX: w / 2,
      stageCenterY: h / 2,
      stageVActive: Math.abs(tx) <= threshold,
      stageHActive: Math.abs(ty) <= threshold,
    });
  }

  private isPointerOnImage(e: PointerEvent): boolean {
    const img = this.imgRef?.nativeElement;
    if (!img) return false;
    const rect = img.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const x = e.clientX;
    const y = e.clientY;
    return (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
  }

  private snapTranslationToCenter(
    tx: number,
    ty: number,
    pointerType?: string,
  ): { tx: number; ty: number } {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return { tx, ty };
    const w = frameEl.clientWidth;
    const h = frameEl.clientHeight;
    if (!w || !h) return { tx, ty };
    const threshold = pointerType === "mouse" ? 6 : 10;
    const snappedTx = Math.abs(tx) <= threshold ? 0 : tx;
    const snappedTy = Math.abs(ty) <= threshold ? 0 : ty;
    return { tx: snappedTx, ty: snappedTy };
  }

  private setImageGuidesInactive(): void {
    this.imageGuides.set({
      active: false,
      stageCenterX: 0,
      stageCenterY: 0,
      stageVActive: false,
      stageHActive: false,
    });
  }

  confirmSample(): void {
    const proposed =
      this.colorSampler.proposedHex() ?? this.colorSampler.sampleHex();
    const target = this.colorSampler.target();
    const selectedId = this.textEdit.selectedTextId();
    if (target === "text-fill") {
      if (selectedId) {
        this.history.setTextFillColor(selectedId, proposed);
      }
    } else if (target === "text-stroke") {
      if (selectedId) {
        this.history.setTextStrokeColor(selectedId, proposed);
      }
    } else {
      this.history.setBackground({ mode: "color", color: proposed });
    }
    const returnPanel = this.colorSampler.returnPanel();
    this.colorSampler.stop();
    this.isDraggingSample.set(false);
    if (returnPanel) {
      this.ui.openPanel(returnPanel.mode, returnPanel.panelId);
    }
  }

  cancelSample(): void {
    this.colorSampler.clearProposal();
    this.isDraggingSample.set(false);
  }

  onTopBarItemClick(id: string): void {
    if (this.textEdit.isEditing()) {
      if (id === "apply") {
        this.textEdit.apply();
      } else if (id === "discard") {
        this.textEdit.discard();
      }
      return;
    }
    if (this.ui.activeMode() === "text" && this.textEdit.justExited()) {
      return;
    }
    switch (id) {
      case "undo":
        this.undo();
        break;
      case "redo":
        this.redo();
        break;
      case "discard":
        void this.discardPanel();
        break;
      case "apply":
        this.applyPanel();
        break;
      default:
        break;
    }
  }

  private async buildSamplingCanvas(
    outputScale: number,
  ): Promise<HTMLCanvasElement | null> {
    const input = this.buildRenderInput(this.editorState.getState());
    if (!input) return null;
    return renderCompositionToCanvas(input, {
      mode: "preview",
      outputScale,
    });
  }

  private buildRenderInput(state: CoverCropState): CompositionRenderInput | null {
    if (!this.session?.file || !this.session?.target) return null;
    const target = this.session.target;
    const ctx = this.editorState.constraintsContext();
    const frameSize = this.getFrameSize();
    const frameEl = this.frameRef?.nativeElement;
    const frameWidth =
      (Number.isFinite(state.frameWidth as number)
        ? (state.frameWidth as number)
        : undefined) ??
      (Number.isFinite(ctx?.frameW) ? ctx?.frameW : undefined) ??
      frameSize?.width ??
      frameEl?.clientWidth;
    const frameHeight =
      (Number.isFinite(state.frameHeight as number)
        ? (state.frameHeight as number)
        : undefined) ??
      (Number.isFinite(ctx?.frameH) ? ctx?.frameH : undefined) ??
      frameSize?.height ??
      frameEl?.clientHeight;
    if (!frameWidth || !frameHeight || !this.naturalW || !this.naturalH) {
      return null;
    }

    return {
      file: this.session.file,
      target: { width: target.width, height: target.height },
      frameWidth,
      frameHeight,
      baseScale: this.baseScale,
      naturalWidth: this.naturalW,
      naturalHeight: this.naturalH,
      state,
    };
  }

  private getFrameSize(): { width: number; height: number } | null {
    const frameEl = this.frameRef?.nativeElement;
    if (!frameEl) return null;
    const overlay =
      frameEl.querySelector<HTMLElement>(".text-overlay") ?? frameEl;
    const rect = overlay.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { width: rect.width, height: rect.height };
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

  private refreshTopBarLabels(): void {
    this.topBarLabels.set({
      undo: this.translate.instant(this.uiLabels.undoLabel),
      redo: this.translate.instant(this.uiLabels.redoLabel),
      discard: this.translate.instant(this.uiLabels.discardLabel),
      apply: this.translate.instant(this.uiLabels.applyLabel),
    });
  }
}
