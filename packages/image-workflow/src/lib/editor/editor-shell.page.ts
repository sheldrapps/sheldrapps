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
  isDevMode,
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

    // NOTE: no gestures here; panels will handle interactions later.
    // We only keep size recalculation here.
    this.zone.runOutsideAngular(() => {});
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
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
    if (isDevMode()) {
      // DEBUG: editor exit snapshot (remove after diagnosis)
      console.log("[editor-exit]", {
        reason,
        sid: this.sid,
        exitUrl,
        hasSession: !!this.session?.file,
      });
    }
    this.navCtrl.navigateBack(exitUrl, { replaceUrl: true });
  }

  private getExitUrl(): string {
    const candidate = this.returnUrl ?? "";
    if (candidate.startsWith("/tabs/")) return candidate;
    return "/tabs/create";
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
}
