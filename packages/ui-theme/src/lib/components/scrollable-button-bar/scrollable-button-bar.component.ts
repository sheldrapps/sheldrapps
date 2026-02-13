import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonIcon } from "@ionic/angular/standalone";

export type ScrollableBarVariant = "text" | "iconText" | "iconOnly";
export type ScrollableBarAlign = "start" | "center";

export interface ScrollableBarItem {
  id: string;
  label?: string;
  labelKey?: string;
  icon?: string; // ionicon name, e.g. 'crop-outline'
  svg?: string; // raw svg string for custom icons
}

@Component({
  selector: "sh-scrollable-button-bar",
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  templateUrl: "./scrollable-button-bar.component.html",
  styleUrls: ["./scrollable-button-bar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollableButtonBarComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) items: ScrollableBarItem[] = [];
  @Input() activeId: string | null = null;
  @Input() disabled = false;
  @Input() disabledIds: string[] = [];
  @Input() variant: ScrollableBarVariant = "text";
  @Input() align: ScrollableBarAlign = "start";
  @Input() ariaLabel?: string;

  @Output() selectItem = new EventEmitter<string>();

  @ViewChild("scrollEl", { read: ElementRef })
  scrollElRef!: ElementRef<HTMLElement>;

  showFadeLeft = false;
  showFadeRight = false;

  private didNudge = false;
  private ro?: ResizeObserver;
  private onScrollBound?: () => void;
  private onResizeBound?: () => void;

  ngAfterViewInit(): void {
    const el = this.scrollElRef?.nativeElement;
    if (!el) return;

    this.onScrollBound = () => this.recalculateOverflow();
    this.onResizeBound = () => this.recalculateOverflow();

    el.addEventListener("scroll", this.onScrollBound, { passive: true });
    window.addEventListener("resize", this.onResizeBound, { passive: true });

    this.ro = new ResizeObserver(() => this.recalculateOverflow());
    this.ro.observe(el);

    // Wait 1 frame so scrollWidth/clientWidth are correct
    requestAnimationFrame(() => {
      this.recalculateOverflow();
      this.nudgeOnce();
    });
  }

  ngOnDestroy(): void {
    const el = this.scrollElRef?.nativeElement;
    if (el && this.onScrollBound)
      el.removeEventListener("scroll", this.onScrollBound as any);
    if (this.onResizeBound)
      window.removeEventListener("resize", this.onResizeBound as any);
    this.ro?.disconnect();
  }

  onItemClick(id: string): void {
    if (this.disabled || this.isItemDisabled(id)) return;
    this.selectItem.emit(id);
  }

  isActive(id: string): boolean {
    return !!this.activeId && this.activeId === id;
  }

  isItemDisabled(id: string): boolean {
    return this.disabledIds.includes(id);
  }

  svgSrc(item: ScrollableBarItem): string | null {
    if (!item.svg) return null;
    const encoded = btoa(item.svg);
    return `data:image/svg+xml;base64,${encoded}`;
  }

  private recalculateOverflow(): void {
    const el = this.scrollElRef?.nativeElement;
    if (!el) return;

    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    if (!hasOverflow) {
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

  private nudgeOnce(): void {
    if (this.didNudge) return;

    const el = this.scrollElRef?.nativeElement;
    if (!el) return;

    if (el.scrollWidth <= el.clientWidth + 1) return;

    this.didNudge = true;

    const startScroll = el.scrollLeft;
    const nudgeDistance = 14;
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
