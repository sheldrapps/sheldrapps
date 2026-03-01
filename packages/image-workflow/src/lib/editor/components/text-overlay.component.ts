import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import {
  closeOutline,
  resizeOutline,
  swapHorizontalOutline,
} from "ionicons/icons";
import { EditorStateService } from "../editor-state.service";
import { EditorHistoryService } from "../editor-history.service";
import { EditorUiStateService } from "../editor-ui-state.service";
import { EditorColorSamplerService } from "../editor-color-sampler.service";
import { EditorTextEditService } from "../editor-text-edit.service";
import type { TextLayer } from "../../types";

type Pt = { x: number; y: number };

type DragContext = {
  stageRect: DOMRect;
  stageWidth: number;
  stageHeight: number;
  dragId: string;
  dragSize: { width: number; height: number };
  otherGuidesX: number[];
  otherGuidesY: number[];
};

type GuideState = {
  draggingId: string | null;
  stageCenterX: number;
  stageCenterY: number;
  stageWidth: number;
  stageHeight: number;
  stageVActive: boolean;
  stageHActive: boolean;
  otherVLine: number | null;
  otherHLine: number | null;
};

type EditStageSnapshot = {
  frameW: number;
  frameH: number;
  overlayLeft: number;
  overlayTop: number;
  overlayWidth: number;
  overlayHeight: number;
  effectiveStageHeight: number;
  editableBoxHeight: number;
};

const TAP_MAX_DELAY = 280;
const TAP_MAX_DIST = 12;
const DEBUG_EDIT_DIAGNOSTICS = false;
const EDIT_SHIFT_PROBE_EVENT = "__cc_text_edit_shift_probe__";

@Component({
  selector: "cc-text-overlay",
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: "./text-overlay.component.html",
  styleUrls: ["./text-overlay.component.scss"],
})
export class TextOverlayComponent implements AfterViewInit, OnDestroy {
  private static readonly DEBUG_DISABLE_SELECTION_WHILE_EDITING = true;
  private static readonly DEBUG_EDIT_POSITION_LOGS = false;
  private static readonly STAGE_EDGE_PAD = 15;
  private static readonly HANDLE_PAD_RIGHT = 12;
  private static readonly EDIT_BOX_BOTTOM_PADDING = 100; // Increased safety margin
  private static readonly FONT_SIZE_MIN = 12;
  private static readonly FONT_SIZE_MIN_MANUAL = 6;
  private static readonly FONT_SIZE_MAX_MANUAL = 256;
  private static readonly MIN_WRAP_WIDTH = 24;
  private static readonly MIN_BOX_HEIGHT = 24;
  private static readonly SELECTION_MIN_HEIGHT = 44;
  private readonly state = inject(EditorStateService);
  private readonly history = inject(EditorHistoryService);
  private readonly ui = inject(EditorUiStateService);
  private readonly sampler = inject(EditorColorSamplerService);
  private readonly textEdit = inject(EditorTextEditService);
  private pendingMeasureRaf: number | null = null;
  private pendingSelectedRectRaf: number | null = null;
  private pendingMeasureAll = false;
  private readonly pendingMeasureIds = new Set<string>();
  private readonly lastAutoFitKeys = new Map<string, string>();
  private measurerEl: HTMLDivElement | null = null;
  private readonly onViewportResizeBound = () => this.scheduleMeasure();

  @ViewChild("overlay", { read: ElementRef })
  overlayRef?: ElementRef<HTMLElement>;

  readonly textLayers = computed(() => this.state.textLayers());
  readonly textViews = computed(() => {
    const ctx = this.state.constraintsContext();
    const layers = this.textLayers();
    if (!ctx || !layers.length) return [];
    const editingId = this.textEdit.editingTextId();
    const isEditingMode = this.textEdit.isEditing();
    const frameW =
      editingId && this.editStageSnapshot
        ? this.editStageSnapshot.frameW
        : ctx.frameW;
    const frameH =
      editingId && this.editStageSnapshot
        ? this.editStageSnapshot.frameH
        : ctx.frameH;
    return layers.map((layer) => {
      const isEditingActive = isEditingMode && editingId === layer.id;
      const displayWidth = this.computeDisplayWidth(
        layer,
        frameW,
        isEditingActive,
      );
      const displayHeight = this.computeDisplayHeight(layer);
      const defaultCenterX = layer.x * frameW;
      let x = defaultCenterX;
      let y = layer.y * frameH;
      if (isEditingActive) {
        x = this.computeEditingDisplayLeft(layer, defaultCenterX, displayWidth);
        y = this.computeEditingDisplayTop(layer, y, displayHeight);
      }
      return {
        layer,
        isEditingActive,
        x,
        y,
        autoMaxWidth: this.computeAutoMaxWidth(layer, frameW),
        contentMaxWidth: this.computeContentMaxWidth(layer, frameW),
        effectiveContentMaxWidth: this.computeEffectiveContentMaxWidth(
          layer,
          frameW,
        ),
        displayWidth,
        displayHeight,
      };
    });
  });
  readonly canInteract = computed(
    () => this.ui.activeMode() === "text" && !this.sampler.active(),
  );
  readonly draggingId = signal<string | null>(null);
  readonly resizingId = signal<string | null>(null);
  readonly selectedRect = signal<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  readonly redrawTick = signal(0);
  readonly guides = signal<GuideState>({
    draggingId: null,
    stageCenterX: 0,
    stageCenterY: 0,
    stageWidth: 0,
    stageHeight: 0,
    stageVActive: false,
    stageHActive: false,
    otherVLine: null,
    otherHLine: null,
  });
  private dragPointerId: number | null = null;
  private dragOffset: Pt | null = null;
  private dragContext: DragContext | null = null;
  private resizePointerId: number | null = null;
  private resizeStart: {
    pivotX: number;
    pivotY: number;
    startRadius: number;
    startFontSize: number;
  } | null = null;
  private resizeWidthPointerId: number | null = null;
  private resizeWidthStart: {
    startMaxWidth: number;
    startPointerX: number;
  } | null = null;
  private boxResizePointerId: number | null = null;
  private boxResizeStart: {
    startPointerX: number;
    startPointerY: number;
    startMaxWidth: number;
    startBoxHeight: number;
    startFontSize: number;
  } | null = null;
  private activeHandle: "none" | "swap" | "boxResize" | "expand" = "none";
  private readonly onResizeMoveBound = (e: PointerEvent) =>
    this.onResizeMove(e);
  private readonly onResizeEndBound = (e: PointerEvent) => this.onResizeEnd(e);
  private readonly onWidthResizeMoveBound = (e: PointerEvent) =>
    this.onWidthResizeMove(e);
  private readonly onWidthResizeEndBound = (e: PointerEvent) =>
    this.onWidthResizeEnd(e);
  private readonly onBoxResizeMoveBound = (e: PointerEvent) =>
    this.onBoxResizeMove(e);
  private readonly onBoxResizeEndBound = (e: PointerEvent) =>
    this.onBoxResizeEnd(e);
  private readonly onPinchPointerDownBound = (e: PointerEvent) =>
    this.onPinchPointerDown(e);
  private readonly onPinchPointerMoveBound = (e: PointerEvent) =>
    this.onPinchPointerMove(e);
  private readonly onPinchPointerUpBound = (e: PointerEvent) =>
    this.onPinchPointerUp(e);
  private pinchPointers = new Map<number, Pt>();
  private pinchStart: {
    id: string;
    startFontSize: number;
    startDist: number;
  } | null = null;

  private lastTapAt = 0;
  private lastTapPos: Pt | null = null;
  private lastTapId: string | null = null;
  private wasEditing = false;
  private lastFocusedEditingId: string | null = null;
  private lastEditDbg: {
    left: number;
    top: number;
    vvH: number;
    iH: number;
    tr: string;
  } | null = null;
  private editJumpLogged = false;
  private editAnchorRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null = null;
  private editStageSnapshot: EditStageSnapshot | null = null;
  private lastEnterEditTs = 0;
  private initialScrollY = 0;
  private initialScrollX = 0;
  private preventScrollBound = (e: Event) => this.preventAutoEditScroll(e);

  constructor() {
    addIcons({ closeOutline, resizeOutline, swapHorizontalOutline });

    effect(() => {
      const editingId = this.textEdit.editingTextId();
      if (!editingId) return;
      if (this.lastFocusedEditingId === editingId) return;
      this.lastFocusedEditingId = editingId;
      requestAnimationFrame(() => this.focusEditor(editingId));
    });

    effect(() => {
      const selectedId = this.textEdit.selectedTextId();
      const isEditing = this.textEdit.isEditing();
      const canInteract = this.canInteract();
      this.textLayers();

      if (!selectedId || !canInteract) {
        this.selectedRect.set(null);
        return;
      }

      if (
        isEditing &&
        TextOverlayComponent.DEBUG_DISABLE_SELECTION_WHILE_EDITING
      ) {
        this.selectedRect.set(null);
        return;
      }

      this.queueSelectedRectMeasure(selectedId);
    });

    effect(() => {
      this.textLayers();
      this.scheduleMeasure();
    });

    const fonts = (document as any)?.fonts as FontFaceSet | undefined;
    if (fonts?.ready) {
      fonts.ready.then(() => this.scheduleMeasure()).catch(() => null);
    }

    effect(() => {
      const isEditing = this.textEdit.isEditing();
      const selectedId = this.textEdit.selectedTextId();
      const mode = this.ui.activeMode();
      if (this.wasEditing && !isEditing) {
        this.editAnchorRect = null;
        this.editStageSnapshot = null;
        this.lastFocusedEditingId = null;
        this.lastEditDbg = null;
        this.editJumpLogged = false;
        if (mode === "text" && selectedId) {
          this.ui.openPanel("text", "text");
        }
      }
      this.wasEditing = isEditing;
    });

    effect(() => {
      const editingId = this.textEdit.editingTextId();
      const keyboardHeight = this.textEdit.keyboardHeightPx();
      if (!editingId) return;
      const overlay = this.overlayRef?.nativeElement;
      if (!overlay) return;
      requestAnimationFrame(() => {
        if (this.textEdit.editingTextId() !== editingId) return;
        const overlayRect = overlay.getBoundingClientRect();
        this.refreshEditStageSnapshotFromRect(overlayRect);
        this.scheduleMeasure(editingId);
      });
      void keyboardHeight;
    });
  }

