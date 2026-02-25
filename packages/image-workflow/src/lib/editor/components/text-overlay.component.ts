import { Component, computed, ElementRef, inject, signal, ViewChild, effect } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { resizeOutline, swapHorizontalOutline } from "ionicons/icons";
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

const TAP_MAX_DELAY = 280;
const TAP_MAX_DIST = 12;

@Component({
  selector: "cc-text-overlay",
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: "./text-overlay.component.html",
  styleUrls: ["./text-overlay.component.scss"],
})
export class TextOverlayComponent {
  private readonly state = inject(EditorStateService);
  private readonly history = inject(EditorHistoryService);
  private readonly ui = inject(EditorUiStateService);
  private readonly sampler = inject(EditorColorSamplerService);
  private readonly textEdit = inject(EditorTextEditService);

  @ViewChild("overlay", { read: ElementRef })
  overlayRef?: ElementRef<HTMLElement>;

  @ViewChild("editor", { read: ElementRef })
  editorRef?: ElementRef<HTMLInputElement>;

  readonly textLayers = computed(() => this.state.textLayers());
  readonly textViews = computed(() => {
    const ctx = this.state.constraintsContext();
    const layers = this.textLayers();
    if (!ctx || !layers.length) return [];
    return layers.map((layer) => ({
      layer,
      x: layer.x * ctx.frameW,
      y: layer.y * ctx.frameH,
    }));
  });
  readonly canInteract = computed(
    () => this.ui.activeMode() === "text" && !this.sampler.active(),
  );
  readonly draggingId = signal<string | null>(null);
  readonly resizingId = signal<string | null>(null);
  readonly selectedRect = signal<{ x: number; y: number; w: number; h: number } | null>(null);
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
    startFontSize: number;
    startPointerX: number;
    startPointerY: number;
    startW: number;
    startH: number;
  } | null = null;
  private resizeWidthPointerId: number | null = null;
  private resizeWidthStart: {
    startMaxWidth: number;
    startPointerX: number;
  } | null = null;
  private readonly onWidthResizeMoveBound = (e: PointerEvent) =>
    this.onWidthResizeMove(e);
  private readonly onWidthResizeEndBound = (e: PointerEvent) =>
    this.onWidthResizeEnd(e);

  private lastTapAt = 0;
  private lastTapPos: Pt | null = null;
  private lastTapId: string | null = null;
  private wasEditing = false;

  constructor() {
    addIcons({ resizeOutline, swapHorizontalOutline });

    effect(() => {
      const editingId = this.textEdit.editingTextId();
      if (!editingId) return;
      requestAnimationFrame(() => this.focusEditor());
    });

    effect(() => {
      const selectedId = this.textEdit.selectedTextId();
      const isEditing = this.textEdit.isEditing();
      const canInteract = this.canInteract();
      this.textLayers();

      if (!selectedId || isEditing || !canInteract) {
        this.selectedRect.set(null);
        return;
      }

      this.queueSelectedRectMeasure(selectedId);
    });

    effect(() => {
      const isEditing = this.textEdit.isEditing();
      const selectedId = this.textEdit.selectedTextId();
      const mode = this.ui.activeMode();
      if (this.wasEditing && !isEditing) {
        if (mode === "text" && selectedId) {
          this.ui.openPanel("text", "text");
        }
      }
      this.wasEditing = isEditing;
    });
  }

  onPointerDown(e: PointerEvent, id: string): void {
    if (!this.canInteract()) return;
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
      Math.hypot(
        tapPos.x - this.lastTapPos.x,
        tapPos.y - this.lastTapPos.y,
      ) < TAP_MAX_DIST;
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
    const value = (e.target as HTMLInputElement | null)?.value ?? "";
    this.textEdit.updateDraft(id, value);
  }

  applyEdit(): void {
    this.textEdit.apply();
  }

  discardEdit(): void {
    this.textEdit.discard();
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
    this.applyEdit();
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
    if (stageXMatch && (!bestX || Math.abs(stageDeltaX) <= Math.abs(bestX.delta))) {
      x = stageCenterX;
      stageVActive = true;
    } else if (bestX && Math.abs(bestX.delta) <= threshold) {
      x += bestX.delta;
      otherVLine = bestX.guide;
    }

    const bestY = this.findBestGuideMatch(dragLinesY, ctx.otherGuidesY);
    if (stageYMatch && (!bestY || Math.abs(stageDeltaY) <= Math.abs(bestY.delta))) {
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
    const id = this.textEdit.selectedTextId();
    if (!id) return;
    const rect = this.selectedRect();
    const layer = this.findLayer(id);
    if (!rect || !layer) return;

    this.resizingId.set(id);
    this.resizePointerId = e.pointerId;
    this.resizeStart = {
      startFontSize: layer.fontSizePx,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startW: rect.w,
      startH: rect.h,
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
    window.addEventListener("pointermove", this.onWidthResizeMoveBound);
    window.addEventListener("pointerup", this.onWidthResizeEndBound);
    window.addEventListener("pointercancel", this.onWidthResizeEndBound);

    e.preventDefault();
    e.stopPropagation();
  }

  onWidthResizeStart(e: PointerEvent): void {
    if (!this.canInteract()) return;
    const id = this.textEdit.selectedTextId();
    if (!id) return;
    const rect = this.selectedRect();
    const layer = this.findLayer(id);
    if (!rect || !layer) return;

    const startMaxWidth = Number.isFinite(layer.maxWidthPx as number)
      ? (layer.maxWidthPx as number)
      : rect.w;

    this.resizingId.set(id);
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

  onResizeMove(e: PointerEvent): void {
    if (!this.resizePointerId || this.resizePointerId !== e.pointerId) return;
    const id = this.resizingId();
    if (!id) return;
    const start = this.resizeStart;
    if (!start) return;

    const dx = e.clientX - start.startPointerX;
    const dy = e.clientY - start.startPointerY;
    const denom = Math.hypot(start.startW, start.startH) || 1;
    const delta = (dx * start.startW + dy * start.startH) / denom;
    const scale = (denom + delta) / denom;
    const next = Math.round(start.startFontSize * scale);

    this.history.setTextFontSize(id, next);
    queueMicrotask(() => this.queueSelectedRectMeasure(id));

    e.preventDefault();
    e.stopPropagation();
  }

  onWidthResizeMove(e: PointerEvent): void {
    if (!this.resizeWidthPointerId || this.resizeWidthPointerId !== e.pointerId) {
      return;
    }
    const id = this.resizingId();
    if (!id) return;
    const start = this.resizeWidthStart;
    if (!start) return;

    const dx = e.clientX - start.startPointerX;
    const next = Math.round(start.startMaxWidth + dx * 2);

    this.history.setTextMaxWidth(id, next);
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

    this.resizePointerId = null;
    this.resizeStart = null;
    this.resizingId.set(null);
    this.history.onSliderEnd();

    e.preventDefault();
    e.stopPropagation();
  }

  onWidthResizeEnd(e: PointerEvent): void {
    if (!this.resizeWidthPointerId || this.resizeWidthPointerId !== e.pointerId) {
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

    this.resizeWidthPointerId = null;
    this.resizeWidthStart = null;
    this.resizingId.set(null);
    this.history.onSliderEnd();
    window.removeEventListener("pointermove", this.onWidthResizeMoveBound);
    window.removeEventListener("pointerup", this.onWidthResizeEndBound);
    window.removeEventListener("pointercancel", this.onWidthResizeEndBound);

    e.preventDefault();
    e.stopPropagation();
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
    this.textEdit.enterEdit(id, layer.content ?? "");
    this.ui.closePanel();
    this.dragPointerId = null;
    this.dragOffset = null;
    this.dragContext = null;
    this.draggingId.set(null);
    this.resetResizeState();
    this.clearGuides();
  }

  private queueSelectedRectMeasure(selectedId: string): void {
    requestAnimationFrame(() => {
      const overlay = this.overlayRef?.nativeElement;
      if (!overlay) return;
      if (this.textEdit.selectedTextId() !== selectedId) return;
      if (this.textEdit.isEditing() || !this.canInteract()) {
        this.selectedRect.set(null);
        return;
      }

      const el = overlay.querySelector<HTMLElement>(
        `[data-text-id="${selectedId}"]`,
      );
      if (!el) {
        this.selectedRect.set(null);
        return;
      }
      const overlayRect = overlay.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        this.selectedRect.set(null);
        return;
      }
      this.selectedRect.set({
        x: rect.left - overlayRect.left,
        y: rect.top - overlayRect.top,
        w: rect.width,
        h: rect.height,
      });
    });
  }

  private focusEditor(): void {
    const el = this.editorRef?.nativeElement;
    if (!el) return;
    try {
      el.focus();
      el.select();
    } catch {
      // ignore
    }
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
    this.resizingId.set(null);
    this.resizePointerId = null;
    this.resizeStart = null;
    this.resizeWidthPointerId = null;
    this.resizeWidthStart = null;
    window.removeEventListener("pointermove", this.onWidthResizeMoveBound);
    window.removeEventListener("pointerup", this.onWidthResizeEndBound);
    window.removeEventListener("pointercancel", this.onWidthResizeEndBound);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
