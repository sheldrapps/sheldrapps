import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  ElementRef,
  Input,
  Output,
  OnInit,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { SettingsStore } from '@sheldrapps/settings-kit';
import {
  EReaderBrand,
  EReaderColorId,
  EReaderFrameColorPreset,
  E_READER_FRAME_COLOR_PRESETS,
  E_READER_FRAME_DEFAULT_BY_BRAND,
} from '../../e-reader-preview/e-reader-frame-colors';
import { ImageWorkflowI18nService } from '../../e-reader-preview/i18n/image-workflow-i18n.service';

export type EReaderPreviewMode = 'single' | 'compare';
export type EReaderPreviewFit = 'contain' | 'cover';
export type EReaderRenderMode = 'normal' | 'eReader';
export type EReaderFrameMarginMode = 'px' | 'ratio';

export interface EReaderFrameMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type PreviewPanel = {
  id: string;
  src: string;
  label?: string;
  alt: string;
};

type PanelDimensions = {
  width: number;
  height: number;
};

type PanelMetrics = {
  frameWidth: number;
  frameHeight: number;
  screenWidth: number;
  screenHeight: number;
  frameTop: number;
  frameRight: number;
  frameBottom: number;
  frameLeft: number;
};

type GesturePoint = {
  x: number;
  y: number;
};

type PanBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const LEGACY_COLOR_ID_MAP: Record<string, EReaderColorId> = {
  'kindle-black': 'black',
  'kobo-black': 'black',
  'generic-black': 'black',
  'kobo-white': 'white',
  'generic-white': 'white',
  'kindle-matcha': 'matcha',
  'kindle-jade': 'jade',
  'kindle-raspberry': 'pink',
  'kindle-metallic-black': 'metallic-black',
  'kindle-metallic-jade': 'metallic-jade',
  'kindle-metallic-raspberry': 'metallic-pink',
  'generic-warm-gray': 'matcha',
};

