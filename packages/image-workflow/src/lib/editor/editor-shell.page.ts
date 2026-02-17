import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
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
import { TranslateService, TranslateModule } from "@ngx-translate/core";
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
import { NavController } from "@ionic/angular";
import { EditorPanelComponent } from "@sheldrapps/ui-theme";
import { addIcons } from "ionicons";
import {
  cropOutline,
  optionsOutline,
  returnUpBackOutline,
  returnUpForwardOutline,
  closeOutline,
  checkmarkOutline,
} from "ionicons/icons";
import { filter } from "rxjs";

import { EditorSessionService, EditorSession } from "./editor-session.service";
import { EditorUiStateService } from "./editor-ui-state.service";
import { EditorStateService } from "./editor-state.service";
import { buildCssFilter } from "./editor-adjustments";
import { renderCroppedFile } from "../core/pipeline/cropper-export";
import type { CropperResult } from "../types";

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
  readonly hintKey = computed(() =>
    this.ui.activeMode() === "tools"
      ? "EDITOR.SHELL.HINT.GESTURES"
      : "EDITOR.SHELL.HINT.PREVIEW",
  );
  private isExporting = false;

  // Top toolbox state (wired later)
  canUndo = false;
  canRedo = false;
  showDiscardApply = false;
  blockSessionDirty = false;

  // Minimal sizing state (kept here because shell owns the preview)
  private imageLoaded = false;
  private naturalW = 0;
  private naturalH = 0;
  private baseScale = 1;

  private scale = 1;
  private tx = 0;
  private ty = 0;
  private rot = 0;

  private resizeObs?: ResizeObserver;
  private gestureStart?: CanvasGestureStart;
  private gesturesEnabled = false;
  private readonly pointers = new Map<number, Pt>();
  private readonly capturedPointers = new Set<number>();
  private cleanupGestures?: () => void;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private editorSession: EditorSessionService,
    readonly ui: EditorUiStateService,
    private editorState: EditorStateService,
    private zone: NgZone,
    private translate: TranslateService,
  ) {
    addIcons({
      cropOutline,
      optionsOutline,
      returnUpBackOutline,
      returnUpForwardOutline,
      closeOutline,
      checkmarkOutline,
    });

    // Listen to EditorStateService changes and update preview
    effect(() => {
      this.scale = this.editorState.scale();
      this.tx = this.editorState.tx();
      this.ty = this.editorState.ty();
      this.rot = this.editorState.rot();
      this.renderTransform();
    });
  }

  ngOnInit(): void {
    this.sid = this.route.snapshot.queryParamMap.get("sid") ?? "";
    this.session = this.sid ? this.editorSession.getSession(this.sid) : null;
    this.returnUrl =
      this.session?.returnUrl ??
      this.route.snapshot.queryParamMap.get("returnUrl");

    if (!this.session?.file) return;

    // Set session ID and tools configuration in UI state
    this.ui.setSessionId(this.sid);

    if (this.session.tools) {
      this.ui.setToolsConfig(this.session.tools);
    }

    this.objectUrl = URL.createObjectURL(this.session.file);
    this.imageUrl = this.objectUrl;

    this.aspectRatio = `${this.session.target.width} / ${this.session.target.height}`;

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
      if (!this.gesturesEnabled) return;
      if (!this.ready) {
        e.preventDefault();
        return;
      }

      const wasEmpty = this.pointers.size === 0;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      capture(e.pointerId);

      if (wasEmpty) {
        this.editorState.onGestureStart();
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
      if (!this.gesturesEnabled || !this.ready) return;
      if (!this.pointers.has(e.pointerId)) return;

      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!this.gestureStart) return;

      if (this.pointers.size === 1 && this.gestureStart.type === "pan") {
        const p = this.pointers.values().next().value as Pt;
        const dx = p.x - this.gestureStart.startMid.x;
        const dy = p.y - this.gestureStart.startMid.y;

        this.editorState.setTranslation(
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

        this.editorState.setScale(this.gestureStart.startScale * ratio);

        const mdx = mid.x - this.gestureStart.startMid.x;
        const mdy = mid.y - this.gestureStart.startMid.y;

        this.editorState.setTranslation(
          this.gestureStart.startTx + mdx,
          this.gestureStart.startTy + mdy,
        );
        e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.pointers.has(e.pointerId)) {
        this.pointers.delete(e.pointerId);
      }
      release(e.pointerId);

      if (!this.gesturesEnabled) return;

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
    frameEl.addEventListener("pointercancel", onPointerUp, {
      passive: false,
    });

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
  }

  // Header actions
  cancel(): void {
    this.exitEditor("cancel");
  }

  async done(): Promise<void> {
    if (this.isExporting) return;

    if (!this.ready || !this.session?.file) {
      this.exitEditor("done");
      return;
    }

    this.isExporting = true;
    const wasReady = this.ready;
    this.ready = false;
    let shouldExit = false;

    try {
      const frameEl = this.frameRef?.nativeElement;
      if (!frameEl) return;

      const state = this.editorState.getState();
      const croppedFile = await renderCroppedFile({
        file: this.session.file,
        target: this.session.target,
        frameWidth: frameEl.clientWidth,
        frameHeight: frameEl.clientHeight,
        baseScale: this.baseScale,
        naturalWidth: this.naturalW,
        naturalHeight: this.naturalH,
        state,
      });

      if (croppedFile) {
        const result: CropperResult = {
          file: croppedFile,
          state,
          formatId: this.session.tools?.formats?.selectedId,
        };
        this.editorSession.setResult(this.sid, result);
        shouldExit = true;
      }
    } finally {
      this.isExporting = false;
      this.ready = wasReady;
      if (shouldExit) {
        this.exitEditor("done");
      }
    }
  }

  // Top toolbox (future wiring)
  undo(): void {}
  redo(): void {}
  discardBlockSession(): void {
    this.exitEditor("discard");
  }
  applyBlockSession(): void {
    this.exitEditor("apply");
  }

  private exitEditor(reason: "cancel" | "done" | "discard" | "apply"): void {
    const exitUrl = this.getExitUrl();
    this.navCtrl.navigateBack(exitUrl, { replaceUrl: true });
  }

  private getExitUrl(): string {
    const candidate = this.returnUrl ?? "";
    if (candidate.startsWith("/tabs/")) return candidate;
    return "/tabs/create";
  }

  private updateCanvasGestures(): void {
    const enabled = this.isToolsRouteActive();
    if (this.gesturesEnabled === enabled) return;
    this.gesturesEnabled = enabled;
    if (!enabled) {
      this.cancelActivePointers();
    }
  }

  private isToolsRouteActive(): boolean {
    return this.router.url.includes("/editor/tools");
  }

  // Panel actions
  onResetPanel(): void {
    const reset = this.ui.activePanelReset();
    if (reset) {
      reset(this.editorState);
    }
  }

  openTools(): void {
    this.router.navigate(["tools"], { relativeTo: this.route });
  }

  openAdjustments(): void {
    this.router.navigate(["adjustments"], { relativeTo: this.route });
  }

  // Handle bottom bar item selection
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

  // Preview logic
  reset(): void {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.rot = 0;
    this.tryReady();
    this.renderTransform();
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

    const rn = this.getRotatedNaturalSize();
    const needW = w / rn.w;
    const needH = h / rn.h;
    this.baseScale = Math.max(needW, needH);

    if (!this.ready) this.ready = true;
    this.renderTransform();
  }

  private getRotatedNaturalSize(): { w: number; h: number } {
    const r = (((this.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    if (r === 90 || r === 270) return { w: this.naturalH, h: this.naturalW };
    return { w: this.naturalW, h: this.naturalH };
  }

  private renderTransform(): void {
    const img = this.imgRef?.nativeElement;
    if (!img) return;

    const dispScale = this.baseScale * this.scale;
    img.style.transform =
      `translate(calc(-50% + ${this.tx}px), calc(-50% + ${this.ty}px)) ` +
      `rotate(${this.rot}deg) ` +
      `scale(${dispScale})`;
  }

  private endGesture(): void {
    if (!this.gestureStart) return;
    this.gestureStart = undefined;
    this.editorState.onGestureEnd();
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
