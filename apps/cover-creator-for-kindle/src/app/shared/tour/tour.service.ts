import { Injectable, computed, isDevMode, signal } from '@angular/core';
import type { IonContent } from '@ionic/angular/standalone';

import type {
  TourCompletionReason,
  TourDefinition,
  TourOverlayState,
  TourPlacement,
  TourSpotlightRect,
  TourTooltipStyle,
} from './tour.types';

type TourCompletionHandler = (
  reason: TourCompletionReason
) => void | Promise<void>;

const DEFAULT_TOOLTIP_STYLE: TourTooltipStyle = {
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(320px, calc(100vw - 24px))',
};

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly activeTourSig = signal<TourDefinition | null>(null);
  private readonly currentIndexSig = signal(0);
  private readonly spotlightRectSig = signal<TourSpotlightRect | null>(null);
  private readonly tooltipStyleSig = signal<TourTooltipStyle>(
    DEFAULT_TOOLTIP_STYLE
  );

  private content?: IonContent;
  private completionHandler?: TourCompletionHandler;
  private pendingManualTourId: string | null = null;
  private resizeHandler?: () => void;
  private syncRafId: number | null = null;
  private mutationObserver: MutationObserver | null = null;
  private mutationObservedRoot: Node | null = null;
  private targetResizeObserver: ResizeObserver | null = null;
  private observedTarget: HTMLElement | null = null;
  private syncInFlight = false;
  private syncQueued = false;

  readonly state = computed<TourOverlayState>(() => {
    const activeTour = this.activeTourSig();
    const currentIndex = this.currentIndexSig();
    const currentStep = activeTour?.steps[currentIndex] ?? null;
    const totalSteps = activeTour?.steps.length ?? 0;

    return {
      active: !!activeTour && !!currentStep,
      currentStep,
      currentIndex,
      totalSteps,
      displayCurrent: currentStep?.progressCurrent ?? currentIndex + 1,
      displayTotal: currentStep?.progressTotal ?? totalSteps,
      canGoBack: currentIndex > 0,
      canFinish:
        !!currentStep?.showFinish ||
        (totalSteps > 0 && currentIndex === totalSteps - 1),
      isLastStep: totalSteps > 0 && currentIndex === totalSteps - 1,
      spotlightRect: this.spotlightRectSig(),
      tooltipStyle: this.tooltipStyleSig(),
    };
  });

  readonly isActive = computed(() => this.state().active);

  registerContent(content: IonContent | undefined): void {
    this.content = content;
  }

  requestManualStart(tourId: string): void {
    this.pendingManualTourId = tourId;
  }

  consumePendingManualStart(tourId: string): boolean {
    if (this.pendingManualTourId !== tourId) {
      return false;
    }

    this.pendingManualTourId = null;
    return true;
  }

  async start(
    tour: TourDefinition,
    opts?: { onComplete?: TourCompletionHandler }
  ): Promise<void> {
    this.completionHandler = opts?.onComplete;
    this.activeTourSig.set(tour);
    this.currentIndexSig.set(0);
    this.spotlightRectSig.set(null);
    this.tooltipStyleSig.set(DEFAULT_TOOLTIP_STYLE);

    this.attachWindowListeners();
    this.log('tour:start', { tourId: tour.id, steps: tour.steps.length });
    await this.ensureMutationObserver();

    await this.waitForLayout();
    await this.runSync({ allowScroll: true });
  }

  async next(): Promise<void> {
    const state = this.state();
    if (!state.active || !state.currentStep) {
      return;
    }

    if (state.canFinish) {
      await this.finish('complete');
      return;
    }

    this.currentIndexSig.set(state.currentIndex + 1);
    await this.runSync({ allowScroll: true });
  }

  async back(): Promise<void> {
    const state = this.state();
    if (!state.active || state.currentIndex <= 0) {
      return;
    }

    this.currentIndexSig.set(state.currentIndex - 1);
    await this.runSync({ allowScroll: true });
  }

  async skip(): Promise<void> {
    await this.finish('skip');
  }

  async completeInteraction(interactionId: string): Promise<void> {
    const state = this.state();
    const currentStep = state.currentStep;
    if (!state.active || !currentStep) {
      return;
    }

    if (!currentStep.advanceOn?.includes(interactionId)) {
      return;
    }

    if (state.currentIndex >= state.totalSteps - 1) {
      return;
    }

    this.currentIndexSig.set(state.currentIndex + 1);
    await this.runSync({ allowScroll: true });
  }

  requestSync(): void {
    if (!this.isActive()) {
      return;
    }

    if (typeof window === 'undefined') {
      void this.runSync({ allowScroll: false });
      return;
    }

    if (this.syncRafId != null) {
      window.cancelAnimationFrame(this.syncRafId);
    }

    this.syncRafId = window.requestAnimationFrame(() => {
      this.syncRafId = null;
      void this.waitForLayout().then(() => {
        void this.runSync({ allowScroll: false });
      });
    });
  }

  private async finish(reason: TourCompletionReason): Promise<void> {
    const activeTour = this.activeTourSig();
    if (!activeTour) {
      return;
    }

    this.detachWindowListeners();
    this.activeTourSig.set(null);
    this.currentIndexSig.set(0);
    this.spotlightRectSig.set(null);
    this.tooltipStyleSig.set(DEFAULT_TOOLTIP_STYLE);
    this.clearPendingSyncHandles();

    this.log(reason === 'skip' ? 'tour:skip' : 'tour:complete', {
      tourId: activeTour.id,
      reason,
    });

    const callback = this.completionHandler;
    this.completionHandler = undefined;
    if (callback) {
      await callback(reason);
    }
  }

  private async syncCurrentStep(opts: { allowScroll: boolean }): Promise<void> {
    const state = this.state();
    const step = state.currentStep;
    if (!step) {
      return;
    }

    if (!step.target) {
      this.clearObservedTarget();
      this.spotlightRectSig.set(null);
      this.tooltipStyleSig.set(this.buildTooltipStyle(step.placement, null));
      this.log('tour:step', { stepId: step.id, target: null });
      return;
    }

    let target = this.findTarget(step.target);
    if (!target) {
      this.clearObservedTarget();
      this.spotlightRectSig.set(null);
      this.tooltipStyleSig.set(this.buildTooltipStyle('center', null));
      this.log('tour:target-missing', { stepId: step.id, target: step.target });
      return;
    }

    this.observeTarget(target);

    if (opts.allowScroll) {
      await this.scrollTargetIntoView(step.id, target);
      target = this.findTarget(step.target) ?? target;
      this.observeTarget(target);
    }

    const rect = this.toSpotlightRect(target.getBoundingClientRect());
    this.spotlightRectSig.set(rect);
    this.tooltipStyleSig.set(this.buildTooltipStyle(step.placement, rect));
    this.log('tour:step', { stepId: step.id, target: step.target });
  }

  private async runSync(opts: { allowScroll: boolean }): Promise<void> {
    if (this.syncInFlight) {
      this.syncQueued = true;
      return;
    }

    this.syncInFlight = true;
    try {
      await this.syncCurrentStep(opts);
    } finally {
      this.syncInFlight = false;
      if (this.syncQueued) {
        this.syncQueued = false;
        void this.runSync({ allowScroll: false });
      }
    }
  }

  private findTarget(targetId: string): HTMLElement | null {
    if (typeof document === 'undefined') {
      return null;
    }

    return document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
  }

  private toSpotlightRect(rect: DOMRect): TourSpotlightRect {
    const padding = 8;
    return {
      top: Math.max(8, rect.top - padding),
      left: Math.max(8, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
  }

  private async scrollTargetIntoView(
    stepId: string,
    target: HTMLElement
  ): Promise<void> {
    if (!this.content || typeof window === 'undefined') {
      return;
    }

    const rect = target.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const topMargin = 116;
    const bottomMargin = 180;
    let delta = 0;

    if (rect.top < topMargin) {
      delta = rect.top - topMargin;
    } else if (rect.bottom > viewportHeight - bottomMargin) {
      delta = rect.bottom - (viewportHeight - bottomMargin);
    }

    if (!delta) {
      return;
    }

    const scrollEl = await this.content.getScrollElement();
    const nextTop = Math.max(0, scrollEl.scrollTop + delta);
    this.log('tour:scroll', { stepId, delta, nextTop });
    await this.content.scrollToPoint(0, nextTop, 250);
    await this.delay(280);
  }

  private buildTooltipStyle(
    placement: TourPlacement | undefined,
    rect: TourSpotlightRect | null
  ): TourTooltipStyle {
    if (typeof window === 'undefined' || !rect || placement === 'center') {
      return DEFAULT_TOOLTIP_STYLE;
    }

    const viewportWidth = window.innerWidth;
    const width = Math.min(320, viewportWidth - 24);
    const centerX = this.clamp(
      rect.left + rect.width / 2,
      width / 2 + 12,
      viewportWidth - width / 2 - 12
    );
    const centerY = rect.top + rect.height / 2;

    switch (placement) {
      case 'top':
        return {
          top: `${Math.max(16, rect.top - 12)}px`,
          left: `${centerX}px`,
          transform: 'translate(-50%, -100%)',
          width: `${width}px`,
        };
      case 'left':
        return {
          top: `${centerY}px`,
          left: `${Math.max(16, rect.left - 12)}px`,
          transform: 'translate(-100%, -50%)',
          width: `${width}px`,
        };
      case 'right':
        return {
          top: `${centerY}px`,
          left: `${Math.min(viewportWidth - 16, rect.left + rect.width + 12)}px`,
          transform: 'translate(0, -50%)',
          width: `${width}px`,
        };
      case 'bottom':
      default:
        return {
          top: `${Math.min(
            window.innerHeight - 16,
            rect.top + rect.height + 12
          )}px`,
          left: `${centerX}px`,
          transform: 'translate(-50%, 0)',
          width: `${width}px`,
        };
    }
  }

  private attachWindowListeners(): void {
    if (typeof window === 'undefined' || this.resizeHandler) {
      return;
    }

    this.resizeHandler = () => this.requestSync();
    window.addEventListener('resize', this.resizeHandler, { passive: true });
    window.addEventListener('orientationchange', this.resizeHandler, {
      passive: true,
    });
  }

  private detachWindowListeners(): void {
    if (typeof window === 'undefined' || !this.resizeHandler) {
      return;
    }

    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('orientationchange', this.resizeHandler);
    this.resizeHandler = undefined;
  }

  private clearPendingSyncHandles(): void {
    if (typeof window !== 'undefined' && this.syncRafId != null) {
      window.cancelAnimationFrame(this.syncRafId);
    }
    this.syncRafId = null;

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.mutationObservedRoot = null;

    this.clearObservedTarget();

    if (this.targetResizeObserver) {
      this.targetResizeObserver.disconnect();
      this.targetResizeObserver = null;
    }
  }

  private async ensureMutationObserver(): Promise<void> {
    if (typeof MutationObserver === 'undefined') {
      return;
    }

    const root = await this.getMutationRoot();
    if (!root) {
      return;
    }

    if (!this.mutationObserver) {
      this.mutationObserver = new MutationObserver(() => this.requestSync());
    }

    if (this.mutationObservedRoot === root) {
      return;
    }

    this.mutationObserver.disconnect();
    this.mutationObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    this.mutationObservedRoot = root;
  }

  private async getMutationRoot(): Promise<Node | null> {
    if (typeof document === 'undefined') {
      return null;
    }
    // Observe global app root so ion-modal/overlays (mounted outside ion-content)
    // also trigger tour re-sync.
    return document.body;
  }

  private observeTarget(target: HTMLElement): void {
    if (this.observedTarget === target) {
      return;
    }

    if (this.targetResizeObserver && this.observedTarget) {
      this.targetResizeObserver.unobserve(this.observedTarget);
    }

    this.observedTarget = target;

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    if (!this.targetResizeObserver) {
      this.targetResizeObserver = new ResizeObserver(() => this.requestSync());
    }

    this.targetResizeObserver.observe(target);
  }

  private clearObservedTarget(): void {
    if (this.targetResizeObserver && this.observedTarget) {
      this.targetResizeObserver.unobserve(this.observedTarget);
    }
    this.observedTarget = null;
  }

  private async waitForLayout(): Promise<void> {
    if (typeof requestAnimationFrame !== 'function') {
      await this.delay(48);
      return;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private log(event: string, payload?: Record<string, unknown>): void {
    if (!isDevMode()) {
      return;
    }

    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[ccfk-tour] ${event}${suffix}`);
  }
}