@Component({
  selector: 'app-e-reader-preview-frame',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './e-reader-preview-frame.component.html',
  styleUrls: ['./e-reader-preview-frame.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EReaderPreviewFrameComponent
  implements OnInit, AfterViewInit, OnChanges, OnDestroy
{
  private static readonly ZOOM_MIN = 1;
  private static readonly ZOOM_MAX = 3;
  private static readonly ZOOM_STEP = 0.25;
  private static readonly DEFAULT_MAX_FRAME_WIDTH = 320;
  private static readonly DEFAULT_MAX_FRAME_HEIGHT = 520;
  private static readonly DEFAULT_FRAME_MARGINS_RATIO: EReaderFrameMargins = {
    top: 0.13,
    right: 0.11,
    bottom: 0.24,
    left: 0.11,
  };
  private static readonly DEFAULT_FRAME_MARGINS_PX: EReaderFrameMargins = {
    top: 44,
    right: 32,
    bottom: 72,
    left: 32,
  };
  private static readonly FALLBACK_DIMENSIONS: PanelDimensions = {
    width: 3,
    height: 4,
  };
  private static readonly DEFAULT_FRAME_COLOR_STORAGE_KEY =
    'preview.eReaderFrameColorId';

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly imageWorkflowI18n = inject(ImageWorkflowI18nService);
  private readonly settingsStore = inject<
    SettingsStore<Record<string, unknown>> | null
  >(SettingsStore as any, { optional: true });
  private panelResizeObserver?: ResizeObserver;
  private panelRefsSub?: Subscription;
  private readonly panelWidths = new Map<string, number>();
  private readonly loadedImageSizes = new Map<string, PanelDimensions>();
  private readonly activePointers = new Map<number, GesturePoint>();
  private pinchStartDistance = 0;
  private pinchStartZoom = EReaderPreviewFrameComponent.ZOOM_MIN;
  private isPanning = false;
  private lastPanPoint: GesturePoint | null = null;
  private panX = 0;
  private panY = 0;

  @ViewChildren('panelRef')
  private readonly panelRefs?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('visualViewport')
  private readonly visualViewportRefs?: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('gestureViewport')
  private readonly gestureViewportRef?: ElementRef<HTMLElement>;
  @ViewChild('gestureSurface')
  private readonly gestureSurfaceRef?: ElementRef<HTMLElement>;

  @Input() imageSrc: string | null = null;
  @Input() alt = 'cover preview';
  @Input() mode: EReaderPreviewMode = 'single';
  @Input() fit: EReaderPreviewFit = 'contain';
  @Input() label?: string | null;
  @Input() beforeSrc?: string | null;
  @Input() afterSrc?: string | null;
  @Input() beforeLabel?: string | null;
  @Input() afterLabel?: string | null;
  @Input() zoomEnabled = false;
  @Input() comparisonEnabled = true;
  @Input() frameEnabled = true;
  @Input() renderMode: EReaderRenderMode = 'normal';
  @Input() isDithered = false;
  @Input() imageWidth?: number | null;
  @Input() imageHeight?: number | null;
  @Input() maxFrameWidth?: number | null;
  @Input() maxFrameHeight?: number | null;
  @Input() frameMargins?: Partial<EReaderFrameMargins> | null;
  @Input() frameMarginMode: EReaderFrameMarginMode = 'ratio';
  @Input() zoomOutAriaLabel = 'Zoom out preview';
  @Input() zoomInAriaLabel = 'Zoom in preview';
  @Input() zoomResetAriaLabel = 'Reset preview zoom';
  @Input() frameColorBrand: EReaderBrand = 'kindle';
  @Input() frameColorId: EReaderColorId | null = null;
  @Input() frameColorStorageKey =
    EReaderPreviewFrameComponent.DEFAULT_FRAME_COLOR_STORAGE_KEY;
  @Input() colorSelectorTitleKey = 'E_READER_FRAME.COLOR_SELECTOR.TITLE';
  @Output() frameColorIdChange = new EventEmitter<EReaderColorId>();

  zoom = EReaderPreviewFrameComponent.ZOOM_MIN;
  colorSelectorOpen = false;
  selectedFrameColorId: EReaderColorId = 'black';

  ngOnInit(): void {
    this.selectedFrameColorId = this.resolveInitialFrameColorId();
    void this.hydrateFrameColorFromSettings();
  }

  ngAfterViewInit(): void {
    this.bindPanelObservers();
    this.panelRefsSub = this.panelRefs?.changes.subscribe(() =>
      this.bindPanelObservers(),
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['frameColorId']) {
      const next = this.normalizeFrameColorId(this.frameColorId);
      if (next) {
        this.selectedFrameColorId = next;
        void this.persistFrameColorId(next);
      }
    }

    if (
      changes['imageSrc'] ||
      changes['beforeSrc'] ||
      changes['afterSrc'] ||
      changes['mode'] ||
      changes['comparisonEnabled']
    ) {
      this.resetZoom();
      this.loadedImageSizes.clear();
      this.panelWidths.clear();
    }
  }

  ngOnDestroy(): void {
    this.panelResizeObserver?.disconnect();
    this.panelRefsSub?.unsubscribe();
  }

  get panels(): PreviewPanel[] {
    const comparePanels = this.buildComparePanels();
    if (comparePanels.length > 0) {
      return comparePanels;
    }
    return this.buildSinglePanels();
  }

  get hasContent(): boolean {
    return this.panels.length > 0;
  }

  get isCompareLayout(): boolean {
    return this.panels.length > 1;
  }

  get coverClassNames(): Record<string, boolean> {
    return {
      'ereader-preview__cover--contain': this.fit === 'contain',
      'ereader-preview__cover--cover': this.fit === 'cover',
      'ereader-preview__cover--ereader': this.renderMode === 'eReader',
      'ereader-preview__cover--dithered':
        this.renderMode === 'eReader' && this.isDithered,
      'ereader-preview__cover--dithered-zoomed':
        this.renderMode === 'eReader' && this.isDithered && this.zoom > 1,
    };
  }

  get selectedFramePreset(): EReaderFrameColorPreset {
    return this.findFramePreset(this.selectedFrameColorId);
  }

  get frameColorOptions(): EReaderFrameColorPreset[] {
    return E_READER_FRAME_COLOR_PRESETS;
  }

  get selectedFrameColorLabelKey(): string {
    return this.selectedFramePreset.i18nKey;
  }

  get showFrameColorSelector(): boolean {
    return this.frameEnabled && this.renderMode === 'eReader';
  }

  get frameColorSwatchStyle(): Record<string, string> {
    return {
      backgroundColor: this.selectedFramePreset.swatch,
    };
  }

  get zoomText(): string {
    return `${Math.round(this.zoom * 100)}%`;
  }

  get canZoomOut(): boolean {
    return this.zoom > EReaderPreviewFrameComponent.ZOOM_MIN;
  }

  get canZoomIn(): boolean {
    return this.zoom < EReaderPreviewFrameComponent.ZOOM_MAX;
  }

  trackPanel(_index: number, panel: PreviewPanel): string {
    return panel.id;
  }

  zoomOut(): void {
    if (!this.canZoomOut) {
      return;
    }
    this.zoom = this.clampZoom(
      this.zoom - EReaderPreviewFrameComponent.ZOOM_STEP,
    );
    this.normalizePanWithinBounds();
  }

  zoomIn(): void {
    if (!this.canZoomIn) {
      return;
    }
    this.zoom = this.clampZoom(
      this.zoom + EReaderPreviewFrameComponent.ZOOM_STEP,
    );
    this.normalizePanWithinBounds();
  }

  resetZoom(): void {
    this.zoom = EReaderPreviewFrameComponent.ZOOM_MIN;
    this.resetPan();
  }

  getCompareStyle(): Record<string, string> {
    const pan = this.getClampedPan();
    return {
      '--preview-pan-x': `${pan.x}px`,
      '--preview-pan-y': `${pan.y}px`,
    };
  }

  getPanelStyle(panel: PreviewPanel): Record<string, string> {
    const metrics = this.buildPanelMetrics(panel);
    return {
      '--frame-width': `${metrics.frameWidth}px`,
      '--frame-height': `${metrics.frameHeight}px`,
      '--visual-frame-width': `${metrics.frameWidth * this.zoom}px`,
      '--visual-frame-height': `${metrics.frameHeight * this.zoom}px`,
      '--screen-width': `${metrics.screenWidth}px`,
      '--screen-height': `${metrics.screenHeight}px`,
      '--frame-top': `${metrics.frameTop}px`,
      '--frame-right': `${metrics.frameRight}px`,
      '--frame-bottom': `${metrics.frameBottom}px`,
      '--frame-left': `${metrics.frameLeft}px`,
      '--preview-zoom': String(this.zoom),
    };
  }

  getDeviceStyle(): Record<string, string> {
    const preset = this.selectedFramePreset;
    return {
      '--ereader-frame-base': preset.frameBase,
      '--ereader-frame-mid': preset.frameMid,
      '--ereader-frame-dark': preset.frameDark,
      '--ereader-frame-light': preset.frameLight,
      '--ereader-frame-stroke-outer': preset.strokeOuter,
      '--ereader-frame-stroke-inner': preset.strokeInner,
      '--ereader-screen-border': preset.screenBorder,
      '--ereader-frame-metallic-opacity': preset.metallic ? '0.32' : '0',
    };
  }

  toggleColorSelector(): void {
    this.colorSelectorOpen = !this.colorSelectorOpen;
  }

  closeColorSelector(): void {
    this.colorSelectorOpen = false;
  }

  selectFrameColor(colorId: EReaderColorId): void {
    if (this.selectedFrameColorId === colorId) {
      this.colorSelectorOpen = false;
      return;
    }
    this.selectedFrameColorId = colorId;
    void this.persistFrameColorId(colorId);
    this.frameColorIdChange.emit(colorId);
    this.colorSelectorOpen = false;
  }

  isSelectedFrameColor(colorId: EReaderColorId): boolean {
    return this.selectedFrameColorId === colorId;
  }

  onImageLoad(panel: PreviewPanel, event: Event): void {
    const target = event.target as HTMLImageElement | null;
    const naturalWidth = target?.naturalWidth ?? 0;
    const naturalHeight = target?.naturalHeight ?? 0;
    if (!naturalWidth || !naturalHeight) {
      return;
    }
    this.loadedImageSizes.set(panel.id, {
      width: naturalWidth,
      height: naturalHeight,
    });
    this.cdr.markForCheck();
  }

  onImageError(panel: PreviewPanel): void {
    console.warn('[E_READER_PREVIEW_IMAGE_ERROR]', {
      panelId: panel.id,
      mode: this.mode,
      src: panel.src,
    });
  }

  onGesturePointerDown(event: PointerEvent): void {
    if (!this.zoomEnabled || !this.hasContent) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.activePointers.set(event.pointerId, this.toGesturePoint(event));
    (
      event.currentTarget as HTMLElement | null
    )?.setPointerCapture?.(event.pointerId);

    if (this.activePointers.size >= 2) {
      this.initializePinchGesture();
      this.isPanning = false;
      this.lastPanPoint = null;
      event.preventDefault();
      return;
    }

    if (this.zoom > EReaderPreviewFrameComponent.ZOOM_MIN) {
      this.isPanning = true;
      this.lastPanPoint = this.toGesturePoint(event);
      event.preventDefault();
    }
  }

  onGesturePointerMove(event: PointerEvent): void {
    if (!this.zoomEnabled || !this.activePointers.has(event.pointerId)) {
      return;
    }

    this.activePointers.set(event.pointerId, this.toGesturePoint(event));

    if (this.activePointers.size >= 2) {
      const distance = this.getPointerDistance();
      if (!distance || !this.pinchStartDistance) {
        return;
      }

      this.zoom = this.clampZoom(
        this.pinchStartZoom * (distance / this.pinchStartDistance),
      );
      this.normalizePanWithinBounds();
      event.preventDefault();
      this.cdr.markForCheck();
      return;
    }

    if (!this.isPanning || !this.lastPanPoint) {
      return;
    }

    const nextPoint = this.toGesturePoint(event);
    this.panX += nextPoint.x - this.lastPanPoint.x;
    this.panY += nextPoint.y - this.lastPanPoint.y;
    this.lastPanPoint = nextPoint;
    this.normalizePanWithinBounds();
    event.preventDefault();
    this.cdr.markForCheck();
  }

  onGesturePointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);
    (
      event.currentTarget as HTMLElement | null
    )?.releasePointerCapture?.(event.pointerId);

    if (this.activePointers.size >= 2) {
      this.initializePinchGesture();
      return;
    }

    if (this.activePointers.size === 1 && this.zoom > EReaderPreviewFrameComponent.ZOOM_MIN) {
      const remainingPoint = Array.from(this.activePointers.values())[0] ?? null;
      this.isPanning = true;
      this.lastPanPoint = remainingPoint;
      return;
    }

    this.isPanning = false;
    this.lastPanPoint = null;
    this.pinchStartDistance = 0;
  }

  private bindPanelObservers(): void {
    this.panelResizeObserver?.disconnect();
    this.panelResizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver((entries) => {
            for (const entry of entries) {
              const panelId = (entry.target as HTMLElement).dataset['panelId'];
              if (!panelId) {
                continue;
              }
              this.panelWidths.set(
                panelId,
                Math.max(0, Math.floor(entry.contentRect.width)),
              );
            }
            this.cdr.markForCheck();
          });

    for (const panelRef of this.panelRefs?.toArray() ?? []) {
      this.panelResizeObserver?.observe(panelRef.nativeElement);
      const panelId = panelRef.nativeElement.dataset['panelId'];
      if (panelId) {
        this.panelWidths.set(
          panelId,
          Math.max(0, Math.floor(panelRef.nativeElement.clientWidth)),
        );
      }
    }
    this.cdr.markForCheck();
  }

  private initializePinchGesture(): void {
    const distance = this.getPointerDistance();
    if (!distance) {
      return;
    }
    this.pinchStartDistance = distance;
    this.pinchStartZoom = this.zoom;
  }

  private buildComparePanels(): PreviewPanel[] {
    if (this.mode !== 'compare' || !this.comparisonEnabled) {
      return [];
    }

    const panels: PreviewPanel[] = [];
    const beforeSrc = this.normalizeSrc(this.beforeSrc);
    const afterSrc = this.normalizeSrc(this.afterSrc ?? this.imageSrc);

    if (beforeSrc) {
      panels.push({
        id: 'before',
        src: beforeSrc,
        label: this.beforeLabel ?? undefined,
        alt: this.resolveAlt(this.beforeLabel),
      });
    }

    if (afterSrc) {
      panels.push({
        id: 'after',
        src: afterSrc,
        label: this.afterLabel ?? this.label ?? undefined,
        alt: this.resolveAlt(this.afterLabel ?? this.label),
      });
    }

    return panels;
  }

  private buildSinglePanels(): PreviewPanel[] {
    const src =
      this.normalizeSrc(this.imageSrc) ??
      this.normalizeSrc(this.afterSrc) ??
      this.normalizeSrc(this.beforeSrc);
    if (!src) {
      return [];
    }

    return [
      {
        id: 'single',
        src,
        label: this.label ?? undefined,
        alt: this.resolveAlt(this.label),
      },
    ];
  }

  private buildPanelMetrics(panel: PreviewPanel): PanelMetrics {
    const dimensions = this.resolvePanelDimensions(panel);
    const margins = this.resolveMargins();
    const maxFrameWidth = this.resolveMaxFrameWidth(panel.id);
    const maxFrameHeight = this.resolveMaxFrameHeight();

    const rawScreen =
      this.frameMarginMode === 'px'
        ? this.computeScreenSizeWithPixelMargins(
            dimensions,
            margins,
            maxFrameWidth,
            maxFrameHeight,
          )
        : this.computeScreenSizeWithRatioMargins(
            dimensions,
            margins,
            maxFrameWidth,
            maxFrameHeight,
          );

    const frameTop =
      this.frameMarginMode === 'px'
        ? margins.top
        : rawScreen.height * margins.top;
    const frameRight =
      this.frameMarginMode === 'px'
        ? margins.right
        : rawScreen.width * margins.right;
    const frameBottom =
      this.frameMarginMode === 'px'
        ? margins.bottom
        : rawScreen.height * margins.bottom;
    const frameLeft =
      this.frameMarginMode === 'px'
        ? margins.left
        : rawScreen.width * margins.left;

    return {
      screenWidth: rawScreen.width,
      screenHeight: rawScreen.height,
      frameTop,
      frameRight,
      frameBottom,
      frameLeft,
      frameWidth: rawScreen.width + frameLeft + frameRight,
      frameHeight: rawScreen.height + frameTop + frameBottom,
    };
  }

  private computeScreenSizeWithRatioMargins(
    dimensions: PanelDimensions,
    margins: EReaderFrameMargins,
    maxFrameWidth: number,
    maxFrameHeight: number,
  ): PanelDimensions {
    const screenMaxWidth = maxFrameWidth / (1 + margins.left + margins.right);
    const screenMaxHeight = maxFrameHeight / (1 + margins.top + margins.bottom);
    return this.fitDimensions(dimensions, screenMaxWidth, screenMaxHeight);
  }

  private computeScreenSizeWithPixelMargins(
    dimensions: PanelDimensions,
    margins: EReaderFrameMargins,
    maxFrameWidth: number,
    maxFrameHeight: number,
  ): PanelDimensions {
    const screenMaxWidth = Math.max(
      1,
      maxFrameWidth - margins.left - margins.right,
    );
    const screenMaxHeight = Math.max(
      1,
      maxFrameHeight - margins.top - margins.bottom,
    );
    return this.fitDimensions(dimensions, screenMaxWidth, screenMaxHeight);
  }

  private fitDimensions(
    dimensions: PanelDimensions,
    maxWidth: number,
    maxHeight: number,
  ): PanelDimensions {
    const safeWidth = Math.max(1, dimensions.width);
    const safeHeight = Math.max(1, dimensions.height);
    const imageRatio = safeWidth / safeHeight;
    const maxRatio = maxWidth / maxHeight;

    if (!Number.isFinite(imageRatio) || imageRatio <= 0) {
      return {
        width: this.roundDimension(maxWidth),
        height: this.roundDimension(maxHeight),
      };
    }

    if (imageRatio > maxRatio) {
      return {
        width: this.roundDimension(maxWidth),
        height: this.roundDimension(maxWidth / imageRatio),
      };
    }

    return {
      width: this.roundDimension(maxHeight * imageRatio),
      height: this.roundDimension(maxHeight),
    };
  }

  private resolvePanelDimensions(panel: PreviewPanel): PanelDimensions {
    if (this.mode === 'compare' && this.comparisonEnabled) {
      return this.resolveCompareTargetDimensions();
    }

    const loaded = this.loadedImageSizes.get(panel.id);
    if (loaded) {
      return loaded;
    }

    if (
      panel.id !== 'before' &&
      Number.isFinite(this.imageWidth) &&
      Number.isFinite(this.imageHeight) &&
      (this.imageWidth as number) > 0 &&
      (this.imageHeight as number) > 0
    ) {
      return {
        width: this.imageWidth as number,
        height: this.imageHeight as number,
      };
    }

    return EReaderPreviewFrameComponent.FALLBACK_DIMENSIONS;
  }

  private resolveCompareTargetDimensions(): PanelDimensions {
    if (
      Number.isFinite(this.imageWidth) &&
      Number.isFinite(this.imageHeight) &&
      (this.imageWidth as number) > 0 &&
      (this.imageHeight as number) > 0
    ) {
      return {
        width: this.imageWidth as number,
        height: this.imageHeight as number,
      };
    }

    const afterLoaded = this.loadedImageSizes.get('after');
    if (afterLoaded) {
      return afterLoaded;
    }

    const singleLoaded = this.loadedImageSizes.get('single');
    if (singleLoaded) {
      return singleLoaded;
    }

    return EReaderPreviewFrameComponent.FALLBACK_DIMENSIONS;
  }

  private resolveMaxFrameWidth(panelId: string): number {
    const preferred =
      this.maxFrameWidth ?? EReaderPreviewFrameComponent.DEFAULT_MAX_FRAME_WIDTH;
    const available = this.panelWidths.get(panelId);
    if (available && available > 0) {
      return Math.max(1, Math.min(preferred, available));
    }
    return Math.max(1, preferred);
  }

  private resolveMaxFrameHeight(): number {
    const preferred =
      this.maxFrameHeight ??
      EReaderPreviewFrameComponent.DEFAULT_MAX_FRAME_HEIGHT;
    if (typeof window !== 'undefined' && Number.isFinite(window.innerHeight)) {
      return Math.max(1, Math.min(preferred, Math.floor(window.innerHeight * 0.58)));
    }
    return Math.max(1, preferred);
  }

  private resolveMargins(): EReaderFrameMargins {
    const base =
      this.frameMarginMode === 'px'
        ? EReaderPreviewFrameComponent.DEFAULT_FRAME_MARGINS_PX
        : EReaderPreviewFrameComponent.DEFAULT_FRAME_MARGINS_RATIO;

    if (!this.frameEnabled) {
      return {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      };
    }

    return {
      top: this.normalizeMarginValue(this.frameMargins?.top, base.top),
      right: this.normalizeMarginValue(this.frameMargins?.right, base.right),
      bottom: this.normalizeMarginValue(this.frameMargins?.bottom, base.bottom),
      left: this.normalizeMarginValue(this.frameMargins?.left, base.left),
    };
  }

  private normalizeMarginValue(
    value: number | undefined,
    fallback: number,
  ): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(0, value as number);
  }

  private resolveAlt(label?: string | null): string {
    const candidate = label?.trim();
    if (candidate) {
      return candidate;
    }

    const fallback = this.alt?.trim();
    return fallback || 'cover preview';
  }

  private normalizeSrc(src?: string | null): string | null {
    const value = src?.trim();
    return value ? value : null;
  }

  private resolveInitialFrameColorId(): EReaderColorId {
    const explicit = this.normalizeFrameColorId(this.frameColorId);
    if (explicit) {
      return explicit;
    }

    return E_READER_FRAME_DEFAULT_BY_BRAND[this.frameColorBrand] ?? 'black';
  }

  private normalizeFrameColorId(
    value?: EReaderColorId | string | null,
  ): EReaderColorId | null {
    if (!value) {
      return null;
    }
    const legacyNormalized = String(value).trim();
    const normalized =
      LEGACY_COLOR_ID_MAP[legacyNormalized] ??
      (legacyNormalized as EReaderColorId);
    return E_READER_FRAME_COLOR_PRESETS.some((preset) => preset.id === normalized)
      ? normalized
      : null;
  }

  private async hydrateFrameColorFromSettings(): Promise<void> {
    const persisted = await this.readPersistedFrameColorId();
    if (!persisted || persisted === this.selectedFrameColorId) {
      return;
    }
    this.selectedFrameColorId = persisted;
    this.cdr.markForCheck();
  }

  private async readPersistedFrameColorId(): Promise<EReaderColorId | null> {
    if (!this.settingsStore) {
      return null;
    }

    try {
      await this.settingsStore.load();
      const snapshot = this.settingsStore.get();
      const value = snapshot[this.frameColorStorageKey];
      return typeof value === 'string'
        ? this.normalizeFrameColorId(value)
        : null;
    } catch {
      return null;
    }
  }

  private async persistFrameColorId(colorId: EReaderColorId): Promise<void> {
    if (!this.settingsStore) {
      return;
    }

    try {
      await this.settingsStore.load();
      await this.settingsStore.set((prev) => ({
        ...prev,
        [this.frameColorStorageKey]: colorId,
      }));
    } catch {
      // ignore persistence failures
    }
  }

  private findFramePreset(colorId: EReaderColorId): EReaderFrameColorPreset {
    return (
      E_READER_FRAME_COLOR_PRESETS.find((preset) => preset.id === colorId) ??
      E_READER_FRAME_COLOR_PRESETS[0]
    );
  }

  private clampZoom(value: number): number {
    return Math.max(
      EReaderPreviewFrameComponent.ZOOM_MIN,
      Math.min(EReaderPreviewFrameComponent.ZOOM_MAX, Number(value.toFixed(2))),
    );
  }

  private roundDimension(value: number): number {
    return Math.max(1, Number(value.toFixed(2)));
  }

  private getPointerDistance(): number | null {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) {
      return null;
    }

    const [first, second] = pointers;
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  private toGesturePoint(event: PointerEvent): GesturePoint {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  private normalizePanWithinBounds(): void {
    const pan = this.getClampedPan();
    this.panX = pan.x;
    this.panY = pan.y;

    if (this.zoom <= EReaderPreviewFrameComponent.ZOOM_MIN) {
      this.resetPan();
    }
  }

  private getClampedPan(): GesturePoint {
    if (this.zoom <= EReaderPreviewFrameComponent.ZOOM_MIN) {
      return { x: 0, y: 0 };
    }

    const bounds = this.getPanBounds();
    return {
      x: this.clampPanAxis(this.panX, bounds.minX, bounds.maxX),
      y: this.clampPanAxis(this.panY, bounds.minY, bounds.maxY),
    };
  }

  private getPanBounds(): PanBounds {
    const viewport = this.gestureViewportRef?.nativeElement;
    const surface = this.gestureSurfaceRef?.nativeElement;
    const visualViewports = this.visualViewportRefs?.toArray() ?? [];
    if (!viewport || !surface || visualViewports.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    const surfaceRect = surface.getBoundingClientRect();
    let minLeft = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    for (const viewportRef of visualViewports) {
      const rect = viewportRef.nativeElement.getBoundingClientRect();
      minLeft = Math.min(minLeft, rect.left - surfaceRect.left);
      maxRight = Math.max(maxRight, rect.right - surfaceRect.left);
      minTop = Math.min(minTop, rect.top - surfaceRect.top);
      maxBottom = Math.max(maxBottom, rect.bottom - surfaceRect.top);
    }

    const contentWidth = Math.max(0, maxRight - minLeft);
    const contentHeight = Math.max(0, maxBottom - minTop);
    const minX =
      contentWidth > viewport.clientWidth
        ? viewport.clientWidth - maxRight
        : 0;
    const maxX = contentWidth > viewport.clientWidth ? -minLeft : 0;
    const minY =
      contentHeight > viewport.clientHeight
        ? viewport.clientHeight - maxBottom
        : 0;
    const maxY = contentHeight > viewport.clientHeight ? -minTop : 0;

    return {
      minX,
      maxX,
      minY,
      maxY,
    };
  }

  private clampPanAxis(value: number, minOffset: number, maxOffset: number): number {
    return Math.max(
      Number(minOffset.toFixed(2)),
      Math.min(Number(maxOffset.toFixed(2)), Number(value.toFixed(2))),
    );
  }

  private resetPan(): void {
    this.panX = 0;
    this.panY = 0;
  }
}