  ngAfterViewInit(): void {
    this.ensureMeasurer();
    const overlay = this.overlayRef?.nativeElement;
    if (overlay) {
      overlay.addEventListener("pointerdown", this.onPinchPointerDownBound);
      overlay.addEventListener("pointerup", this.onPinchPointerUpBound);
      overlay.addEventListener("pointercancel", this.onPinchPointerUpBound);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.onViewportResizeBound);
      window.visualViewport?.addEventListener(
        "resize",
        this.onViewportResizeBound,
      );
      // Prevent scroll globally in AutoEdit mode
      window.addEventListener("scroll", this.preventScrollBound, {
        passive: false,
        capture: true,
      });
      document.addEventListener("scroll", this.preventScrollBound, {
        passive: false,
        capture: true,
      });
    }
  }

  ngOnDestroy(): void {
    if (this.pendingMeasureRaf !== null) {
      cancelAnimationFrame(this.pendingMeasureRaf);
      this.pendingMeasureRaf = null;
    }
    if (this.pendingSelectedRectRaf !== null) {
      cancelAnimationFrame(this.pendingSelectedRectRaf);
      this.pendingSelectedRectRaf = null;
    }
    const overlay = this.overlayRef?.nativeElement;
    if (overlay) {
      overlay.removeEventListener("pointerdown", this.onPinchPointerDownBound);
      overlay.removeEventListener("pointerup", this.onPinchPointerUpBound);
      overlay.removeEventListener("pointercancel", this.onPinchPointerUpBound);
    }
    this.resetPinchState();
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onViewportResizeBound);
      window.visualViewport?.removeEventListener(
        "resize",
        this.onViewportResizeBound,
      );
      window.removeEventListener("scroll", this.preventScrollBound, {
        capture: true,
      } as any);
      document.removeEventListener("scroll", this.preventScrollBound, {
        capture: true,
      } as any);
    }
    if (this.measurerEl?.parentElement) {
      this.measurerEl.parentElement.removeChild(this.measurerEl);
    }
    this.measurerEl = null;
  }

  onPointerDown(e: PointerEvent, id: string): void {
    if (!this.canInteract()) return;
    if (this.pinchStart) return;
    if (this.dragPointerId !== null) return;
    if (this.resizingId()) {
      if (this.resizePointerId || this.resizeWidthPointerId) return;
      this.resetResizeState();
    }
    const layer = this.findLayer(id);
    if (!layer) return;

    const now = performance.now();
    const tapPos = { x: e.clientX, y: e.clientY };
    const dt = now - this.lastTapAt;
    const close =
      !this.lastTapPos ||
      Math.hypot(tapPos.x - this.lastTapPos.x, tapPos.y - this.lastTapPos.y) <
        TAP_MAX_DIST;
    const sameId = this.lastTapId === id;

    this.selectTextLayer(id);

    if (dt < TAP_MAX_DELAY && close && sameId) {
      this.lastTapAt = 0;
      this.lastTapPos = null;
      this.lastTapId = null;
      this.enterEditMode(id);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    this.lastTapAt = now;
    this.lastTapPos = tapPos;
    this.lastTapId = id;

    if (this.textEdit.isEditing()) return;

    this.beginDrag(e, layer);
  }

  onDblClick(e: MouseEvent, id: string): void {
    if (!this.canInteract()) return;
    this.enterEditMode(id);
    e.preventDefault();
    e.stopPropagation();
  }

  onDraftInput(e: Event, id: string): void {
    const value = (e.target as HTMLTextAreaElement | null)?.value ?? "";
    const textarea = e.target as HTMLTextAreaElement;
    this.textEdit.updateDraft(id, value);
    this.emitShiftProbe("E3_DRAFT_INPUT", id);
    const layer = this.findLayer(id);
    if (layer?.autoFitLocked && !layer.userBoxTouched) {
      this.state.updateTextLayer(id, { autoFitLocked: false });
    }

    // Pre-fit shrink in AutoEdit mode to prevent overflow before RAF
    const editingId = this.textEdit.editingTextId();
    const isAutoEditMode = editingId === id && layer && !layer.userBoxTouched;
    if (isAutoEditMode) {
      const layerEl = textarea.closest<HTMLElement>("[data-text-id]");

      // FORCE 150px height on every input - critical for Android
      if (layerEl) {
        layerEl.style.height = "150px";
        layerEl.style.maxHeight = "150px";
        layerEl.style.minHeight = "150px";
        layerEl.style.overflow = "hidden";
      }
      textarea.style.height = "150px";
      textarea.style.maxHeight = "150px";
      textarea.style.minHeight = "150px";

      this.preFitShrinkWithDirectDOM(id, textarea);
    }

    this.scheduleMeasure(id);
    requestAnimationFrame(() => {
      this.emitShiftProbe("E4_DRAFT_INPUT_RAF1", id);
      requestAnimationFrame(() =>
        this.emitShiftProbe("E6_DRAFT_INPUT_RAF2", id),
      );
    });
  }

  applyEdit(): void {
    const editingId = this.textEdit.editingTextId();
    const layer = this.findLayer(editingId ?? "");
    const wasAutoEditMode = !!editingId && layer && !layer.userBoxTouched;
    const shouldFreezeAutoFit =
      !!editingId && this.activeHandle === "none" && !layer?.userBoxTouched;

    // Clean up inline styles applied during AutoEdit mode
    if (editingId) {
      this.cleanupAutoEditStyles(editingId);

      // CRITICAL: Reset boxHeightPx when exiting AutoEdit mode
      // This allows the text to grow freely during manual resize gestures
      if (wasAutoEditMode) {
        this.state.updateTextLayer(editingId, {
          boxHeightPx: undefined,
        });
      }
    }

    this.textEdit.apply();
    if (editingId && shouldFreezeAutoFit && this.findLayer(editingId)) {
      // Leaving AutoEditMode freezes the fitted font until the user edits again.
      this.state.updateTextLayer(editingId, { autoFitLocked: true });
    }
  }

  discardEdit(): void {
    const editingId = this.textEdit.editingTextId();
    // Clean up inline styles even when discarding
    if (editingId) {
      const layer = this.findLayer(editingId);
      const wasAutoEditMode = layer && !layer.userBoxTouched;

      this.cleanupAutoEditStyles(editingId);

      // Reset boxHeightPx when discarding from AutoEdit mode
      if (wasAutoEditMode) {
        this.state.updateTextLayer(editingId, {
          boxHeightPx: undefined,
        });
      }
    }
    this.textEdit.discard();
  }

  /**
   * Remove inline styles applied during AutoEdit mode to allow normal resizing
   */
  private cleanupAutoEditStyles(id: string): void {
    const overlay = this.overlayRef?.nativeElement;
    if (!overlay) return;

    const layerEl = overlay.querySelector<HTMLElement>(
      `[data-text-id="${id}"]`,
    );
    const textarea = overlay.querySelector<HTMLTextAreaElement>(
      `[data-editor-for="${id}"]`,
    );

    if (layerEl) {
      layerEl.style.height = "";
      layerEl.style.maxHeight = "";
      layerEl.style.minHeight = "";
      layerEl.style.overflow = "";
    }

    if (textarea) {
      textarea.style.height = "";
      textarea.style.maxHeight = "";
      textarea.style.minHeight = "";
    }
  }

  /**
   * Pre-fit shrink with direct DOM manipulation to prevent text overflow in AutoEdit mode.
   * SIMPLIFIED: Always use 150px hard limit, shrink immediately when text exceeds it.
   */
  private preFitShrinkWithDirectDOM(
    id: string,
    textarea: HTMLTextAreaElement,
  ): void {
    const layer = this.findLayer(id);
    if (!layer) return;

    const editingId = this.textEdit.editingTextId();
    const isAutoEditMode = editingId === layer.id && !layer.userBoxTouched;
    if (!isAutoEditMode) return;

    const draftText = this.textEdit.getDraft(id);
    const currentFont = Math.max(
      TextOverlayComponent.FONT_SIZE_MIN,
      Number(layer.fontSizePx) || TextOverlayComponent.FONT_SIZE_MIN,
    );

    const overlay = this.overlayRef?.nativeElement;
    const measurer = this.ensureMeasurer();

    if (overlay && measurer) {
      const contentEl = overlay.querySelector<HTMLElement>(
        `[data-text-id="${layer.id}"] .text-layer__content`,
      );

      if (contentEl) {
        // HARD LIMIT: Always use 150px as maximum height
        const AUTOEDIT_FIXED_HEIGHT = 150;

        // Measure current text
        const strokePx = this.syncMeasurerFrom(contentEl, measurer);
        const frozenEditMetrics = this.editStageSnapshot;
        const stageRect = overlay.getBoundingClientRect();
        const effectiveMaxWidth = this.computeEffectiveContentMaxWidth(
          layer,
          frozenEditMetrics?.overlayWidth ?? stageRect.width,
        );

        if (Number.isFinite(effectiveMaxWidth as number)) {
          measurer.style.maxWidth = `${Math.max(1, effectiveMaxWidth as number)}px`;
        } else {
          measurer.style.maxWidth = "none";
        }
        measurer.style.width = "auto";
        measurer.textContent = draftText || " ";

        const measuredHeight = Math.ceil(measurer.scrollHeight) + strokePx * 2;

        // Shrink if exceeds 60% of 150px (90px)
        if (measuredHeight > AUTOEDIT_FIXED_HEIGHT * 0.6) {
          const lineHeightPx = this.getLineHeightPx(contentEl, currentFont);
          const fitHeight = AUTOEDIT_FIXED_HEIGHT - Math.ceil(lineHeightPx);

          const manualFont = Math.max(
            TextOverlayComponent.FONT_SIZE_MIN,
            Number(layer.manualFontSizePx) || currentFont,
          );

          const targetFont = this.findLargestFittingFontSize({
            currentFont,
            manualFont,
            fitHeight,
            maxWidth: effectiveMaxWidth,
            measurer,
            text: draftText || " ",
            lineHeightPx,
            allowGrowth: false,
          });

          if (targetFont < currentFont) {
            // Apply immediately to DOM
            textarea.style.fontSize = `${targetFont}px`;
            const layerEl = textarea.closest<HTMLElement>("[data-text-id]");
            if (layerEl) {
              layerEl.style.fontSize = `${targetFont}px`;
            }
            // Update state
            this.state.updateTextLayer(layer.id, {
              fontSizePx: targetFont,
            });
          }
        }
      }
    }

    // Force scroll restoration
    if (typeof window !== "undefined") {
      window.scrollTo(this.initialScrollX, this.initialScrollY);
    }
  }

  /**
   * Prevent scroll during AutoEdit mode to keep stage fixed
   */
  private preventAutoEditScroll(e: Event): void {
    const editingId = this.textEdit.editingTextId();
    if (!editingId) return;

    const layer = this.findLayer(editingId);
    if (!layer || layer.userBoxTouched) return;

    // In AutoEdit mode, prevent all scroll attempts
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Force scroll back to initial position immediately
    if (typeof window !== "undefined") {
      // Use setTimeout 0 as fallback for browsers that need async restoration
      setTimeout(() => {
        window.scrollTo(this.initialScrollX, this.initialScrollY);
      }, 0);
      window.scrollTo(this.initialScrollX, this.initialScrollY);
    }
  }

  onEditorKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      this.applyEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.discardEdit();
    }
  }

  onEditorBlur(): void {
    if (DEBUG_EDIT_DIAGNOSTICS) {
      console.warn("[EDIT_BLUR]", {
        editingId: this.textEdit.editingTextId(),
        selectedId: this.textEdit.selectedTextId(),
        sinceEnterMs: Math.round(performance.now() - this.lastEnterEditTs),
      });
    }
    this.applyEdit();
  }

  onDeleteClick(e: Event, id: string | null): void {
    if (!this.canInteract()) return;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();

    if (this.textEdit.editingTextId() === id) {
      this.textEdit.discard();
    }

    const next = this.textLayers().filter((layer) => layer.id !== id);
    this.history.setTextLayers(next);

    if (this.textEdit.selectedTextId() === id) {
      this.textEdit.selectText(null);
    }

    this.selectedRect.set(null);
    this.lastAutoFitKeys.delete(id);
    this.draggingId.set(null);
    this.resetResizeState();
    this.clearGuides();
    this.ui.openPanel("text", "text");
  }

  selectedTextId(): string | null {
    return this.textEdit.selectedTextId();
  }

  onPointerMove(e: PointerEvent, id: string): void {
    if (this.resizePointerId || this.resizeWidthPointerId) return;
    if (this.dragPointerId !== e.pointerId) return;
    if (this.draggingId() !== id) return;
    const ctx = this.dragContext;
    if (!ctx) return;

    const point = this.pointerToOverlayPoint(e, ctx.stageRect);
    if (!point) return;

    const offset = this.dragOffset ?? { x: 0, y: 0 };
    let x = point.x - offset.x;
    let y = point.y - offset.y;

    x = this.clamp(x, 0, ctx.stageWidth);
    y = this.clamp(y, 0, ctx.stageHeight);

    const threshold = e.pointerType === "mouse" ? 6 : 10;
    const halfW = ctx.dragSize.width / 2;
    const halfH = ctx.dragSize.height / 2;
    const dragLinesX = [x - halfW, x, x + halfW];
    const dragLinesY = [y - halfH, y, y + halfH];

    let stageVActive = false;
    let stageHActive = false;
    let otherVLine: number | null = null;
    let otherHLine: number | null = null;

    const stageCenterX = ctx.stageWidth / 2;
    const stageCenterY = ctx.stageHeight / 2;
    const stageDeltaX = stageCenterX - x;
    const stageDeltaY = stageCenterY - y;
    const stageXMatch = Math.abs(stageDeltaX) <= threshold;
    const stageYMatch = Math.abs(stageDeltaY) <= threshold;

    const bestX = this.findBestGuideMatch(dragLinesX, ctx.otherGuidesX);
    if (
      stageXMatch &&
      (!bestX || Math.abs(stageDeltaX) <= Math.abs(bestX.delta))
    ) {
      x = stageCenterX;
      stageVActive = true;
    } else if (bestX && Math.abs(bestX.delta) <= threshold) {
      x += bestX.delta;
      otherVLine = bestX.guide;
    }

    const bestY = this.findBestGuideMatch(dragLinesY, ctx.otherGuidesY);
    if (
      stageYMatch &&
      (!bestY || Math.abs(stageDeltaY) <= Math.abs(bestY.delta))
    ) {
      y = stageCenterY;
      stageHActive = true;
    } else if (bestY && Math.abs(bestY.delta) <= threshold) {
      y += bestY.delta;
      otherHLine = bestY.guide;
    }

    x = this.clamp(x, 0, ctx.stageWidth);
    y = this.clamp(y, 0, ctx.stageHeight);

    this.guides.set({
      ...this.guides(),
      stageVActive,
      stageHActive,
      otherVLine,
      otherHLine,
    });

    const nx = ctx.stageWidth ? x / ctx.stageWidth : 0.5;
    const ny = ctx.stageHeight ? y / ctx.stageHeight : 0.5;
    this.history.setTextPosition(id, nx, ny);

    e.preventDefault();
    e.stopPropagation();
  }

  onPointerUp(e: PointerEvent, id: string): void {
    if (this.resizePointerId || this.resizeWidthPointerId) return;
    if (this.dragPointerId !== e.pointerId) return;
    if (this.draggingId() !== id) return;

    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    this.dragPointerId = null;
    this.dragOffset = null;
    this.dragContext = null;
    this.draggingId.set(null);
    this.clearGuides();
    this.history.onTextDragEnd(id);

    e.preventDefault();
    e.stopPropagation();
  }

  onResizeStart(e: PointerEvent): void {
    if (!this.canInteract()) return;
    if (this.boxResizePointerId) return;
    if (this.resizeWidthPointerId) {
      this.resetResizeState();
    }
    if (this.pinchStart) {
      this.endPinch();
    }
    const id = this.textEdit.selectedTextId();
    if (!id) return;
    const layer = this.findLayer(id);
    if (!layer) return;
    const overlay = this.overlayRef?.nativeElement;
    const selectedEl = overlay?.querySelector<HTMLElement>(
      `[data-text-id="${id}"]`,
    );
    let pivotX = e.clientX;
    let pivotY = e.clientY;
    if (selectedEl) {
      const rect = selectedEl.getBoundingClientRect();
      pivotX = rect.left + rect.width / 2;
      pivotY = rect.top + rect.height / 2;
    }
    let startRadius = Math.hypot(e.clientX - pivotX, e.clientY - pivotY);
    if (startRadius < 12) startRadius = 12;

    this.resizePointerId = e.pointerId;
    this.resizingId.set(id);
    this.activeHandle = "expand";
    this.resizeStart = {
      pivotX,
      pivotY,
      startRadius,
      startFontSize: Math.max(
        TextOverlayComponent.FONT_SIZE_MIN_MANUAL,
        Number(layer.fontSizePx) || TextOverlayComponent.FONT_SIZE_MIN_MANUAL,
      ),
    };
    this.dragPointerId = null;
    this.dragOffset = null;
    this.dragContext = null;
    this.draggingId.set(null);
    this.clearGuides();
    this.history.onSliderStart();

    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    window.addEventListener("pointermove", this.onResizeMoveBound);
    window.addEventListener("pointerup", this.onResizeEndBound);
    window.addEventListener("pointercancel", this.onResizeEndBound);

    e.preventDefault();
    e.stopPropagation();
  }

  onWidthResizeStart(e: PointerEvent): void {
    if (!this.canInteract()) return;
    if (this.resizePointerId) return;
    if (this.boxResizePointerId) return;
    if (this.pinchStart) {
      this.endPinch();
    }
    const id = this.textEdit.selectedTextId();
    if (!id) return;
    const rect = this.selectedRect();
    const layer = this.findLayer(id);
    if (!rect || !layer) return;

    const startMaxWidth = Number.isFinite(layer.maxWidthPx as number)
      ? (layer.maxWidthPx as number)
      : Math.max(TextOverlayComponent.MIN_WRAP_WIDTH, rect.w);
    if (!layer.userBoxTouched) {
      this.state.updateTextLayer(id, { userBoxTouched: true });
    }

    this.resizingId.set(id);
    this.activeHandle = "swap";
    this.resizeWidthPointerId = e.pointerId;
    this.resizeWidthStart = {
      startMaxWidth,
      startPointerX: e.clientX,
    };
    this.dragPointerId = null;
    this.dragOffset = null;
    this.dragContext = null;
    this.draggingId.set(null);
    this.clearGuides();
    this.history.onSliderStart();

    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    e.preventDefault();
    e.stopPropagation();
  }

  onBoxResizeStart(e: PointerEvent): void {
    if (!this.canInteract()) return;
    if (this.resizePointerId || this.resizeWidthPointerId) return;
    if (this.pinchStart) {
      this.endPinch();
    }
    const id = this.textEdit.selectedTextId();
    if (!id) return;
    const layer = this.findLayer(id);
    if (!layer) return;
    const overlay = this.overlayRef?.nativeElement;
    const contentEl = overlay?.querySelector<HTMLElement>(
      `[data-text-id="${id}"] .text-layer__content`,
    );
    const contentRect = contentEl?.getBoundingClientRect();
    const stageWidth = overlay?.getBoundingClientRect().width || 0;
    const startMaxWidth = Number.isFinite(layer.maxWidthPx as number)
      ? (layer.maxWidthPx as number)
      : (this.computeEffectiveContentMaxWidth(layer, stageWidth) ??
        contentRect?.width ??
        TextOverlayComponent.MIN_WRAP_WIDTH);
    const startBoxHeight = Number.isFinite(layer.boxHeightPx as number)
      ? (layer.boxHeightPx as number)
      : (contentRect?.height ?? TextOverlayComponent.MIN_BOX_HEIGHT);
    const startFontSize = Math.max(
      TextOverlayComponent.FONT_SIZE_MIN,
      Number(layer.fontSizePx) || TextOverlayComponent.FONT_SIZE_MIN,
    );
    if (!layer.userBoxTouched) {
      this.state.updateTextLayer(id, { userBoxTouched: true });
    }

    this.boxResizePointerId = e.pointerId;
    this.resizingId.set(id);
    this.activeHandle = "boxResize";
    this.boxResizeStart = {
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startMaxWidth: Math.max(
        TextOverlayComponent.MIN_WRAP_WIDTH,
        startMaxWidth,
      ),
      startBoxHeight: Math.max(
        TextOverlayComponent.MIN_BOX_HEIGHT,
        startBoxHeight,
      ),
      startFontSize: startFontSize,
    };
    this.dragPointerId = null;
    this.dragOffset = null;
    this.dragContext = null;
    this.draggingId.set(null);
    this.clearGuides();
    this.history.onSliderStart();

    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    window.addEventListener("pointermove", this.onBoxResizeMoveBound);
    window.addEventListener("pointerup", this.onBoxResizeEndBound);
    window.addEventListener("pointercancel", this.onBoxResizeEndBound);

    e.preventDefault();
    e.stopPropagation();
  }

  onResizeMove(e: PointerEvent): void {
    if (!this.resizePointerId || this.resizePointerId !== e.pointerId) return;
    const start = this.resizeStart;
    if (!start) return;

    const currentRadiusRaw = Math.hypot(
      e.clientX - start.pivotX,
      e.clientY - start.pivotY,
    );
    const currentRadius = Math.max(4, currentRadiusRaw);
    const ratio = currentRadius / start.startRadius;
    const nextFont = start.startFontSize * ratio;
    this.applyTextFontSize(nextFont);

    e.preventDefault();
    e.stopPropagation();
  }

  onWidthResizeMove(e: PointerEvent): void {
    if (
      !this.resizeWidthPointerId ||
      this.resizeWidthPointerId !== e.pointerId
    ) {
      return;
    }
    const id = this.resizingId();
    if (!id) return;
    const start = this.resizeWidthStart;
    if (!start) return;

    const dx = e.clientX - start.startPointerX;
    const nextMaxWidth = Math.max(
      TextOverlayComponent.MIN_WRAP_WIDTH,
      Math.round(start.startMaxWidth + dx),
    );

    // Measure text height with new width to adjust box height automatically
    const layer = this.findLayer(id);
    let nextBoxHeight = TextOverlayComponent.MIN_BOX_HEIGHT;

    if (layer) {
      const overlay = this.overlayRef?.nativeElement;
      const measurer = this.ensureMeasurer();
      const contentEl = overlay?.querySelector<HTMLElement>(
        `[data-text-id="${id}"] .text-layer__content`,
      );

      if (contentEl && measurer) {
        const strokePx = this.syncMeasurerFrom(contentEl, measurer);
        const currentFont = Math.max(
          TextOverlayComponent.FONT_SIZE_MIN,
          Number(layer.fontSizePx) || TextOverlayComponent.FONT_SIZE_MIN,
        );
        const lineHeightPx = this.getLineHeightPx(contentEl, currentFont);

        // Measure text height with new width, keeping fontSize constant
        measurer.style.fontSize = `${currentFont}px`;
        measurer.style.lineHeight = `${Math.max(1, lineHeightPx)}px`;
        measurer.style.maxWidth = `${Math.max(1, nextMaxWidth)}px`;
        measurer.style.width = `${Math.max(1, nextMaxWidth)}px`;
        measurer.style.minWidth = `${Math.max(1, nextMaxWidth)}px`;
        measurer.textContent = layer.content || " ";

        const measuredHeight = Math.ceil(measurer.scrollHeight) + strokePx * 2;
        nextBoxHeight = Math.max(
          TextOverlayComponent.MIN_BOX_HEIGHT,
          measuredHeight,
        );
      }
    }

    // Update both width and height together
    this.history.setTextBoxSize(id, nextMaxWidth, nextBoxHeight, {
      autoFitLocked: true,
      userBoxTouched: true,
    });

    this.requestRedraw("swapMove");
    queueMicrotask(() => this.queueSelectedRectMeasure(id));

    e.preventDefault();
    e.stopPropagation();
  }

  onBoxResizeMove(e: PointerEvent): void {
    if (!this.boxResizePointerId || this.boxResizePointerId !== e.pointerId) {
      return;
    }
    const id = this.resizingId();
    if (!id) return;
    const start = this.boxResizeStart;
    if (!start) return;

    const dx = e.clientX - start.startPointerX;
    const dy = e.clientY - start.startPointerY;
    const nextMaxWidth = Math.max(
      TextOverlayComponent.MIN_WRAP_WIDTH,
      Math.round(start.startMaxWidth + dx),
    );
    const nextBoxHeight = Math.max(
      TextOverlayComponent.MIN_BOX_HEIGHT,
      Math.round(start.startBoxHeight + dy),
    );

    // Scale fontSize proportionally to boxHeight change (like slider behavior)
    const heightRatio = nextBoxHeight / start.startBoxHeight;
    let scaledFontSize = Math.max(
      TextOverlayComponent.FONT_SIZE_MIN,
      Math.min(
        TextOverlayComponent.FONT_SIZE_MAX_MANUAL,
        Math.round(start.startFontSize * heightRatio),
      ),
    );

    // Verify text fits within the new box height
    const layer = this.findLayer(id);
    if (layer) {
      const overlay = this.overlayRef?.nativeElement;
      const measurer = this.ensureMeasurer();
      const contentEl = overlay?.querySelector<HTMLElement>(
        `[data-text-id="${id}"] .text-layer__content`,
      );

      if (contentEl && measurer) {
        const strokePx = this.syncMeasurerFrom(contentEl, measurer);
        const lineHeightPx = this.getLineHeightPx(contentEl, scaledFontSize);
        // Fit height = available box height minus line height
        const fitHeight = nextBoxHeight - Math.ceil(lineHeightPx);

        // Check if scaled font size fits
        measurer.style.fontSize = `${scaledFontSize}px`;
        measurer.style.lineHeight = `${Math.max(1, lineHeightPx)}px`;
        measurer.style.maxWidth = `${Math.max(1, nextMaxWidth)}px`;
        measurer.style.width = `${Math.max(1, nextMaxWidth)}px`;
        measurer.style.minWidth = `${Math.max(1, nextMaxWidth)}px`;
        measurer.textContent = layer.content || " ";

        const measuredHeight = Math.ceil(measurer.scrollHeight) + strokePx * 2;

        // If text doesn't fit, reduce fontSize to fit
        if (measuredHeight > nextBoxHeight) {
          const manualFont = Math.max(
            TextOverlayComponent.FONT_SIZE_MIN,
            Number(layer.manualFontSizePx) || scaledFontSize,
          );

          scaledFontSize = this.findLargestFittingFontSize({
            currentFont: scaledFontSize,
            manualFont,
            fitHeight,
            maxWidth: nextMaxWidth,
            measurer,
            text: layer.content || " ",
            lineHeightPx,
            allowGrowth: true,
          });
        }
      }
    }

    this.history.setTextBoxSize(id, nextMaxWidth, nextBoxHeight, {
      autoFitLocked: true, // Lock autofit like slider does
      userBoxTouched: true,
    });

    // Update fontSize proportionally
    this.state.updateTextLayer(id, {
      fontSizePx: scaledFontSize,
      manualFontSizePx: scaledFontSize,
    });

    this.scheduleMeasure(id);
    this.requestRedraw("boxResizeMove");
    queueMicrotask(() => this.queueSelectedRectMeasure(id));

    e.preventDefault();
    e.stopPropagation();
  }

  onResizeEnd(e: PointerEvent): void {
    if (!this.resizePointerId || this.resizePointerId !== e.pointerId) return;

    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const id = this.resizingId();

    this.resizePointerId = null;
    this.resizeStart = null;
    this.activeHandle = "none";
    this.history.onSliderEnd();
    this.requestRedraw("gestureEnd");

    window.removeEventListener("pointermove", this.onResizeMoveBound);
    window.removeEventListener("pointerup", this.onResizeEndBound);
    window.removeEventListener("pointercancel", this.onResizeEndBound);

    // Standardized box redraw - clear resizingId after completion
    if (id) {
      this.finalizeResizeAndRedrawBox(id);
      // Clear resizingId after a delay to keep box hidden during recalculation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.resizingId.set(null);
          });
        });
      });
    } else {
      this.resizingId.set(null);
    }

    e.preventDefault();
    e.stopPropagation();
  }

  onWidthResizeEnd(e: PointerEvent): void {
    if (
      !this.resizeWidthPointerId ||
      this.resizeWidthPointerId !== e.pointerId
    ) {
      return;
    }

    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const id = this.resizingId();

    this.resizeWidthPointerId = null;
    this.resizeWidthStart = null;
    this.activeHandle = "none";
    this.history.onSliderEnd();
    this.requestRedraw("swapEnd");

    window.removeEventListener("pointermove", this.onWidthResizeMoveBound);
    window.removeEventListener("pointerup", this.onWidthResizeEndBound);
    window.removeEventListener("pointercancel", this.onWidthResizeEndBound);

    // Standardized box redraw - clear resizingId after completion
    if (id) {
      this.finalizeResizeAndRedrawBox(id);
      // Clear resizingId after a delay to keep box hidden during recalculation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.resizingId.set(null);
          });
        });
      });
    } else {
      this.resizingId.set(null);
    }
    window.removeEventListener("pointerup", this.onWidthResizeEndBound);
    window.removeEventListener("pointercancel", this.onWidthResizeEndBound);

    e.preventDefault();
    e.stopPropagation();
  }

  onBoxResizeEnd(e: PointerEvent): void {
    if (!this.boxResizePointerId || this.boxResizePointerId !== e.pointerId) {
      return;
    }

    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const id = this.resizingId();

    this.boxResizePointerId = null;
    this.boxResizeStart = null;
    this.activeHandle = "none";
    this.history.onSliderEnd();
    this.requestRedraw("boxResizeEnd");

    window.removeEventListener("pointermove", this.onBoxResizeMoveBound);
    window.removeEventListener("pointerup", this.onBoxResizeEndBound);
    window.removeEventListener("pointercancel", this.onBoxResizeEndBound);

    // Standardized box redraw - clear resizingId after completion
    if (id) {
      this.finalizeResizeAndRedrawBox(id);
      // Clear resizingId after a delay to keep box hidden during recalculation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.resizingId.set(null);
          });
        });
      });
    } else {
      this.resizingId.set(null);
    }
    window.removeEventListener("pointerup", this.onBoxResizeEndBound);
    window.removeEventListener("pointercancel", this.onBoxResizeEndBound);

    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Standardized box redraw after any resize gesture.
   * Recalculates box height based on actual text dimensions.
   */
  private finalizeResizeAndRedrawBox(id: string): void {
    this.scheduleMeasure(id);
    // Wait for measurement to complete, then adjust box height and update selectedRect
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Recalculate box height based on actual text height
        const layer = this.findLayer(id);
        if (layer) {
          const overlay = this.overlayRef?.nativeElement;
          const measurer = this.ensureMeasurer();
          const contentEl = overlay?.querySelector<HTMLElement>(
            `[data-text-id="${id}"] .text-layer__content`,
          );

          if (contentEl && measurer && overlay) {
            const strokePx = this.syncMeasurerFrom(contentEl, measurer);
            const currentFont = Math.max(
              TextOverlayComponent.FONT_SIZE_MIN,
              Number(layer.fontSizePx) || TextOverlayComponent.FONT_SIZE_MIN,
            );
            const lineHeightPx = this.getLineHeightPx(contentEl, currentFont);
            const stageRect = overlay.getBoundingClientRect();
            const stageWidth = stageRect.width || 0;

            // Use effective max width (respects both manual maxWidthPx and auto-calculated)
            const effectiveMaxWidth = this.computeEffectiveContentMaxWidth(
              layer,
              stageWidth,
            );
            const maxWidth =
              effectiveMaxWidth ?? TextOverlayComponent.MIN_WRAP_WIDTH;

            // Measure text with final fontSize
            measurer.style.fontSize = `${currentFont}px`;
            measurer.style.lineHeight = `${Math.max(1, lineHeightPx)}px`;
            measurer.style.maxWidth = `${Math.max(1, maxWidth)}px`;
            measurer.style.width = `${Math.max(1, maxWidth)}px`;
            measurer.style.minWidth = `${Math.max(1, maxWidth)}px`;
            measurer.textContent = layer.content || " ";

            const measuredHeight =
              Math.ceil(measurer.scrollHeight) + strokePx * 2;
            const finalBoxHeight = Math.max(
              TextOverlayComponent.MIN_BOX_HEIGHT,
              measuredHeight,
            );

            // Update box height to match actual text height
            this.state.updateTextLayer(id, {
              boxHeightPx: finalBoxHeight,
            });
          }
        }

        this.queueSelectedRectMeasure(id);
      });
    });
  }

  private onPinchPointerDown(e: PointerEvent): void {
    if (!this.canInteract()) return;
    if (this.resizePointerId || this.resizeWidthPointerId) return;
    if (this.pinchStart) return;
    const selectedId = this.textEdit.selectedTextId();
    if (!selectedId) return;
    if (!this.isPinchTarget(e.target, selectedId)) return;

    this.pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinchPointers.size !== 2) return;

    this.beginPinch(selectedId);
  }

  private onPinchPointerMove(e: PointerEvent): void {
    if (!this.pinchStart) return;
    if (!this.pinchPointers.has(e.pointerId)) return;
    this.pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinchPointers.size < 2) return;

    const points = Array.from(this.pinchPointers.values());
    const dist = Math.hypot(
      points[0].x - points[1].x,
      points[0].y - points[1].y,
    );
    const ratio =
      this.pinchStart.startDist > 0 ? dist / this.pinchStart.startDist : 1;
    const nextFont = this.pinchStart.startFontSize * ratio;
    this.applyTextFontSize(nextFont);

    e.preventDefault();
    e.stopPropagation();
  }

  private onPinchPointerUp(e: PointerEvent): void {
    if (this.pinchPointers.has(e.pointerId)) {
      this.pinchPointers.delete(e.pointerId);
    }
    if (!this.pinchStart) return;
    if (this.pinchPointers.size < 2) {
      this.endPinch();
    }
  }

  private beginPinch(id: string): void {
    const layer = this.findLayer(id);
    if (!layer) {
      this.pinchPointers.clear();
      return;
    }
    const points = Array.from(this.pinchPointers.values());
    if (points.length < 2) return;
    const startDist = Math.hypot(
      points[0].x - points[1].x,
      points[0].y - points[1].y,
    );
    this.pinchStart = {
      id,
      startFontSize: Math.max(
        TextOverlayComponent.FONT_SIZE_MIN_MANUAL,
        Number(layer.fontSizePx) || TextOverlayComponent.FONT_SIZE_MIN_MANUAL,
      ),
      startDist: startDist || 1,
    };
    this.resizingId.set(id);
    this.dragPointerId = null;
    this.dragOffset = null;
    this.dragContext = null;
    this.draggingId.set(null);
    this.clearGuides();
    this.history.onSliderStart();
    window.addEventListener("pointermove", this.onPinchPointerMoveBound);
    window.addEventListener("pointerup", this.onPinchPointerUpBound);
    window.addEventListener("pointercancel", this.onPinchPointerUpBound);
  }

  private endPinch(): void {
    if (this.pinchStart) {
      this.history.onSliderEnd();
      this.requestRedraw("gestureEnd");
    }
    this.resizingId.set(null);
    this.activeHandle = "none";
    this.resetPinchState();
  }

  private resetPinchState(): void {
    this.pinchStart = null;
    this.pinchPointers.clear();
    if (typeof window !== "undefined") {
      window.removeEventListener("pointermove", this.onPinchPointerMoveBound);
      window.removeEventListener("pointerup", this.onPinchPointerUpBound);
      window.removeEventListener("pointercancel", this.onPinchPointerUpBound);
    }
  }

  private isPinchTarget(
    target: EventTarget | null,
    selectedId: string,
  ): boolean {
    const overlay = this.overlayRef?.nativeElement;
    if (!overlay || !target || !(target instanceof Node)) return false;
    if (!overlay.contains(target)) return false;
    const selectedEl = overlay.querySelector<HTMLElement>(
      `[data-text-id="${selectedId}"]`,
    );
    if (selectedEl && selectedEl.contains(target)) return true;
    const handle = (target as HTMLElement).closest?.(".text-selection__handle");
    return !!handle;
  }

  isEditing(id: string): boolean {
    return this.textEdit.editingTextId() === id;
  }

  draftContent(id: string): string {
    return this.textEdit.getDraft(id);
  }

  private beginDrag(e: PointerEvent, layer: TextLayer): void {
    const overlay = this.overlayRef?.nativeElement;
    if (!overlay) return;
    if (this.pinchStart) {
      this.endPinch();
    }
    const rect = overlay.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const point = this.pointerToOverlayPoint(e, rect);
    if (!point) return;

    const center = {
      x: layer.x * rect.width,
      y: layer.y * rect.height,
    };

    this.dragPointerId = e.pointerId;
    this.dragOffset = { x: point.x - center.x, y: point.y - center.y };
    this.draggingId.set(layer.id);
    this.history.onTextDragStart(layer.id);

    this.dragContext = this.buildDragContext(layer.id, rect);
    this.guides.set({
      draggingId: layer.id,
      stageCenterX: rect.width / 2,
      stageCenterY: rect.height / 2,
      stageWidth: rect.width,
      stageHeight: rect.height,
      stageVActive: false,
      stageHActive: false,
      otherVLine: null,
      otherHLine: null,
    });

    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    e.preventDefault();
    e.stopPropagation();
  }

  private selectTextLayer(id: string): void {
    this.textEdit.selectText(id);
    if (!this.ui.isPanelOpen()) {
      this.ui.openPanel("text", "text");
    } else if (this.ui.panelMode() !== "text" || this.ui.panelId() !== "text") {
      this.ui.openPanel("text", "text");
    }
  }

  private enterEditMode(id: string): void {
    if (!this.canInteract()) return;
    const layer = this.findLayer(id);
    if (!layer) return;

    // Capture initial scroll position
    if (typeof window !== "undefined") {
      this.initialScrollY = window.scrollY || window.pageYOffset || 0;
      this.initialScrollX = window.scrollX || window.pageXOffset || 0;
    }

    this.captureEditAnchorRect(id);
    this.captureEditStageSnapshot();
    const overlayRect = this.overlayRef?.nativeElement?.getBoundingClientRect();
    const overlayWidth =
      overlayRect?.width ?? this.editStageSnapshot?.overlayWidth ?? 0;
    const overlayKeyboardOverlap = overlayRect
      ? this.computeKeyboardOverlap(overlayRect)
      : 0;
    const overlayVisibleHeight = overlayRect
      ? Math.max(1, overlayRect.height - overlayKeyboardOverlap)
      : 0;
    const hasMaxWidth = Number.isFinite(layer.maxWidthPx as number);
    const editableBoxWidth =
      !layer.userBoxTouched && !hasMaxWidth
        ? this.measureLayerContentWidth(
            id,
            this.computeEffectiveContentMaxWidth(layer, overlayWidth),
          )
        : null;
    const editableBoxHeight =
      !layer.userBoxTouched && overlayRect
        ? this.clampEditableBoxHeight(
            this.computeMaxEditableBoxHeight(overlayRect),
            overlayVisibleHeight || overlayRect.height,
          )
        : null;
    const currentBoxWidth = Number.isFinite(layer.boxWidthPx as number)
      ? Math.max(1, layer.boxWidthPx as number)
      : null;
    const currentBoxHeight = Number.isFinite(layer.boxHeightPx as number)
      ? Math.max(1, layer.boxHeightPx as number)
      : null;
    const nextEditBoxPatch: Partial<TextLayer> = {};
    if (
      editableBoxWidth &&
      (!currentBoxWidth || Math.abs(currentBoxWidth - editableBoxWidth) > 1)
    ) {
      nextEditBoxPatch.boxWidthPx = editableBoxWidth;
    }
    if (
      editableBoxHeight &&
      (!currentBoxHeight || currentBoxHeight < editableBoxHeight - 1)
    ) {
      nextEditBoxPatch.boxHeightPx = editableBoxHeight;
    }
    if (editableBoxWidth || editableBoxHeight) {
      nextEditBoxPatch.autoFitLocked = false;
    }
    if (Object.keys(nextEditBoxPatch).length > 0) {
      this.state.updateTextLayer(id, nextEditBoxPatch);
    }
    this.emitShiftProbe("E1_ENTER_EDIT", id);
    this.textEdit.enterEdit(id, layer.content ?? "");
    this.lastEnterEditTs = performance.now();
    this.logEditDiagnostics("[EDIT_ENTER]", id);
    if (DEBUG_EDIT_DIAGNOSTICS) {
      requestAnimationFrame(() =>
        this.logEditDiagnostics("[EDIT_ENTER_RAF1]", id),
      );
    }
    this.ui.closePanel();
    this.dragPointerId = null;
    this.dragOffset = null;
    this.dragContext = null;
    this.draggingId.set(null);
    this.resetResizeState();
    this.clearGuides();
    this.scheduleMeasure(id);
  }

  private queueSelectedRectMeasure(selectedId: string): void {
    if (this.pendingSelectedRectRaf !== null) {
      cancelAnimationFrame(this.pendingSelectedRectRaf);
    }
    this.pendingSelectedRectRaf = requestAnimationFrame(() => {
      this.pendingSelectedRectRaf = null;
      const overlay = this.overlayRef?.nativeElement;
      if (!overlay) return;
      if (this.textEdit.selectedTextId() !== selectedId) return;
      if (!this.canInteract()) {
        this.selectedRect.set(null);
        return;
      }

      const layerEl = overlay.querySelector<HTMLElement>(
        `[data-text-id="${selectedId}"]`,
      );
      const layer = this.findLayer(selectedId);
      if (!layerEl || !layer) {
        this.selectedRect.set(null);
        return;
      }
      const contentEl = this.resolveMeasureElement(layerEl);
      if (!contentEl) {
        this.selectedRect.set(null);
        return;
      }
      const isEditing = this.textEdit.editingTextId() === selectedId;
      const overlayRect = overlay.getBoundingClientRect();
      const liveHostRect = layerEl.getBoundingClientRect();
      if (isEditing && !this.editAnchorRect) {
        this.editAnchorRect = {
          left: liveHostRect.left,
          top: liveHostRect.top,
          width: liveHostRect.width,
          height: liveHostRect.height,
        };
      }
      const hostRect =
        isEditing && this.editAnchorRect
          ? this.editAnchorRect
          : {
              left: liveHostRect.left,
              top: liveHostRect.top,
              width: liveHostRect.width,
              height: liveHostRect.height,
            };
      const contentRect = contentEl.getBoundingClientRect();
      if (!hostRect.width || !hostRect.height) {
        this.selectedRect.set(null);
        return;
      }
      const stageWidth = overlayRect.width || 0;
      const useWrapRect = isEditing
        ? true
        : this.activeHandle === "boxResize" ||
          this.activeHandle === "swap" ||
          Number.isFinite(layer.maxWidthPx as number) ||
          !!layer.userBoxTouched;
      const wrapW = Number.isFinite(layer.maxWidthPx as number)
        ? (layer.maxWidthPx as number)
        : Number.isFinite(layer.boxWidthPx as number)
          ? (layer.boxWidthPx as number)
          : hostRect.width;
      const boxH = Number.isFinite(layer.boxHeightPx as number)
        ? (layer.boxHeightPx as number)
        : hostRect.height;
      let x = hostRect.left - overlayRect.left;
      let y = hostRect.top - overlayRect.top;
      const w = useWrapRect ? wrapW : contentRect.width;
      let h = useWrapRect ? boxH : contentRect.height;
      if (h < TextOverlayComponent.SELECTION_MIN_HEIGHT) {
        const centerY = y + h / 2;
        h = TextOverlayComponent.SELECTION_MIN_HEIGHT;
        y = centerY - h / 2;
      }
      this.selectedRect.set({ x, y, w, h });
    });
  }

  private scheduleMeasure(id?: string): void {
    if (id) {
      this.pendingMeasureIds.add(id);
    } else {
      this.pendingMeasureAll = true;
    }
    if (this.pendingMeasureRaf !== null) {
      cancelAnimationFrame(this.pendingMeasureRaf);
    }
    this.pendingMeasureRaf = requestAnimationFrame(() => {
      this.pendingMeasureRaf = null;
      const ids = this.pendingMeasureAll
        ? null
        : new Set(this.pendingMeasureIds);
      this.pendingMeasureAll = false;
      this.pendingMeasureIds.clear();
      this.measureTextBoxes(ids);
    });
  }

  private measureTextBoxes(targetIds: Set<string> | null): void {
    const layers = this.textLayers();
    const overlay = this.overlayRef?.nativeElement;
    const measurer = this.ensureMeasurer();
    if (!overlay || !measurer) return;
    const stageRect = overlay.getBoundingClientRect();
    const liveStageWidth = stageRect.width || 0;
    const liveStageHeight = stageRect.height || 0;
    const liveKeyboardOverlap = this.computeKeyboardOverlap(stageRect);
    const liveEffectiveStageHeight = Math.max(
      1,
      liveStageHeight - liveKeyboardOverlap,
    );
    const editingId = this.textEdit.editingTextId();
    const frozenEditMetrics = editingId ? this.editStageSnapshot : null;

    for (const layer of layers) {
      if (!layer) continue;
      if (targetIds && !targetIds.has(layer.id)) continue;

      const hasMaxWidth = Number.isFinite(layer.maxWidthPx as number);
      if (hasMaxWidth && Number.isFinite(layer.boxWidthPx as number)) {
        this.state.updateTextLayer(layer.id, {
          boxWidthPx: undefined,
        });
      }

      const contentEl = overlay.querySelector<HTMLElement>(
        `[data-text-id="${layer.id}"] .text-layer__content`,
      );
      const layerEl = overlay.querySelector<HTMLElement>(
        `[data-text-id="${layer.id}"]`,
      );
      if (editingId === layer.id && layerEl) {
        this.debugEditingLayerPosition(layer.id, layerEl);
      }
      if (!contentEl) continue;

      const strokePx = this.syncMeasurerFrom(contentEl, measurer);
      const isAutoEditMode = editingId === layer.id && !layer.userBoxTouched;
      const stageWidth = isAutoEditMode
        ? (frozenEditMetrics?.overlayWidth ?? liveStageWidth)
        : liveStageWidth;
      const stageHeight = isAutoEditMode
        ? (frozenEditMetrics?.overlayHeight ?? liveStageHeight)
        : liveStageHeight;
      const effectiveStageHeight = isAutoEditMode
        ? (frozenEditMetrics?.effectiveStageHeight ?? liveEffectiveStageHeight)
        : liveEffectiveStageHeight;
      const effectiveMaxWidth = this.computeEffectiveContentMaxWidth(
        layer,
        stageWidth,
      );
      const editableBoxHeight = isAutoEditMode
        ? (frozenEditMetrics?.editableBoxHeight ??
          this.clampEditableBoxHeight(
            this.computeMaxEditableBoxHeight(stageRect),
            effectiveStageHeight || stageHeight,
          ))
        : null;
      const currentBoxHeight = Number.isFinite(layer.boxHeightPx as number)
        ? Math.max(1, layer.boxHeightPx as number)
        : null;
      const activeBoxHeight = isAutoEditMode
        ? editableBoxHeight
        : currentBoxHeight;

      // Only update boxHeightPx in AutoEdit mode to enforce 150px limit
      // In normal mode, boxHeightPx should only be set by manual resize gestures
      if (
        isAutoEditMode &&
        editableBoxHeight &&
        (!currentBoxHeight ||
          Math.abs(currentBoxHeight - editableBoxHeight) > 1)
      ) {
        this.state.updateTextLayer(layer.id, {
          boxHeightPx: editableBoxHeight,
          autoFitLocked: false,
        });
      }
      if (Number.isFinite(effectiveMaxWidth as number)) {
        measurer.style.maxWidth = `${Math.max(1, effectiveMaxWidth as number)}px`;
      } else {
        measurer.style.maxWidth = "none";
      }
      measurer.style.width = "auto";
      measurer.textContent = contentEl.textContent ?? " ";
      const rect = measurer.getBoundingClientRect();
      const measuredScrollW = Math.ceil(measurer.scrollWidth);
      const measuredScrollH = Math.ceil(measurer.scrollHeight);
      let nextW = Math.ceil(
        ((measuredScrollW > 0 ? measuredScrollW : rect.width) as number) +
          strokePx * 2,
      );
      let nextH = Math.ceil(
        ((measuredScrollH > 0 ? measuredScrollH : rect.height) as number) +
          strokePx * 2,
      );
      if (nextW <= 0 || nextH <= 0) continue;

      if (!layer.autoFitLocked) {
        const boxHeight = isAutoEditMode ? editableBoxHeight : activeBoxHeight;
        const autoMaxHeight = this.computeAutoMaxHeight(
          layer,
          stageHeight,
          effectiveStageHeight,
        );
        const currentFont = Math.max(
          TextOverlayComponent.FONT_SIZE_MIN,
          Number(layer.fontSizePx) || TextOverlayComponent.FONT_SIZE_MIN,
        );
        const lineHeightPx = this.getLineHeightPx(contentEl, currentFont);
        const fitHeightRaw = boxHeight ?? autoMaxHeight;
        const fitHeight =
          isAutoEditMode && fitHeightRaw
            ? Math.max(
                TextOverlayComponent.MIN_BOX_HEIGHT,
                fitHeightRaw - Math.ceil(lineHeightPx),
              )
            : fitHeightRaw;
        const manualFont = Math.max(
          TextOverlayComponent.FONT_SIZE_MIN,
          Number(layer.manualFontSizePx) || currentFont,
        );
        if (fitHeight) {
          const autoFitKey = this.buildAutoFitKey(
            layer,
            effectiveMaxWidth,
            fitHeight,
            contentEl.textContent ?? "",
            contentEl,
          );
          if (this.lastAutoFitKeys.get(layer.id) !== autoFitKey) {
            this.lastAutoFitKeys.set(layer.id, autoFitKey);
            const targetFont = this.findLargestFittingFontSize({
              currentFont,
              manualFont,
              fitHeight,
              maxWidth: effectiveMaxWidth,
              measurer,
              text: contentEl.textContent ?? " ",
              lineHeightPx,
              allowGrowth: !isAutoEditMode,
            });
            if (Math.abs(targetFont - currentFont) >= 0.5) {
              this.state.updateTextLayer(layer.id, {
                fontSizePx: targetFont,
              });
              this.scheduleMeasure(layer.id);
              continue;
            }
          }
        } else {
          this.lastAutoFitKeys.delete(layer.id);
        }
      } else {
        this.lastAutoFitKeys.delete(layer.id);
      }

      if (!hasMaxWidth) {
        if (isAutoEditMode) {
          const prevW = layer.boxWidthPx ?? null;
          const shouldUpdateW =
            !Number.isFinite(prevW as number) ||
            Math.abs((prevW as number) - nextW) > 1;

          if (shouldUpdateW) {
            this.state.updateTextLayer(layer.id, { boxWidthPx: nextW });
          }

          // CRITICAL: In AutoEdit mode, DO NOT update boxHeightPx
          // It must stay fixed at 150px to prevent layout shift
          continue;
        }

        // Normal mode: only update boxWidthPx, NOT boxHeightPx
        // boxHeightPx should only be updated via manual resize gestures
        const prevW = layer.boxWidthPx ?? null;
        const shouldUpdateW =
          !Number.isFinite(prevW as number) ||
          Math.abs((prevW as number) - nextW) > 1;

        if (shouldUpdateW) {
          this.state.updateTextLayer(layer.id, {
            boxWidthPx: nextW,
          });
        }
      } else {
        // hasMaxWidth = true case
        if (isAutoEditMode) {
          // CRITICAL: In AutoEdit mode, DO NOT update boxHeightPx
          // It must stay fixed at 150px
          continue;
        }
        // Normal mode: Do NOT auto-update boxHeightPx
        // It should only be updated via manual resize gestures
      }
    }
  }

  private ensureMeasurer(): HTMLDivElement | null {
    if (this.measurerEl) return this.measurerEl;
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.className = "text-measurer";
    Object.assign(el.style, {
      position: "fixed",
      left: "-99999px",
      top: "-99999px",
      visibility: "hidden",
      pointerEvents: "none",
      // Width measurements must hug the rendered text, not the available line box.
      display: "inline-block",
      boxSizing: "border-box",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
      width: "auto",
      maxWidth: "none",
      minWidth: "0",
      height: "auto",
      overflow: "visible",
      padding: "0",
      margin: "0",
      border: "0",
    });
    document.body.appendChild(el);
    this.measurerEl = el;
    return el;
  }

  private syncMeasurerFrom(
    source: HTMLElement,
    measurer: HTMLDivElement,
  ): number {
    const style = window.getComputedStyle(source);
    measurer.style.fontFamily = style.fontFamily;
    measurer.style.fontSize = style.fontSize;
    measurer.style.fontWeight = style.fontWeight;
    measurer.style.fontStyle = style.fontStyle;
    measurer.style.letterSpacing = style.letterSpacing;
    measurer.style.lineHeight = style.lineHeight;
    measurer.style.textAlign = style.textAlign;
    measurer.style.textTransform = style.textTransform;
    measurer.style.fontKerning = style.fontKerning;
    measurer.style.textShadow = style.textShadow;
    measurer.style.whiteSpace = style.whiteSpace;
    measurer.style.wordBreak = style.wordBreak;
    measurer.style.overflowWrap = style.overflowWrap;
    (measurer.style as any).webkitTextStrokeWidth =
      (style as any).webkitTextStrokeWidth ?? "0px";
    (measurer.style as any).webkitTextStrokeColor =
      (style as any).webkitTextStrokeColor ?? "transparent";
    // Keep the measurer shrink-wrapped so boxWidthPx tracks the actual text width.
    measurer.style.display = "inline-block";
    measurer.style.boxSizing = "border-box";
    measurer.style.maxWidth = "none";
    measurer.style.minWidth = "0";
    measurer.style.width = "auto";
    measurer.style.height = "auto";
    measurer.style.overflow = "visible";
    const strokePx = Number.parseFloat(
      ((style as any).webkitTextStrokeWidth as string) ?? "0",
    );
    return Number.isFinite(strokePx) ? strokePx : 0;
  }

  private getLineHeightPx(source: HTMLElement, currentFont: number): number {
    const lineHeight = window.getComputedStyle(source).lineHeight;
    const parsed = Number.parseFloat(lineHeight ?? "");
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return currentFont;
  }

  private buildAutoFitKey(
    layer: TextLayer,
    maxWidth: number | null,
    fitHeight: number,
    text: string,
    source: HTMLElement,
  ): string {
    const style = window.getComputedStyle(source);
    return [
      Math.round((maxWidth ?? 0) * 10) / 10,
      Math.round(fitHeight * 10) / 10,
      layer.fontFamily ?? "",
      style.fontWeight,
      style.lineHeight,
      style.letterSpacing,
      style.textTransform,
      style.textShadow,
      Math.round((Number(layer.strokeWidthPx) || 0) * 10) / 10,
      Math.round(
        (Number(layer.manualFontSizePx) || Number(layer.fontSizePx) || 0) * 10,
      ) / 10,
      text,
    ].join("|");
  }

  private findLargestFittingFontSize(opts: {
    currentFont: number;
    manualFont: number;
    fitHeight: number;
    maxWidth: number | null;
    measurer: HTMLDivElement;
    text: string;
    lineHeightPx: number;
    allowGrowth?: boolean;
  }): number {
    const minFont = TextOverlayComponent.FONT_SIZE_MIN;
    const maxFont = Math.max(
      minFont,
      opts.allowGrowth === false
        ? Math.min(opts.manualFont, opts.currentFont)
        : opts.manualFont,
    );
    const lineHeightRatio =
      opts.currentFont > 0 ? opts.lineHeightPx / opts.currentFont : 1;
    const fits = (fontSize: number): boolean => {
      opts.measurer.style.fontSize = `${fontSize}px`;
      opts.measurer.style.lineHeight = `${Math.max(1, fontSize * lineHeightRatio)}px`;
      if (Number.isFinite(opts.maxWidth as number)) {
        const widthPx = `${Math.max(1, opts.maxWidth as number)}px`;
        opts.measurer.style.width = widthPx;
        opts.measurer.style.minWidth = widthPx;
        opts.measurer.style.maxWidth = widthPx;
      } else {
        opts.measurer.style.width = "auto";
        opts.measurer.style.minWidth = "0";
        opts.measurer.style.maxWidth = "none";
      }
      opts.measurer.textContent = opts.text;
      const domHeight = opts.measurer.scrollHeight;
      return domHeight <= opts.fitHeight - 1;
    };

    // AutoEditMode may shrink to stay visible, but it must not grow back on delete.
    if (opts.allowGrowth === false && fits(opts.currentFont)) {
      return Math.max(minFont, opts.currentFont);
    }

    let low = minFont;
    let high = maxFont;
    let best = minFont;
    for (let i = 0; i < 12; i += 1) {
      const mid = (low + high) / 2;
      if (fits(mid)) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
      if (high - low < 0.5) break;
    }

    let candidate = this.clamp(Math.floor(best * 2) / 2, minFont, maxFont);
    for (let i = 0; i < 6; i += 1) {
      const nudged = candidate + 0.5;
      if (nudged > maxFont || !fits(nudged)) break;
      candidate = nudged;
    }

    return this.clamp(candidate, minFont, maxFont);
  }

  private isManualBox(layer: TextLayer): boolean {
    return (
      !!layer.autoFitLocked &&
      Number.isFinite(layer.maxWidthPx as number) &&
      Number.isFinite(layer.boxHeightPx as number)
    );
  }

  private computeAutoMaxWidth(
    layer: TextLayer,
    stageWidth: number,
  ): number | null {
    if (!stageWidth) return null;
    if (this.isManualBox(layer)) return null;
    const centerX = (layer.x ?? 0.5) * stageWidth;
    const leftSpace = Math.max(
      0,
      centerX - TextOverlayComponent.STAGE_EDGE_PAD,
    );
    const rightSpace = Math.max(
      0,
      stageWidth -
        centerX -
        TextOverlayComponent.STAGE_EDGE_PAD -
        TextOverlayComponent.HANDLE_PAD_RIGHT,
    );
    const half = Math.min(leftSpace, rightSpace);
    const maxWidth = Math.floor(half * 2);
    return Math.max(1, maxWidth);
  }

  private computeAutoMaxHeight(
    layer: TextLayer,
    stageHeight: number,
    effectiveStageHeight: number,
  ): number | null {
    if (!stageHeight) return null;
    const centerY = (layer.y ?? 0.5) * stageHeight;
    const topSpace = Math.max(0, centerY - TextOverlayComponent.STAGE_EDGE_PAD);
    const bottomSpace = Math.max(
      0,
      effectiveStageHeight - centerY - TextOverlayComponent.STAGE_EDGE_PAD,
    );
    const half = Math.min(topSpace, bottomSpace);
    const maxHeight = Math.floor(half * 2);
    return Math.max(1, maxHeight);
  }

  private computeKeyboardOverlap(stageRect: DOMRect): number {
    if (typeof window === "undefined") return 0;
    const keyboardTopY = this.resolveKeyboardTopY(stageRect);
    const overlap = stageRect.bottom - keyboardTopY;
    return overlap > 0 ? overlap : 0;
  }

  private computeMaxEditableBoxHeight(stageRect: DOMRect): number {
    // FIXED HEIGHT: 150px in AutoEdit mode
    // User can adjust manually after exiting edit mode if needed
    return 150;
  }

  private clampEditableBoxHeight(
    editableBoxHeightRaw: number,
    visibleStageHeight: number,
  ): number {
    return Math.max(
      TextOverlayComponent.MIN_BOX_HEIGHT,
      Math.min(
        Math.floor(editableBoxHeightRaw),
        Math.floor(visibleStageHeight),
      ),
    );
  }

  private resolveKeyboardTopY(stageRect: DOMRect): number {
    if (typeof window === "undefined") return stageRect.bottom;
    const vv = window.visualViewport;

    // En Android con visualViewport disponible, visualViewport.height ya excluye el teclado
    // NO mezclar con window.innerHeight que cambia cuando aparece el teclado
    if (vv) {
      const viewportBottom = (vv.offsetTop ?? 0) + vv.height;
      return Math.min(stageRect.bottom, viewportBottom);
    }

    // Fallback para navegadores sin visualViewport
    let keyboardTopY = window.innerHeight;
    const pluginKeyboardHeight = this.textEdit.keyboardHeightPx();
    if (Number.isFinite(pluginKeyboardHeight) && pluginKeyboardHeight > 0) {
      const pluginKeyboardTop = Math.max(
        0,
        window.innerHeight - pluginKeyboardHeight,
      );
      keyboardTopY = Math.min(keyboardTopY, pluginKeyboardTop);
    }
    return Math.min(stageRect.bottom, keyboardTopY);
  }

  private measureLayerContentWidth(
    id: string,
    maxWidth: number | null,
  ): number | null {
    const overlay = this.overlayRef?.nativeElement;
    const contentEl = overlay?.querySelector<HTMLElement>(
      `[data-text-id="${id}"] .text-layer__content`,
    );
    const measurer = this.ensureMeasurer();
    if (!contentEl || !measurer) return null;
    const strokePx = this.syncMeasurerFrom(contentEl, measurer);
    if (Number.isFinite(maxWidth as number)) {
      measurer.style.maxWidth = `${Math.max(1, maxWidth as number)}px`;
    } else {
      measurer.style.maxWidth = "none";
    }
    measurer.style.width = "auto";
    measurer.textContent = contentEl.textContent ?? " ";
    const rect = measurer.getBoundingClientRect();
    const measuredScrollW = Math.ceil(measurer.scrollWidth);
    const nextW = Math.ceil(
      ((measuredScrollW > 0 ? measuredScrollW : rect.width) as number) +
        strokePx * 2,
    );
    return nextW > 0 ? nextW : null;
  }

  private debugEditingLayerPosition(id: string, layerEl: HTMLElement): void {
    if (!TextOverlayComponent.DEBUG_EDIT_POSITION_LOGS) return;
    if (typeof window === "undefined") return;
    const rect = layerEl.getBoundingClientRect();
    const computed = window.getComputedStyle(layerEl);
    const vv = window.visualViewport;
    const vvH = vv?.height ?? -1;
    const iH = window.innerHeight;
    const left = Math.round(rect.left * 10) / 10;
    const top = Math.round(rect.top * 10) / 10;
    const tr = computed.transform || "none";
    const prev = this.lastEditDbg;
    const jumped =
      !!prev &&
      (Math.abs(prev.left - left) >= 0.5 ||
        Math.abs(prev.top - top) >= 0.5 ||
        prev.vvH !== vvH ||
        prev.iH !== iH ||
        prev.tr !== tr);
    this.lastEditDbg = { left, top, vvH, iH, tr };
    if (!jumped || this.editJumpLogged) return;
    this.editJumpLogged = true;
    console.warn("[text-edit-jump]", {
      id,
      left,
      top,
      transform: tr,
      innerHeight: iH,
      visualViewportHeight: vvH,
      visualViewportOffsetTop: vv?.offsetTop ?? 0,
    });
  }

  private computeContentMaxWidth(
    layer: TextLayer,
    stageWidth: number,
  ): number | null {
    const outer = this.computeAutoMaxWidth(layer, stageWidth);
    if (!outer) return null;
    const stroke = Math.max(0, Number(layer.strokeWidthPx) || 0);
    const content = Math.max(1, outer - stroke * 2);
    return content;
  }

  private computeEffectiveContentMaxWidth(
    layer: TextLayer,
    stageWidth: number,
  ): number | null {
    const userMax = Number.isFinite(layer.maxWidthPx as number)
      ? (layer.maxWidthPx as number)
      : null;
    if (userMax) return Math.max(1, userMax);
    return this.computeContentMaxWidth(layer, stageWidth);
  }

  private computeDisplayWidth(
    layer: TextLayer,
    stageWidth: number,
    isEditingActive: boolean,
  ): number | null {
    const userMax = Number.isFinite(layer.maxWidthPx as number)
      ? (layer.maxWidthPx as number)
      : null;
    const autoMax = this.computeAutoMaxWidth(layer, stageWidth);
    const boxW = Number.isFinite(layer.boxWidthPx as number)
      ? (layer.boxWidthPx as number)
      : null;
    if (userMax) return userMax;
    if (autoMax && boxW) return Math.min(boxW, autoMax);
    if (boxW) return boxW;
    // Without a measured width, let the host hug the content naturally.
    // The content/textarea still receive max-width constraints for wrapping.
    return null;
  }

  private computeDisplayHeight(layer: TextLayer): number | null {
    const boxH = Number.isFinite(layer.boxHeightPx as number)
      ? (layer.boxHeightPx as number)
      : null;
    if (boxH) return boxH;
    return null;
  }

  private resolveMeasureElement(layerEl: HTMLElement): HTMLElement | null {
    const editorForLayer = layerEl.querySelector<HTMLElement>(
      ".text-layer__editor:not(.is-hidden)",
    );
    if (editorForLayer) return editorForLayer;
    return layerEl.querySelector<HTMLElement>(".text-layer__content");
  }

  private focusEditor(id: string): void {
    const overlay = this.overlayRef?.nativeElement;
    const el = overlay?.querySelector<HTMLTextAreaElement>(
      `[data-editor-for="${id}"]`,
    );
    if (!el) return;
    const draftValue = this.textEdit.getDraft(id);
    if (el.value !== draftValue) {
      // Keep the focused textarea uncontrolled while typing so Android does not
      // restart the IME connection on every reactive draft update.
      el.value = draftValue;
    }

    // CRITICAL: Force 150px height in AutoEdit mode IMMEDIATELY
    const layer = this.findLayer(id);
    const isAutoEditMode = layer && !layer.userBoxTouched;
    if (isAutoEditMode) {
      const layerEl = el.closest<HTMLElement>("[data-text-id]");
      if (layerEl) {
        layerEl.style.height = "150px";
        layerEl.style.maxHeight = "150px";
        layerEl.style.minHeight = "150px";
        layerEl.style.overflow = "hidden";
      }
      el.style.height = "150px";
      el.style.maxHeight = "150px";
      el.style.minHeight = "150px";
    }

    const prevWindowScrollX =
      typeof window !== "undefined" ? window.scrollX : 0;
    const prevWindowScrollY =
      typeof window !== "undefined" ? window.scrollY : 0;
    const overlayTopBefore = overlay?.getBoundingClientRect().top ?? null;
    try {
      if (typeof (el as any).focus === "function") {
        try {
          (el as any).focus({ preventScroll: true });
        } catch {
          el.focus();
        }
      }
      el.select();
    } catch {
      // ignore
    }
    requestAnimationFrame(() => {
      if (typeof window === "undefined") return;
      if (
        window.scrollX !== prevWindowScrollX ||
        window.scrollY !== prevWindowScrollY
      ) {
        window.scrollTo(prevWindowScrollX, prevWindowScrollY);
      }
      const overlayRect =
        this.overlayRef?.nativeElement?.getBoundingClientRect();
      if (overlayRect) {
        this.refreshEditStageSnapshotFromRect(overlayRect);
      }
      const layer = this.findLayer(id);
      const editableBoxHeight =
        this.editStageSnapshot?.editableBoxHeight ?? null;
      const currentBoxHeight = Number.isFinite(layer?.boxHeightPx as number)
        ? Math.max(1, layer?.boxHeightPx as number)
        : null;
      if (
        layer &&
        editableBoxHeight &&
        !layer.userBoxTouched &&
        (!currentBoxHeight ||
          Math.abs(currentBoxHeight - editableBoxHeight) > 1)
      ) {
        this.state.updateTextLayer(id, {
          boxHeightPx: editableBoxHeight,
          autoFitLocked: false,
        });
        this.scheduleMeasure(id);
      }
      if (DEBUG_EDIT_DIAGNOSTICS) {
        console.warn("[EDIT_FOCUS_RAF1]", {
          id,
          windowScrollY: window.scrollY,
          overlayTopBefore,
          overlayTopAfter:
            this.overlayRef?.nativeElement?.getBoundingClientRect().top ?? null,
        });
      }
      this.emitShiftProbe("E2_FOCUS_RAF1", id);
    });
  }

  private emitShiftProbe(label: string, id: string): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(EDIT_SHIFT_PROBE_EVENT, {
        detail: { label, id },
      }),
    );
  }

  private computeEditingDisplayLeft(
    layer: TextLayer,
    defaultCenterX: number,
    displayWidth: number | null,
  ): number {
    if (!displayWidth) return defaultCenterX;
    const defaultLeft = defaultCenterX - displayWidth / 2;
    if (!this.editAnchorRect) return defaultLeft;
    const currentOverlayLeft =
      this.overlayRef?.nativeElement?.getBoundingClientRect().left ??
      this.editStageSnapshot?.overlayLeft;
    if (!Number.isFinite(currentOverlayLeft as number)) return defaultLeft;
    const anchorLeft =
      this.editAnchorRect.left - (currentOverlayLeft as number);
    const visibleStageWidth =
      this.editStageSnapshot?.overlayWidth ??
      this.overlayRef?.nativeElement?.getBoundingClientRect().width ??
      0;
    if (!visibleStageWidth) {
      return anchorLeft;
    }
    const maxLeft = Math.max(0, visibleStageWidth - displayWidth);
    return this.clamp(anchorLeft, 0, maxLeft);
  }

  private computeEditingDisplayTop(
    layer: TextLayer,
    defaultCenterY: number,
    displayHeight: number | null,
  ): number {
    if (!displayHeight) return defaultCenterY;
    const defaultTop = defaultCenterY - displayHeight / 2;
    if (!layer.userBoxTouched && this.textEdit.editingTextId() === layer.id) {
      // AutoEditMode uses a top-anchored box so Android maps the focused textarea
      // to the same on-screen rect that the user sees, instead of a centered one.
      return 0;
    }
    if (!this.editAnchorRect) return defaultTop;
    const currentOverlayTop =
      this.overlayRef?.nativeElement?.getBoundingClientRect().top ??
      this.editStageSnapshot?.overlayTop;
    if (!Number.isFinite(currentOverlayTop as number)) return defaultTop;
    const anchorTop = this.editAnchorRect.top - (currentOverlayTop as number);
    const visibleStageHeight =
      this.editStageSnapshot?.effectiveStageHeight ??
      this.editStageSnapshot?.overlayHeight ??
      0;
    if (!visibleStageHeight) {
      return anchorTop;
    }
    // Keep the live editor inside the visible stage so Android does not pan the whole WebView.
    const maxTop = Math.max(0, visibleStageHeight - displayHeight);
    return this.clamp(anchorTop, 0, maxTop);
  }

  private logEditDiagnostics(label: string, id: string): void {
    if (!DEBUG_EDIT_DIAGNOSTICS) return;
    const overlay = this.overlayRef?.nativeElement;
    const layerEl =
      overlay?.querySelector<HTMLElement>(`[data-text-id="${id}"]`) ?? null;
    const textareaEl =
      overlay?.querySelector<HTMLTextAreaElement>(
        `textarea[data-editor-for="${id}"]`,
      ) ?? null;
    const contentEl =
      overlay?.querySelector<HTMLElement>(
        `[data-text-id="${id}"] .text-layer__content`,
      ) ?? null;
    const textareaStyle = textareaEl
      ? window.getComputedStyle(textareaEl)
      : null;
    const layerStyle = layerEl ? window.getComputedStyle(layerEl) : null;
    console.warn(label, {
      id,
      editingId: this.textEdit.editingTextId(),
      isEditing: this.textEdit.isEditing(),
      textareaExists: !!textareaEl,
      contentExists: !!contentEl,
      textareaClass: textareaEl?.className ?? null,
      textareaIsHiddenClass:
        textareaEl?.classList.contains("is-hidden") ?? false,
      textareaDisplay: textareaStyle?.display ?? null,
      textareaVisibility: textareaStyle?.visibility ?? null,
      textareaOpacity: textareaStyle?.opacity ?? null,
      textareaZIndex: textareaStyle?.zIndex ?? null,
      layerZIndex: layerStyle?.zIndex ?? null,
      layerRect: this.snapshotRect(layerEl),
      textareaRect: this.snapshotRect(textareaEl),
      layerInlineStyle: layerEl
        ? {
            left: layerEl.style.left || null,
            top: layerEl.style.top || null,
            width: layerEl.style.width || null,
            height: layerEl.style.height || null,
          }
        : null,
      textareaInlineStyle: textareaEl
        ? {
            maxWidth: textareaEl.style.maxWidth || null,
          }
        : null,
    });
  }

  private snapshotRect(
    el: Element | null,
  ): { left: number; top: number; width: number; height: number } | null {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      left: Math.round(rect.left * 10) / 10,
      top: Math.round(rect.top * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
    };
  }

  private captureEditAnchorRect(id: string): void {
    const overlay = this.overlayRef?.nativeElement;
    const layerEl = overlay?.querySelector<HTMLElement>(
      `[data-text-id="${id}"]`,
    );
    const rect = layerEl?.getBoundingClientRect();
    if (!rect) return;
    this.editAnchorRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  private captureEditStageSnapshot(): void {
    const overlay = this.overlayRef?.nativeElement;
    const overlayRect = overlay?.getBoundingClientRect();
    if (!overlayRect) return;
    this.refreshEditStageSnapshotFromRect(overlayRect);
  }

  private refreshEditStageSnapshotFromRect(overlayRect: DOMRect): void {
    const ctx = this.state.constraintsContext();
    if (!ctx) return;
    const keyboardOverlap = this.computeKeyboardOverlap(overlayRect);
    const effectiveStageHeight = Math.max(
      1,
      overlayRect.height - keyboardOverlap,
    );
    const editableBoxHeight = this.clampEditableBoxHeight(
      this.computeMaxEditableBoxHeight(overlayRect),
      effectiveStageHeight || overlayRect.height,
    );
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    // AutoEditMode uses a frozen viewport snapshot so typing does not re-fit against IME jitter.
    this.editStageSnapshot = {
      frameW: ctx.frameW,
      frameH: ctx.frameH,
      overlayLeft: overlayRect.left,
      overlayTop: overlayRect.top,
      overlayWidth: overlayRect.width,
      overlayHeight: overlayRect.height,
      effectiveStageHeight,
      editableBoxHeight,
    };
  }

  private buildDragContext(id: string, rect: DOMRect): DragContext {
    const sizes = this.captureTextSizes();
    const dragSize = sizes.get(id) ?? { width: 0, height: 0 };
    const otherGuidesX: number[] = [];
    const otherGuidesY: number[] = [];

    for (const layer of this.textLayers()) {
      if (layer.id === id) continue;
      const size = sizes.get(layer.id);
      if (!size) continue;
      const centerX = layer.x * rect.width;
      const centerY = layer.y * rect.height;
      const halfW = size.width / 2;
      const halfH = size.height / 2;
      otherGuidesX.push(centerX - halfW, centerX, centerX + halfW);
      otherGuidesY.push(centerY - halfH, centerY, centerY + halfH);
    }

    return {
      stageRect: rect,
      stageWidth: rect.width,
      stageHeight: rect.height,
      dragId: id,
      dragSize,
      otherGuidesX,
      otherGuidesY,
    };
  }

  private applyTextFontSize(nextFontSizePx: number): void {
    const id = this.resizingId();
    if (!id) return;
    const clamped = this.clamp(
      Math.round(nextFontSizePx),
      TextOverlayComponent.FONT_SIZE_MIN_MANUAL,
      TextOverlayComponent.FONT_SIZE_MAX_MANUAL,
    );
    this.history.setTextFontSize(id, clamped, { autoFitLocked: true });
    // Don't update selectedRect during resize - will be updated on resize end
  }

  private captureTextSizes(): Map<string, { width: number; height: number }> {
    const overlay = this.overlayRef?.nativeElement;
    const map = new Map<string, { width: number; height: number }>();
    if (!overlay) return map;
    const elements = overlay.querySelectorAll<HTMLElement>("[data-text-id]");
    elements.forEach((el) => {
      const id = el.dataset["textId"];
      if (!id) return;
      const rect = el.getBoundingClientRect();
      map.set(id, { width: rect.width, height: rect.height });
    });
    return map;
  }

  private findLayer(id: string): TextLayer | null {
    return this.textLayers().find((layer) => layer.id === id) ?? null;
  }

  private pointerToOverlayPoint(e: PointerEvent, rect?: DOMRect): Pt | null {
    const overlay = this.overlayRef?.nativeElement;
    const overlayRect = rect ?? overlay?.getBoundingClientRect();
    if (!overlayRect) return null;
    return {
      x: e.clientX - overlayRect.left,
      y: e.clientY - overlayRect.top,
    };
  }

  private findBestGuideMatch(
    dragLines: number[],
    guides: number[],
  ): { delta: number; guide: number } | null {
    if (!dragLines.length || !guides.length) return null;
    let best: { delta: number; guide: number } | null = null;
    for (const guide of guides) {
      for (const line of dragLines) {
        const delta = guide - line;
        if (!best || Math.abs(delta) < Math.abs(best.delta)) {
          best = { delta, guide };
        }
      }
    }
    return best;
  }

  private clearGuides(): void {
    this.guides.set({
      draggingId: null,
      stageCenterX: 0,
      stageCenterY: 0,
      stageWidth: 0,
      stageHeight: 0,
      stageVActive: false,
      stageHActive: false,
      otherVLine: null,
      otherHLine: null,
    });
  }

  private resetResizeState(): void {
    this.endPinch();
    this.activeHandle = "none";
    this.resizingId.set(null);
    this.resizePointerId = null;
    this.resizeStart = null;
    this.resizeWidthPointerId = null;
    this.resizeWidthStart = null;
    this.boxResizePointerId = null;
    this.boxResizeStart = null;
    window.removeEventListener("pointermove", this.onResizeMoveBound);
    window.removeEventListener("pointerup", this.onResizeEndBound);
    window.removeEventListener("pointercancel", this.onResizeEndBound);
    window.removeEventListener("pointermove", this.onWidthResizeMoveBound);
    window.removeEventListener("pointerup", this.onWidthResizeEndBound);
    window.removeEventListener("pointercancel", this.onWidthResizeEndBound);
    window.removeEventListener("pointermove", this.onBoxResizeMoveBound);
    window.removeEventListener("pointerup", this.onBoxResizeEndBound);
    window.removeEventListener("pointercancel", this.onBoxResizeEndBound);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private requestRedraw(
    _: "gestureEnd" | "swapMove" | "swapEnd" | "boxResizeMove" | "boxResizeEnd",
  ): void {
    this.redrawTick.update((value) => (value + 1) % 1_000_000);
  }
}
