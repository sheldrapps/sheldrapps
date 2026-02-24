import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonIcon } from "@ionic/angular/standalone";

export type ScrollableBarVariant = "text" | "iconText" | "iconOnly";
export type ScrollableBarAlign = "start" | "center";
export type ScrollableBarOrder = "normal" | "reverse";
export type ScrollableBarEdge = "start" | "end";

export interface ScrollableBarItem {
  id: string;
  label?: string;
  labelKey?: string;
  icon?: string; // ionicon name, e.g. 'crop-outline'
  svg?: string; // raw svg string for custom icons
  type?: "default" | "color";
  colorHex?: string;
}

@Component({
  selector: "sh-scrollable-button-bar",
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  templateUrl: "./scrollable-button-bar.component.html",
  styleUrls: ["./scrollable-button-bar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollableButtonBarComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  // TODO: Remove debug logging after overflow verification.
  debug = true;

  @Input({ required: true }) items: ScrollableBarItem[] = [];
  @Input() activeId: string | null = null;
  @Input() disabled = false;
  @Input() disabledIds: string[] = [];
  @Input() variant: ScrollableBarVariant = "text";
  @Input() align: ScrollableBarAlign = "start";
  @Input() order: ScrollableBarOrder = "normal";
  @Input() edge: ScrollableBarEdge = "start";
  @Input() ariaLabel?: string;

  @Output() selectItem = new EventEmitter<string>();

  @ViewChild("scrollEl", { read: ElementRef })
  scrollElRef!: ElementRef<HTMLElement>;
  @ViewChild("viewportEl", { read: ElementRef })
  viewportElRef!: ElementRef<HTMLElement>;
  @ViewChild("trackEl", { read: ElementRef })
  trackElRef!: ElementRef<HTMLElement>;

  showFadeLeft = false;
  showFadeRight = false;
  hasOverflow = false;

  private didNudge = false;
  private viewReady = false;
  private ro?: ResizeObserver;
  private childRo?: ResizeObserver;
  private observedChildren = new Set<Element>();
  private onScrollBound?: () => void;
  private onResizeBound?: () => void;
  private onPointerDownBound?: (e: PointerEvent) => void;
  private onPointerMoveBound?: (e: PointerEvent) => void;
  private onPointerUpBound?: (e: PointerEvent) => void;
  private rafId: number | null = null;
  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartScrollLeft = 0;
  private dragActive = false;
  private suppressClickUntil = 0;
  isDragging = false;

  constructor(private hostRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const el = this.scrollElRef?.nativeElement;
    if (!el) return;
    this.viewReady = true;

    this.onScrollBound = () => this.recalculateOverflow();
    this.onResizeBound = () => this.scheduleRecalculate(this.edge === "end");

    el.addEventListener("scroll", this.onScrollBound, { passive: true });
    window.addEventListener("resize", this.onResizeBound, { passive: true });

    this.onPointerDownBound = (e: PointerEvent) => this.onPointerDown(e);
    this.onPointerMoveBound = (e: PointerEvent) => this.onPointerMove(e);
    this.onPointerUpBound = (e: PointerEvent) => this.onPointerUp(e);
    el.addEventListener("pointerdown", this.onPointerDownBound);
    el.addEventListener("pointermove", this.onPointerMoveBound, {
      passive: false,
    });
    el.addEventListener("pointerup", this.onPointerUpBound);
    el.addEventListener("pointercancel", this.onPointerUpBound);

    this.ro = new ResizeObserver(() =>
      this.scheduleRecalculate(this.edge === "end"),
    );
    this.ro.observe(el);

    this.childRo = new ResizeObserver(() =>
      this.scheduleRecalculate(this.edge === "end"),
    );

    // Wait 1 frame so scrollWidth/clientWidth are correct
    this.scheduleRecalculate(this.edge === "end", true);
    requestAnimationFrame(() => this.logDiagnostics("afterViewInit"));
  }

  ngOnDestroy(): void {
    const el = this.scrollElRef?.nativeElement;
    if (el && this.onScrollBound)
      el.removeEventListener("scroll", this.onScrollBound as any);
    if (this.onResizeBound)
      window.removeEventListener("resize", this.onResizeBound as any);
    if (el && this.onPointerDownBound)
      el.removeEventListener("pointerdown", this.onPointerDownBound as any);
    if (el && this.onPointerMoveBound)
      el.removeEventListener("pointermove", this.onPointerMoveBound as any);
    if (el && this.onPointerUpBound)
      el.removeEventListener("pointerup", this.onPointerUpBound as any);
    if (el && this.onPointerUpBound)
      el.removeEventListener("pointercancel", this.onPointerUpBound as any);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.ro?.disconnect();
    this.childRo?.disconnect();
    this.observedChildren.clear();
  }

  onItemClick(id: string): void {
    if (performance.now() < this.suppressClickUntil) return;
    if (this.disabled || this.isItemDisabled(id)) return;
    this.selectItem.emit(id);
  }

  isActive(id: string): boolean {
    return !!this.activeId && this.activeId === id;
  }

  isItemDisabled(id: string): boolean {
    return this.disabledIds.includes(id);
  }

  itemAriaLabel(item: ScrollableBarItem): string | null {
    return item.label || item.labelKey || item.colorHex || item.id || null;
  }

  svgSrc(item: ScrollableBarItem): string | null {
    if (!item.svg) return null;
    const encoded = btoa(item.svg);
    return `data:image/svg+xml;base64,${encoded}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    const itemsChanged = !!changes["items"];
    if (itemsChanged) {
      this.didNudge = false;
    }
    if (
      changes["items"] ||
      changes["order"] ||
      changes["edge"] ||
      changes["align"]
    ) {
      this.scheduleRecalculate(this.edge === "end", itemsChanged);
    }
  }

  private scheduleRecalculate(
    snapToEnd: boolean,
    allowNudge = false,
  ): void {
    if (!this.viewReady) return;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.syncChildObservers();
      this.recalculateOverflow();
      if (snapToEnd) {
        this.scrollToEdgeEnd();
        this.recalculateOverflow();
      }
      if (allowNudge) {
        this.nudgeOnce();
      }
    });
  }

  private recalculateOverflow(): void {
    const el = this.scrollElRef?.nativeElement;
    if (!el) return;

    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    this.hasOverflow = hasOverflow;
    this.logDiagnostics("recalculateOverflow");
    if (!hasOverflow) {
      this.resetDragState();
      this.showFadeLeft = false;
      this.showFadeRight = false;
      return;
    }

    const atStart = el.scrollLeft <= 0;
    const atEnd =
      Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth - 1;

    this.showFadeLeft = !atStart;
    this.showFadeRight = !atEnd;
  }

  private scrollToEdgeEnd(): void {
    const el = this.scrollElRef?.nativeElement;
    if (!el || this.edge !== "end" || !this.hasOverflow) return;
    el.scrollLeft = el.scrollWidth;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.hasOverflow) return;
    if (e.button !== 0) return;

    const el = this.scrollElRef?.nativeElement;
    if (!el) return;

    this.dragPointerId = e.pointerId;
    this.dragStartX = e.clientX;
    this.dragStartScrollLeft = el.scrollLeft;
    this.dragActive = true;
    this.isDragging = false;

    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragActive || this.dragPointerId !== e.pointerId) return;
    const el = this.scrollElRef?.nativeElement;
    if (!el) return;

    const dx = e.clientX - this.dragStartX;
    if (!this.isDragging && Math.abs(dx) < 4) return;

    this.isDragging = true;
    el.scrollLeft = this.dragStartScrollLeft - dx;
    e.preventDefault();
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.dragPointerId !== e.pointerId) return;
    const el = this.scrollElRef?.nativeElement;
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (this.isDragging) {
      this.suppressClickUntil = performance.now() + 180;
    }

    this.resetDragState();
  }

  private resetDragState(): void {
    this.dragPointerId = null;
    this.dragActive = false;
    this.isDragging = false;
  }

  private logDiagnostics(context: string): void {
    if (!this.debug) return;

    const host = this.hostRef?.nativeElement ?? null;
    const viewport = this.viewportElRef?.nativeElement ?? null;
    const scrollEl = this.scrollElRef?.nativeElement ?? null;
    const track = this.trackElRef?.nativeElement ?? null;

    const firstButton =
      track?.querySelector("ion-button") ?? track?.firstElementChild ?? null;
    const scrollStyle = scrollEl ? getComputedStyle(scrollEl) : null;
    const buttonStyle = firstButton ? getComputedStyle(firstButton) : null;

    console.log("[scrollable-button-bar][debug]", context, {
      widths: {
        hostClientWidth: host?.clientWidth ?? null,
        viewportClientWidth: viewport?.clientWidth ?? null,
        scrollClientWidth: scrollEl?.clientWidth ?? null,
        scrollScrollWidth: scrollEl?.scrollWidth ?? null,
        scrollScrollLeft: scrollEl?.scrollLeft ?? null,
        trackScrollWidth: track?.scrollWidth ?? null,
      },
      scrollComputed: scrollStyle
        ? {
            overflowX: scrollStyle.overflowX,
            display: scrollStyle.display,
            flexWrap: scrollStyle.flexWrap,
            whiteSpace: scrollStyle.whiteSpace,
          }
        : null,
      firstButtonComputed: buttonStyle
        ? {
            flex: buttonStyle.flex,
            minWidth: buttonStyle.minWidth,
            width: buttonStyle.width,
          }
        : null,
    });
  }

  private syncChildObservers(): void {
    const el = this.scrollElRef?.nativeElement;
    const ro = this.childRo;
    if (!el || !ro) return;

    const children = Array.from(el.children);
    const next = new Set<Element>(children);

    for (const child of children) {
      if (this.observedChildren.has(child)) continue;
      ro.observe(child);
      this.observedChildren.add(child);
    }

    for (const child of Array.from(this.observedChildren)) {
      if (next.has(child)) continue;
      ro.unobserve(child);
      this.observedChildren.delete(child);
    }
  }

  private nudgeOnce(): void {
    if (this.didNudge) return;

    const el = this.scrollElRef?.nativeElement;
    if (!el) return;

    if (el.scrollWidth <= el.clientWidth + 1) return;

    this.didNudge = true;

    const startScroll = el.scrollLeft;
    const direction = this.edge === "end" ? -1 : 1;
    const nudgeDistance = 14 * direction;
    const duration = 600;

    const startTime = performance.now();

    const animateOut = (t: number) => {
      const elapsed = t - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      el.scrollLeft = startScroll + nudgeDistance * ease;

      if (progress < 1) {
        requestAnimationFrame(animateOut);
      } else {
        const returnStart = performance.now();

        const animateBack = (tt: number) => {
          const e2 = tt - returnStart;
          const p2 = Math.min(e2 / duration, 1);
          const ease2 = 1 - Math.pow(1 - p2, 3);

          el.scrollLeft = startScroll + nudgeDistance * (1 - ease2);

          if (p2 < 1) {
            requestAnimationFrame(animateBack);
          } else {
            el.scrollLeft = startScroll;
            this.recalculateOverflow();
          }
        };

        requestAnimationFrame(animateBack);
      }
    };

    requestAnimationFrame(animateOut);
  }
  trackById = (_: number, item: ScrollableBarItem) => item.id;
}
