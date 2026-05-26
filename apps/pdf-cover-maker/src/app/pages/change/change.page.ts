import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter, firstValueFrom } from 'rxjs';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Device } from '@capacitor/device';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonModal,
  IonGrid,
  IonCol,
  IonRow,
  IonPopover,
  ToastController,
  PopoverController,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

import {
  buildDefaultCoverCropState,
  CoverCropState,
  EReaderPreviewFrameComponent,
  ImagePipelineService,
  ImageValidationError,
  buildCompositionInputForPurpose,
  computeSourceCropDims,
  isArtifactReductionEnabled,
  isDitheringEnabled,
  renderCompositionToCanvas,
  renderCompositionToFile,
  resolveArtifactReductionMode,
  resolveCoverColorMode,
} from '@sheldrapps/image-workflow';
import type { CropTarget, CropFormatOption } from '@sheldrapps/image-workflow';
import {
  EditorSessionService,
  EDITOR_EREADER_OPTIMIZATION_PREF_KEY,
} from '@sheldrapps/image-workflow/editor';

import {
  imageOutline,
  alertCircleOutline,
  checkmarkCircle,
  saveOutline,
  shareSocialOutline,
  closeCircleOutline,
  helpCircleOutline,
  documentOutline,
  refreshOutline,
  appsOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

import {
  CoverProcessingMetadataInput,
  FileService,
} from '../../services/file.service';
import {
  DEFAULT_EXPORT_QUALITY_MODE,
  ExportQualitySelectorComponent,
  getCoverExportOptions,
  normalizeExportQualityMode,
  type ExportQualityMode,
} from '@sheldrapps/export-quality-kit';
import {
  CoverPageMode,
  CoverPageModeSwitchComponent,
} from '@sheldrapps/cover-page-mode-kit';
import { PdfWorkingCopyService } from '../../services/pdf-working-copy.service';
import {
  AdsService,
  BillingService,
  type RewardedAdResult,
} from '../../services/ads.service';
import { CoversEventsService } from '../../services/covers-events.service';
import {
  PdfRewriteError,
  PdfRewriteService,
} from '../../services/pdf-rewrite.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastOptions } from '@ionic/angular';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { detectSupportedLocale } from '@sheldrapps/i18n-kit';
import { RatingService } from '@sheldrapps/rating-kit';
import {
  LoadingStateComponent,
  SaveCoverModalComponent,
  ScrollableBarItem,
  ScrollableButtonBarComponent,
} from '@sheldrapps/ui-theme';
import {
  BestCandidateImage,
  BestCandidatePickerComponent,
  BestCandidateResult,
  BestCandidateService,
} from '@sheldrapps/best-candidate-kit';
import {
  RecommendedApp,
  RecommendedAppsService,
  buildHomeHeaderItems,
  handleHomeHeaderAction,
} from '@sheldrapps/recommended-apps';
import { PcmSettings } from '../../settings/pcm-settings.schema';
import { PdfCandidateImageService } from '../../services/pdf-candidate-image.service';
import { TourOverlayComponent } from '../../shared/tour/tour-overlay.component';
import { TourService } from '../../shared/tour/tour.service';
import {
  buildHomeTourDefinition,
  CURRENT_HOME_TOUR_VERSION,
  HOME_TOUR_ID,
} from '../../shared/tour/home-tour.definition';
import type { TourCompletionReason } from '../../shared/tour/tour.types';

type EditorResult = {
  file: File;
  state?: CoverCropState;
  formatId?: string;
  renderedBlob?: Blob;
  renderedWidth?: number;
  renderedHeight?: number;
  renderedMimeType?: string;
};

type FrameDetectionResult = {
  hasFrame: boolean;
};

@Component({
  selector: 'app-change',
  templateUrl: './change.page.html',
  styleUrls: ['./change.page.scss'],
  standalone: true,
  imports: [
    IonCol,
    CommonModule,
    FormsModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonItem,
    IonLabel,
    IonIcon,
    IonButton,
    IonRow,
    IonGrid,
    IonPopover,
    IonModal,
    LoadingStateComponent,
    EReaderPreviewFrameComponent,
    ScrollableButtonBarComponent,
    ExportQualitySelectorComponent,
    CoverPageModeSwitchComponent,
    BestCandidatePickerComponent,
    TourOverlayComponent,
  ],
})
export class ChangePage implements OnInit, OnDestroy {
  private static readonly PREVIEW_MAX_SIDE = 1280;
  private static readonly THUMB_SIZE = 96;
  private static readonly FORMAT_ID_WITH_FRAME = 'with_frame';
  private static readonly FORMAT_ID_WITHOUT_FRAME = 'without_frame';
  private modalCtrl = inject(ModalController);
  private fileService = inject(FileService);
  private workingCopy = inject(PdfWorkingCopyService);
  private pdfRewrite = inject(PdfRewriteService);
  private imagePipe = inject(ImagePipelineService);
  private ads = inject(AdsService);
  private billing = inject(BillingService);
  private toastCtrl = inject(ToastController);
  private popoverCtrl = inject(PopoverController);
  private coversEvents = inject(CoversEventsService);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);
  private router = inject(Router);
  private editorSession = inject(EditorSessionService);
  private settings = inject(SettingsStore<PcmSettings>);
  private ratingService = inject(RatingService);
  private recommendedAppsService = inject(RecommendedAppsService);
  private bestCandidateService = inject(BestCandidateService);
  private candidateImageService = inject(PdfCandidateImageService);
  private homeTour = inject(TourService);
  private readonly baseTarget = { width: 1236, height: 1648 };
  private readonly baseModelId = 'pdf';
  private readonly maxPdfSizeMB = 5120;
  private routerSub?: Subscription;
  private coversEventsSub?: Subscription;
  private rewriteProgressSub?: PluginListenerHandle;
  private lastEditorSessionId?: string;
  private previewLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressNextImagePick = false;
  private workingMaxSideApplied: boolean | null = null;
  private persistedCropTargetId = 'pdf';
  private readonly warnDebugKey = 'cc_warn_debug';
  private readonly editorTourSeenVersionKey = 'pcm_editor_tour_seen_version';
  private readonly artifactReductionInfoSeenKey =
    'pcm_editor_artifact_reduction_info_seen';
  private readonly editorEReaderOptimizationFeatureEnabled = true;
  private readonly currentEditorTourVersion = 4;
  private adsRemovedSub?: Subscription;
  private removeAdsPriceSub?: Subscription;
  private readonly onlineHandler = () => {
    this.isOnline = true;
  };
  private readonly offlineHandler = () => {
    this.isOnline = false;
  };
  private removeAdsPulseInterval: ReturnType<typeof setInterval> | null = null;
  private removeAdsPulseResetTimeout: ReturnType<typeof setTimeout> | null =
    null;
  private removeAdsCtaImpressionTracked = false;
  private nativeRewriteSessionDisabled = false;
  private nativeRewriteSdkBlocked = false;
  private candidateBlobUrls = new Set<string>();

  @ViewChild(IonContent) content?: IonContent;
  @ViewChild('pdfInput') pdfInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  constructor() {
    addIcons({
      checkmarkCircle,
      closeCircleOutline,
      alertCircleOutline,
      saveOutline,
      shareSocialOutline,
      helpCircleOutline,
      imageOutline,
      documentOutline,
      refreshOutline,
      appsOutline,
      informationCircleOutline,
    });
  }

  headerItems: ScrollableBarItem[] = [];
  recommendedApps: RecommendedApp[] = [];
  showRecommended = false;
  adsRemoved = false;
  removeAdsPriceFormatted: string | null = null;
  removeAdsPulseActive = false;
  purchaseModalOpen = false;
  purchaseBusy = false;
  isOnline = true;

  // PDF state
  sourcePdfFile?: File;
  workingPdfFile?: File;
  workingPdfPath?: string;
  workingPdfNativePath?: string;
  workingPdfName?: string;
  coverEntryPath?: string;
  outputBaseName?: string;
  sourcePdfMeta?: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  };
  selectedPdfName?: string;
  pdfFirstPageDims?: { width: number; height: number };
  pdfErrorKey?: string;
  pdfErrorParams: Record<string, any> = {};
  isPickingPdf = false;

  // Image state
  originalImageFile?: File;
  selectedImageFile?: File;
  selectedImageName?: string;
  originalImageDims?: { width: number; height: number };
  workingImageDims?: { width: number; height: number };

  previewUrl?: string;
  previewThumbUrl?: string;
  previewNonce = 0;
  originalPdfPreviewUrl: string | null = null;
  cropState?: CoverCropState;
  selectedFormatId = ChangePage.FORMAT_ID_WITHOUT_FRAME;
  isFrameDetected = false;
  isDetectingFrame = false;
  exportQualityMode: ExportQualityMode = DEFAULT_EXPORT_QUALITY_MODE;
  coverPageMode: CoverPageMode = 'replace';
  targetWidth?: number;
  targetHeight?: number;

  imageErrorKey?: string;
  imageErrorParams: Record<string, any> = {};

  imageWarnKey?: string;
  imageWarnParams: Record<string, any> = {};

  isPickingImage = false;
  isExporting = false;
  loadingMessageKey?: string;

  workingImageFile?: File;
  exportImageFile?: File;
  editorSourceFile?: File;
  renderedImageFile?: File;
  renderedImageBlob?: Blob;
  renderedImageInfo?: {
    width: number;
    height: number;
    mimeType: string;
    formatId?: string;
  };

  generatedPdfBytes?: Uint8Array;
  generatedPdfPath?: string;
  generatedPdfNativePath?: string;
  generatedPdfFilename?: string;
  lastSavedFilename?: string;
  wasAutoSaved = false;
  rewriteProgressPercent = 0;
  isNativeRewriteInProgress = false;
  isCancellingNativeRewrite = false;
  pdfLoadProgressPercent = 0;
  pdfLoadStage: 'copy' | 'inspect' | null = null;

  infoOpen = false;
  infoEvent: Event | null = null;
  previewOpen = false;
  bestCandidateRequested = false;
  bestCandidateLoading = false;
  bestCandidates: BestCandidateResult[] = [];
  selectedBestCandidateId?: string;
  private previewCandidateOverride: {
    src: string;
    width: number | null;
    height: number | null;
  } | null = null;
  private isApplyingFromEditor = false;
  private previewGenerationToken = 0;
  private currentPreviewOrigin:
    | 'source-pdf'
    | 'replacement'
    | 'edited'
    | null = null;
  private readonly invalidCoverWarnKey = 'CHANGE.IMAGE_WARN_INVALID_PDF_COVER';

  get previewUrlWithNonce(): string | null {
    return this.previewUrl ? `${this.previewUrl}#v=${this.previewNonce}` : null;
  }

  get previewModalImageSrc(): string | null {
    return this.previewCandidateOverride?.src ?? this.previewUrlWithNonce;
  }

  get previewModalImageWidth(): number | null {
    if (this.previewCandidateOverride) return this.previewCandidateOverride.width;
    return this.targetWidth ?? null;
  }

  get previewModalImageHeight(): number | null {
    if (this.previewCandidateOverride) return this.previewCandidateOverride.height;
    return this.targetHeight ?? null;
  }

  get previewModalMode(): 'single' | 'compare' {
    if (this.previewCandidateOverride) return 'single';
    return this.shouldShowComparePreview() ? 'compare' : 'single';
  }

  get previewModalBeforeSrc(): string | null {
    return this.previewCandidateOverride ? null : this.originalPdfPreviewUrl;
  }

  get previewModalAfterSrc(): string | null {
    return this.previewCandidateOverride ? null : this.previewUrlWithNonce;
  }

  get previewModalComparisonEnabled(): boolean {
    return !this.previewCandidateOverride;
  }

  get nativeLoadMode(): 'pdf' | 'rewrite' | null {
    if (this.isNativeRewriteInProgress) return 'rewrite';
    if (this.isPickingPdf && this.usesNativeRewrite()) return 'pdf';
    return null;
  }

  get showNativeLoadOverlay(): boolean {
    return this.nativeLoadMode !== null;
  }

  get nativeLoadTitleKey(): string {
    return this.nativeLoadMode === 'rewrite'
      ? 'CHANGE.CHANGING_COVER'
      : 'CHANGE.LOADING_PDF';
  }

  get nativeLoadPercentLabel(): string {
    const raw =
      this.nativeLoadMode === 'rewrite'
        ? this.rewriteProgressPercent
        : this.pdfLoadProgressPercent;
    const percent = Math.max(0, Math.min(100, Math.round(raw)));
    return `${percent}%`;
  }

  get loadingMessage(): string | undefined {
    return this.loadingMessageKey
      ? this.translate.instant(this.loadingMessageKey)
      : undefined;
  }

  get showInvalidCoverFallback(): boolean {
    return (
      this.hasValidPdf() &&
      !this.previewUrl &&
      !this.imageErrorKey &&
      this.imageWarnKey === this.invalidCoverWarnKey
    );
  }

  get shouldShowBestCandidateAction(): boolean {
    return this.showInvalidCoverFallback || this.bestCandidateRequested;
  }

  async ngOnInit() {
    await this.initializeNativeRewriteSafetyGate();
    await this.refreshHeaderItems();
    this.isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
    await this.billing.hydrateCachedState();
    this.adsRemoved = this.billing.isAdsRemoved();
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe((value: boolean) => {
      const tierChanged = this.adsRemoved !== value;
      this.adsRemoved = value;
      if (tierChanged) {
        this.exportImageFile = undefined;
        this.invalidateGeneratedOutputState();
        this.syncAuthorizedExportQualityMode('billing-state-change');
      }
      this.syncRemoveAdsPulse();
    });
    this.removeAdsPriceFormatted = this.billing.getRemoveAdsPriceFormatted();
    this.removeAdsPriceSub = this.billing.removeAdsPrice$.subscribe(
      (value: string | null) => {
        this.removeAdsPriceFormatted = value;
      },
    );
    this.syncRemoveAdsPulse();

    const settings = await this.settings.load();
    this.selectedFormatId = this.resolveFormatId(settings.cropTargetId);
    this.persistedCropTargetId = this.selectedFormatId;
    this.exportQualityMode = normalizeExportQualityMode(
      settings.exportQualityMode,
      this.adsRemoved,
    );
    this.syncAuthorizedExportQualityMode('settings-load');

    if (this.usesNativeRewrite()) {
      this.rewriteProgressSub = await this.pdfRewrite.addProgressListener(
        ({ percent }: { percent: number }) => {
          if (!this.isNativeRewriteInProgress) return;
          this.zone.run(() => {
            this.rewriteProgressPercent = Math.max(
              0,
              Math.min(100, Math.round(percent ?? 0)),
            );
          });
        },
      );
    }

    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        if (url.startsWith('/tabs/change') || url === '/change') {
          void this.consumeEditorResult();
        }
      });

    this.coversEventsSub = this.coversEvents.events$
      .pipe(filter((event) => event.type === 'deleted'))
      .subscribe((event) => {
        if (!event.filename) return;
        if (event.filename !== this.lastSavedFilename) return;
        this.lastSavedFilename = undefined;
        this.wasAutoSaved = false;
      });
  }

  ngOnDestroy() {
    this.closeInfo();
    this.closePurchaseModal();
    this.clearPreviewLongPress();
    this.resetBestCandidateState(true);
    this.revokePreviewUrl();
    this.revokeOriginalPdfPreviewUrl();
    this.routerSub?.unsubscribe();
    this.coversEventsSub?.unsubscribe();
    this.adsRemovedSub?.unsubscribe();
    this.removeAdsPriceSub?.unsubscribe();
    this.clearRemoveAdsPulse();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
    void this.rewriteProgressSub?.remove();
  }

  private setBusy(
    kind: 'pick' | 'export' | 'pdf' | 'none',
    messageKey?: string,
  ) {
    this.zone.run(() => {
      this.isPickingImage = kind === 'pick';
      this.isExporting = kind === 'export';
      this.isPickingPdf = kind === 'pdf';
      this.loadingMessageKey = kind === 'none' ? undefined : messageKey;
    });
  }

  private getCurrentFormatOptions(): CropFormatOption[] {
    const dims = this.resolveDocumentDims();
    const withoutFrameTarget = this.buildTargetForFrameMode(false, dims);
    const withFrameTarget = this.buildTargetForFrameMode(true, dims);

    return [
      {
        id: ChangePage.FORMAT_ID_WITHOUT_FRAME,
        label: this.translate.instant('CHANGE.FRAME_MODE_WITHOUT_FRAME'),
        target: withoutFrameTarget,
      },
      {
        id: ChangePage.FORMAT_ID_WITH_FRAME,
        label: this.translate.instant('CHANGE.FRAME_MODE_WITH_FRAME'),
        target: withFrameTarget,
        disabled: !this.isFrameDetected,
      },
    ];
  }

  private buildTargetForFrameMode(
    withFrame: boolean,
    dims: { width: number; height: number } | null,
  ): CropTarget {
    const reference = dims ?? this.baseTarget;
    const isLandscape = reference.width > reference.height;
    const basePortrait = this.baseTarget;
    const baseLandscape = {
      width: this.baseTarget.height,
      height: this.baseTarget.width,
    };
    const base = isLandscape ? baseLandscape : basePortrait;

    const normalized = this.scaleDimsToLongSide(reference, Math.max(base.width, base.height));

    if (!withFrame) {
      return {
        width: normalized.width,
        height: normalized.height,
        output: 'target',
      };
    }

    return {
      width: base.width,
      height: base.height,
      output: 'target',
    };
  }

  private scaleDimsToLongSide(
    dims: { width: number; height: number },
    targetLongSide: number,
  ): { width: number; height: number } {
    const longSide = Math.max(dims.width, dims.height);
    if (!longSide || !Number.isFinite(longSide) || longSide <= 0) {
      return { width: this.baseTarget.width, height: this.baseTarget.height };
    }

    const scale = targetLongSide / longSide;
    return {
      width: Math.max(1, Math.round(dims.width * scale)),
      height: Math.max(1, Math.round(dims.height * scale)),
    };
  }

  private resolveDocumentDims(): { width: number; height: number } | null {
    const dims = this.pdfFirstPageDims ?? null;
    if (!dims) return null;
    if (!Number.isFinite(dims.width) || !Number.isFinite(dims.height)) {
      return null;
    }
    if (dims.width <= 0 || dims.height <= 0) {
      return null;
    }
    return dims;
  }

  private normalizeDims(
    dims: Partial<{ width: number; height: number }> | null | undefined,
  ): { width: number; height: number } | null {
    const width = Number(dims?.width);
    const height = Number(dims?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }
    if (width <= 0 || height <= 0) {
      return null;
    }
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }

  private async resolvePdfFirstPageDims(): Promise<void> {
    this.pdfFirstPageDims = undefined;

    if (this.workingPdfNativePath && this.pdfRewrite.isSupported()) {
      try {
        const extracted = await this.pdfRewrite.extractFirstPagePreviewFile({
          inputPath: this.workingPdfNativePath,
          pdfName: this.selectedPdfName || 'pdf',
          maxDimension: 1600,
        });
        const nativeDims = this.normalizeDims({
          width: extracted.width,
          height: extracted.height,
        });
        if (nativeDims) {
          this.pdfFirstPageDims = nativeDims;
          return;
        }
        const fallbackDims = this.normalizeDims(
          await this.imagePipe.getDimensions(extracted.file),
        );
        if (fallbackDims) {
          this.pdfFirstPageDims = fallbackDims;
          return;
        }
      } catch {
        // Best effort: continue with file-based extraction.
      }
    }

    const candidates = [this.workingPdfFile, this.sourcePdfFile].filter(
      (file): file is File => !!file,
    );
    for (const file of candidates) {
      try {
        const extracted = await this.fileService.extractCoverFromPdfFile(file);
        if (!extracted) continue;
        const dims = this.normalizeDims(
          await this.imagePipe.getDimensions(extracted),
        );
        if (dims) {
          this.pdfFirstPageDims = dims;
          return;
        }
      } catch {
        // Keep trying remaining sources.
      }
    }
  }

  // PDF handling methods
  openPdfPicker() {
    if (this.usesNativeRewrite()) {
      void this.pickNativePdf();
      return;
    }
    this.pdfInput.nativeElement.click();
  }

  async onPdfSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.resetPdfLoadProgress();
    this.setBusy('pdf', 'CHANGE.LOADING_PDF');

    try {
      await this.resetWorkflowForNewPdf();

      // Validate PDF file
      const validation = this.fileService.validatePdf(
        file,
        this.maxPdfSizeMB,
      );
      if (!validation.valid) {
        this.failPdf(this.mapValidationErrorToUiKey(validation.errorKey), file);
        return;
      }

      // Create working copy immediately
      let cycle: Awaited<ReturnType<PdfWorkingCopyService['startCycle']>>;
      try {
        cycle = await this.workingCopy.startCycle(file);
      } catch (error) {
        this.failPdf('PDF_ERROR_CORRUPT', file);
        return;
      }
      this.sourcePdfFile = file;
      this.sourcePdfMeta = cycle.sourceMeta;
      this.workingPdfFile = cycle.workingFile;
      this.workingPdfPath = cycle.workingPath;
      this.workingPdfName = cycle.workingName;
      this.outputBaseName = cycle.outputBaseName;
      this.selectedPdfName = file.name;

      const hasValidStructure = await this.fileService.validatePdfStructure(
        this.workingPdfFile,
      );
      if (!hasValidStructure) {
        this.failPdf('PDF_ERROR_CORRUPT', file);
        await this.cleanupWorkingCopy();
        return;
      }

      await this.resolvePdfFirstPageDims();

      const strictCover = await this.candidateImageService.resolveStrictCover({
        pdfFile: this.workingPdfFile,
        pdfName: this.selectedPdfName,
      });
      console.info('[ECC_BEST_CANDIDATE] strict cover found:', !!strictCover);
      this.clearPdfError();

      if (!strictCover) {
        console.info(
          '[ECC_BEST_CANDIDATE] valid cover not found, fallback to candidate picker',
        );
        const firstPageApplied = await this.tryApplyFirstPageCoverFallback();
        if (firstPageApplied) {
          await this.homeTour.completeInteraction('pdf-selected');
          return;
        }
        await this.activateBestCandidateFallback();
        await this.homeTour.completeInteraction('pdf-selected');
        return;
      }

      this.coverEntryPath = strictCover.sourcePath;
      const coverLoaded = await this.applyImageSource(strictCover.file, false);
      if (!coverLoaded) {
        const firstPageApplied = await this.tryApplyFirstPageCoverFallback();
        if (firstPageApplied) {
          await this.homeTour.completeInteraction('pdf-selected');
          return;
        }
        await this.activateBestCandidateFallback();
        await this.homeTour.completeInteraction('pdf-selected');
        return;
      }
      await this.homeTour.completeInteraction('pdf-selected');
    } finally {
      this.resetPdfLoadProgress();
      this.setBusy('none');
      input.value = '';
    }
  }

  private async pickNativePdf() {
    this.resetPdfLoadProgress();
    this.setBusy('pdf', 'CHANGE.LOADING_PDF');
    this.pdfLoadStage = 'copy';
    this.pdfLoadProgressPercent = 0;

    try {
      const prepared = await this.pdfRewrite.pickAndPreparePdf({
        maxBytes: this.maxPdfSizeMB * 1024 * 1024,
      });
      await this.resetWorkflowForNewPdf();
      this.pdfLoadStage = 'inspect';
      this.pdfLoadProgressPercent = 92;

      this.sourcePdfFile = undefined;
      this.sourcePdfMeta = {
        name: prepared.selectedName,
        size: prepared.sourceSize,
        lastModified: prepared.sourceLastModified,
        type: prepared.sourceMimeType,
      };
      this.workingPdfFile = undefined;
      this.workingPdfPath = prepared.workingPath;
      this.workingPdfNativePath = prepared.workingNativePath;
      this.workingPdfName = prepared.workingName;
      this.outputBaseName = prepared.outputBaseName;
      this.selectedPdfName = prepared.selectedName;
      this.coverEntryPath = undefined;
      this.clearPdfError();

      await this.resolvePdfFirstPageDims();

      const strictCover = await this.candidateImageService.resolveStrictCover({
        pdfNativePath: this.workingPdfNativePath,
        pdfName: this.selectedPdfName,
      });
      console.info('[ECC_BEST_CANDIDATE] strict cover found:', !!strictCover);

      if (!strictCover) {
        console.info(
          '[ECC_BEST_CANDIDATE] valid cover not found, fallback to candidate picker',
        );
        const firstPageApplied = await this.tryApplyFirstPageCoverFallback();
        if (firstPageApplied) {
          this.pdfLoadProgressPercent = 100;
          await this.homeTour.completeInteraction('pdf-selected');
          return;
        }
        await this.activateBestCandidateFallback();
        this.pdfLoadProgressPercent = 100;
        await this.homeTour.completeInteraction('pdf-selected');
        return;
      }

      try {
        this.coverEntryPath = strictCover.sourcePath;
        const coverLoaded = await this.applyImageSource(strictCover.file, false);
        if (!coverLoaded) {
          const firstPageApplied = await this.tryApplyFirstPageCoverFallback();
          if (firstPageApplied) {
            this.pdfLoadProgressPercent = 100;
            await this.homeTour.completeInteraction('pdf-selected');
            return;
          }
          await this.activateBestCandidateFallback();
          await this.homeTour.completeInteraction('pdf-selected');
          return;
        }
        this.pdfLoadProgressPercent = 100;
        await this.homeTour.completeInteraction('pdf-selected');
      } catch {
        const firstPageApplied = await this.tryApplyFirstPageCoverFallback();
        if (firstPageApplied) {
          this.pdfLoadProgressPercent = 100;
          await this.homeTour.completeInteraction('pdf-selected');
          return;
        }
        await this.activateBestCandidateFallback();
        await this.homeTour.completeInteraction('pdf-selected');
      }
    } catch (error) {
      if (
        error instanceof PdfRewriteError &&
        error.code === 'PICK_CANCELLED'
      ) {
        return;
      }

      this.maybeDisableNativeRewriteForSession(error, 'pick_pdf');

      const mappedErrorKey = this.mapNativePdfError(error);
      this.failPdf(
        mappedErrorKey,
        this.sourcePdfMeta,
        this.buildNativeStorageErrorParams(error),
      );
      await this.cleanupWorkingCopy();
    } finally {
      this.resetPdfLoadProgress();
      this.setBusy('none');
    }
  }

  private failPdf(
    errorKey: string,
    file?: { name?: string },
    extraParams: Record<string, unknown> = {},
  ) {
    this.zone.run(() => {
      this.pdfErrorKey = `CHANGE.${errorKey}`;
      this.pdfErrorParams = {
        maxSize: String(this.maxPdfSizeMB),
        name: file?.name || '',
        ...extraParams,
      };
      this.sourcePdfFile = undefined;
      this.sourcePdfMeta = undefined;
      this.workingPdfFile = undefined;
      this.workingPdfPath = undefined;
      this.workingPdfNativePath = undefined;
      this.workingPdfName = undefined;
      this.pdfFirstPageDims = undefined;
      this.coverEntryPath = undefined;
      this.outputBaseName = undefined;
      this.selectedPdfName = undefined;
    });
  }

  private clearPdfError() {
    this.zone.run(() => {
      this.pdfErrorKey = undefined;
      this.pdfErrorParams = {};
    });
  }

  hasValidPdf(): boolean {
    return (
      !!(this.workingPdfFile || this.workingPdfNativePath) &&
      !this.pdfErrorKey
    );
  }

  private resetPdfLoadProgress() {
    this.pdfLoadProgressPercent = 0;
    this.pdfLoadStage = null;
  }

  private resetWorkflow() {
    this.selectedFormatId = this.persistedCropTargetId;
    this.isFrameDetected = false;
    this.isDetectingFrame = false;
    this.coverPageMode = 'replace';
    this.closeInfo();
    this.closePreview();
    this.clearPreviewLongPress();

    // Clear image state
    this.originalImageFile = undefined;
    this.selectedImageFile = undefined;
    this.selectedImageName = undefined;
    this.originalImageDims = undefined;
    this.workingImageDims = undefined;
    this.workingImageFile = undefined;
    this.exportImageFile = undefined;
    this.editorSourceFile = undefined;
    this.renderedImageFile = undefined;
    this.renderedImageBlob = undefined;
    this.renderedImageInfo = undefined;
    this.cropState = undefined;
    this.targetWidth = undefined;
    this.targetHeight = undefined;
    this.workingMaxSideApplied = null;
    this.revokePreviewUrl();
    this.revokeOriginalPdfPreviewUrl();
    this.currentPreviewOrigin = null;
    this.clearImageError();
    this.clearImageWarn();
    this.resetBestCandidateState(true);

    // Clear generation state
    this.generatedPdfBytes = undefined;
    this.generatedPdfPath = undefined;
    this.generatedPdfNativePath = undefined;
    this.generatedPdfFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;
    this.rewriteProgressPercent = 0;
    this.isNativeRewriteInProgress = false;
    this.isCancellingNativeRewrite = false;

    this.clearPdfError();
  }

  private async resetWorkflowForNewPdf() {
    await this.cleanupWorkingCopy();
    this.resetWorkflow();
    this.lastEditorSessionId = undefined;
    this.editorSession.clearSessions();
    this.sourcePdfFile = undefined;
    this.sourcePdfMeta = undefined;
    this.workingPdfFile = undefined;
    this.workingPdfPath = undefined;
    this.workingPdfNativePath = undefined;
    this.workingPdfName = undefined;
    this.pdfFirstPageDims = undefined;
    this.coverEntryPath = undefined;
    this.outputBaseName = undefined;
    this.selectedPdfName = undefined;
    this.workingMaxSideApplied = null;
  }

  private async cleanupWorkingCopy() {
    const paths = [this.generatedPdfPath, this.workingPdfPath].filter(
      (path): path is string => !!path,
    );

    for (const path of new Set(paths)) {
      try {
        await this.workingCopy.cleanupWorkingCopy(path);
      } catch {
        // best effort
      }
    }
  }

  // Image handling methods
  openImagePicker() {
    if (this.suppressNextImagePick) {
      this.suppressNextImagePick = false;
      return;
    }
    this.imageInput.nativeElement.click();
  }

  async onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.setBusy('pick', 'CHANGE.LOADING_IMAGE');

    try {
      const loaded = await this.applyImageSource(file, true);
      if (loaded) {
        await this.homeTour.completeInteraction('cover-image-selected');
      }
    } finally {
      this.setBusy('none');
      input.value = '';
    }
  }

  async detectCoverAutomatically(): Promise<void> {
    if (!this.hasValidPdf() || this.bestCandidateLoading) return;

    this.bestCandidateRequested = true;
    this.bestCandidateLoading = true;
    this.bestCandidates = [];
    this.selectedBestCandidateId = undefined;
    if (this.previewCandidateOverride) {
      this.closePreview();
    }
    this.revokeCandidateBlobUrls();

    try {
      console.info(
        '[ECC_BEST_CANDIDATE] cover not found, scanning internal images',
      );
      const discovered = await this.candidateImageService.discoverInternalImages(
        {
          pdfFile: this.workingPdfFile,
          pdfNativePath: this.workingPdfNativePath,
          pdfName: this.selectedPdfName,
        },
      );
      console.info(
        '[ECC_BEST_CANDIDATE] manifest image count:',
        discovered.diagnostics.manifestImageCount,
      );
      console.info(
        '[ECC_BEST_CANDIDATE] zip image count:',
        discovered.diagnostics.zipImageCount,
      );
      console.info(
        '[ECC_BEST_CANDIDATE] merged image count:',
        discovered.diagnostics.mergedImageCount,
      );
      for (const rejected of discovered.diagnostics.rejectedImages) {
        console.info(
          `[ECC_BEST_CANDIDATE] rejected image: ${rejected.path}, ${rejected.reason}`,
        );
      }

      const images = discovered.images;
      console.info('[ECC_BEST_CANDIDATE] images found:', images.length);

      for (const image of images) {
        if (image.src.startsWith('blob:')) {
          this.candidateBlobUrls.add(image.src);
        }
      }

      const ranked = this.bestCandidateService.rankCandidatesWithDiagnostics(
        images,
      );
      for (const rejected of ranked.rejected) {
        const rejectedPath =
          rejected.image.sourcePath ||
          rejected.image.fileName ||
          rejected.image.id ||
          'unknown';
        console.info(
          `[ECC_BEST_CANDIDATE] rejected image: ${rejectedPath}, ${rejected.reason}`,
        );
      }
      console.info(
        '[ECC_BEST_CANDIDATE] candidates after filters:',
        ranked.results.length,
      );
      this.bestCandidates = ranked.results;
    } catch (error) {
      console.warn('[ECC_BEST_CANDIDATE] detection failed', error);
      this.bestCandidates = [];
    } finally {
      this.bestCandidateLoading = false;
    }
  }

  async onBestCandidateSelected(candidate: BestCandidateImage): Promise<void> {
    if (this.bestCandidateLoading || !this.hasValidPdf()) return;
    const file = this.candidateFileFromMetadata(candidate);
    if (!file) return;

    const loaded = await this.applyImageSource(file, false);
    if (!loaded) return;

    if (candidate.sourcePath) {
      this.coverEntryPath = candidate.sourcePath;
    }
    console.info(
      '[ECC_BEST_CANDIDATE] selected candidate:',
      candidate.sourcePath || candidate.fileName || candidate.id,
    );
    this.resetBestCandidateState(true);
    await this.homeTour.completeInteraction('cover-image-selected');
  }

  onBestCandidatePreviewRequested(candidate: BestCandidateImage): void {
    if (this.bestCandidateLoading) return;
    const src = candidate.src?.trim();
    if (!src) return;
    this.previewCandidateOverride = {
      src,
      width:
        Number.isFinite(candidate.width) && candidate.width > 0
          ? candidate.width
          : null,
      height:
        Number.isFinite(candidate.height) && candidate.height > 0
          ? candidate.height
          : null,
    };
    this.previewOpen = true;
    console.info(
      '[ECC_BEST_CANDIDATE] preview requested:',
      candidate.sourcePath || candidate.fileName || candidate.id,
    );
  }

  private async applyImageSource(
    file: File,
    setImageError: boolean,
  ): Promise<boolean> {
    this.cropState = undefined;
    let source = file;

    const basicErr = this.imagePipe.validateBasic(source);
    if (basicErr) {
      if (setImageError) this.failImage(basicErr, source);
      return false;
    }

    source = await this.imagePipe.materializeFile(source);

    let originalDims = await this.imagePipe.getDimensions(source);

    if (!originalDims) {
      const normalized = await this.imagePipe.normalizeFile(source);
      if (normalized) {
        source = normalized;
        originalDims = await this.imagePipe.getDimensions(source);
      }
    }

    if (!originalDims) {
      if (setImageError) this.failImage('CORRUPT', source);
      return false;
    }

    this.clearImageError();
    this.clearImageWarn();

    if (!setImageError) {
      this.setOriginalPdfPreviewUrl(source);
      this.currentPreviewOrigin = 'source-pdf';
    } else {
      this.currentPreviewOrigin = 'replacement';
    }

    this.originalImageFile = source;

    const working = await this.imagePipe.prepareWorkingImage(source);
    this.workingImageFile = working;
    this.exportImageFile = undefined;
    this.cropState = undefined;
    this.editorSourceFile = working;
    this.renderedImageFile = undefined;
    this.renderedImageBlob = undefined;
    this.renderedImageInfo = undefined;

    const workingDims = await this.imagePipe.getDimensions(working);
    this.originalImageDims = originalDims;
    this.workingImageDims = workingDims ?? originalDims;
    this.selectedImageName = working.name;
    await this.refreshFrameDetection(source, originalDims);
    if (workingDims) {
      const originalMax = Math.max(originalDims.width, originalDims.height);
      const workingMax = Math.max(workingDims.width, workingDims.height);
      const maxSide = this.imagePipe.workingMaxSide;
      this.workingMaxSideApplied =
        Number.isFinite(workingMax) &&
        originalMax > maxSide &&
        workingMax <= maxSide &&
        workingMax < originalMax;
    } else {
      this.workingMaxSideApplied = null;
    }

    await this.applySmallWarn('image-selected', originalDims);
    const selected = this.getSelectedFormatOption();
    if (selected) {
      this.targetWidth = selected.target.width;
      this.targetHeight = selected.target.height;
    }

    this.revokePreviewUrl();
    this.previewThumbUrl = undefined;
    await this.updatePreviewFromComposition();
    if (!this.previewUrl) {
      const url = URL.createObjectURL(working);
      this.setPreviewUrl(url);
      this.setPreviewThumbUrl(url);
    }

    return true;
  }

  private async refreshFrameDetection(
    sourceFile: File,
    dims: { width: number; height: number },
  ): Promise<void> {
    this.isDetectingFrame = true;
    try {
      const result = await this.detectFrameFromImage(sourceFile, dims);
      this.isFrameDetected = result.hasFrame;
    } catch {
      this.isFrameDetected = false;
    } finally {
      this.isDetectingFrame = false;
    }

    if (!this.isFrameDetected) {
      this.selectedFormatId = ChangePage.FORMAT_ID_WITHOUT_FRAME;
    }

    const selected = this.getSelectedFormatOption();
    if (selected) {
      this.targetWidth = selected.target.width;
      this.targetHeight = selected.target.height;
    }
  }

  private async detectFrameFromImage(
    sourceFile: File,
    dimsHint?: { width: number; height: number },
  ): Promise<FrameDetectionResult> {
    const loaded = await this.loadImageFromBlob(sourceFile);
    if (!loaded) {
      return { hasFrame: false };
    }

    const width = loaded.width;
    const height = loaded.height;
    const sampleLongSide = 220;
    const scale = sampleLongSide / Math.max(width, height);
    const sampleWidth = Math.max(24, Math.round(width * scale));
    const sampleHeight = Math.max(24, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      loaded.close?.();
      return { hasFrame: false };
    }

    loaded.draw(ctx, 0, 0, sampleWidth, sampleHeight);
    loaded.close?.();

    const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const edgeThickness = Math.max(
      2,
      Math.round(Math.min(sampleWidth, sampleHeight) * 0.08),
    );
    const centerInset = Math.max(
      edgeThickness + 1,
      Math.round(Math.min(sampleWidth, sampleHeight) * 0.2),
    );

    const topStats = this.sampleBandLumaStats(
      imageData,
      sampleWidth,
      sampleHeight,
      0,
      0,
      sampleWidth,
      edgeThickness,
    );
    const bottomStats = this.sampleBandLumaStats(
      imageData,
      sampleWidth,
      sampleHeight,
      0,
      sampleHeight - edgeThickness,
      sampleWidth,
      edgeThickness,
    );
    const leftStats = this.sampleBandLumaStats(
      imageData,
      sampleWidth,
      sampleHeight,
      0,
      0,
      edgeThickness,
      sampleHeight,
    );
    const rightStats = this.sampleBandLumaStats(
      imageData,
      sampleWidth,
      sampleHeight,
      sampleWidth - edgeThickness,
      0,
      edgeThickness,
      sampleHeight,
    );
    const centerStats = this.sampleBandLumaStats(
      imageData,
      sampleWidth,
      sampleHeight,
      centerInset,
      centerInset,
      Math.max(1, sampleWidth - centerInset * 2),
      Math.max(1, sampleHeight - centerInset * 2),
    );

    const edgeMeans = [
      topStats.mean,
      bottomStats.mean,
      leftStats.mean,
      rightStats.mean,
    ];
    const edgeStdDevs = [
      topStats.stdDev,
      bottomStats.stdDev,
      leftStats.stdDev,
      rightStats.stdDev,
    ];

    const edgeSpread = Math.max(...edgeMeans) - Math.min(...edgeMeans);
    const centerDistance = Math.abs(this.average(edgeMeans) - centerStats.mean);
    const edgeUniformity = this.average(edgeStdDevs);
    const frameLikeByUniformBand =
      edgeSpread < 26 && centerDistance > 14 && edgeUniformity < 22;

    const innerOuterContrast =
      Math.abs(topStats.mean - centerStats.mean) +
      Math.abs(bottomStats.mean - centerStats.mean) +
      Math.abs(leftStats.mean - centerStats.mean) +
      Math.abs(rightStats.mean - centerStats.mean);

    const orientationAwareBoost =
      (dimsHint?.width ?? width) > (dimsHint?.height ?? height) ? 0.9 : 1;
    const hasFrame =
      frameLikeByUniformBand &&
      innerOuterContrast > 58 * orientationAwareBoost;

    return { hasFrame };
  }

  private sampleBandLumaStats(
    data: Uint8ClampedArray,
    imageWidth: number,
    imageHeight: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): { mean: number; stdDev: number } {
    const startX = Math.max(0, Math.min(imageWidth - 1, x));
    const startY = Math.max(0, Math.min(imageHeight - 1, y));
    const endX = Math.max(startX + 1, Math.min(imageWidth, startX + width));
    const endY = Math.max(startY + 1, Math.min(imageHeight, startY + height));

    let count = 0;
    let sum = 0;
    let sumSquares = 0;

    for (let yy = startY; yy < endY; yy += 1) {
      for (let xx = startX; xx < endX; xx += 1) {
        const idx = (yy * imageWidth + xx) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += luma;
        sumSquares += luma * luma;
        count += 1;
      }
    }

    if (!count) {
      return { mean: 0, stdDev: 0 };
    }

    const mean = sum / count;
    const variance = Math.max(0, sumSquares / count - mean * mean);
    return { mean, stdDev: Math.sqrt(variance) };
  }

  private average(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
  }

  private async applySmallWarn(
    reason: 'image-selected' | 'editor-apply',
    legacyDimsHint?: { width: number; height: number },
    exportDimsHint?: { width: number; height: number },
  ): Promise<void> {
    this.clearImageWarn();
    const selected = this.getSelectedFormatOption();
    if (!selected) return;
    const target = {
      width: selected.target.width,
      height: selected.target.height,
    };
    const legacyDims = legacyDimsHint ?? this.workingImageDims ?? null;
    const exportDims =
      exportDimsHint ?? (await this.resolveExportDimsForSmallWarn()) ?? null;

    // Enforce export-based validation only.
    if (!exportDims) {
      this.debugSmallWarn({
        reason,
        targetId: selected.id,
        target,
        exportDims,
        legacyDims,
        usedDims: null,
        willWarn: false,
      });
      return;
    }

    const params = this.getSmallWarnParamsForExportDims(exportDims, target);
    this.debugSmallWarn({
      reason,
      targetId: selected.id,
      target,
      exportDims,
      legacyDims,
      usedDims: exportDims,
      willWarn: !!params,
    });
    if (!params) return;

    this.imageWarnKey = 'EXPORT_OPTIONS.SMALL_SOURCE_WARNING';
    this.imageWarnParams = params;
  }

  private getSmallWarnParamsForExportDims(
    exportDims: { width: number; height: number },
    target: { width: number; height: number },
  ): Record<string, number> | null {
    const reference = this.getExportWarningReferenceDims(target);
    const widthScale = reference.width / exportDims.width;
    const heightScale = reference.height / exportDims.height;
    const scaleFactor = Math.max(widthScale, heightScale);
    const belowRecommendedWidth = exportDims.width < reference.width * 0.75;
    const belowRecommendedHeight = exportDims.height < reference.height * 0.75;

    if (
      scaleFactor <= 1.5 &&
      !belowRecommendedWidth &&
      !belowRecommendedHeight
    ) {
      return null;
    }

    return {
      imgW: exportDims.width,
      imgH: exportDims.height,
      minW: reference.width,
      minH: reference.height,
      scaleFactor: Number(scaleFactor.toFixed(2)),
    };
  }

  private getExportWarningReferenceDims(target: {
    width: number;
    height: number;
  }): { width: number; height: number } {
    const scale = Math.min(
      this.baseTarget.width / target.width,
      this.baseTarget.height / target.height,
    );

    return {
      width: Math.max(1, Math.round(target.width * scale)),
      height: Math.max(1, Math.round(target.height * scale)),
    };
  }

  canCrop(): boolean {
    return (
      this.hasValidPdf() &&
      !!(this.editorSourceFile ?? this.workingImageFile) &&
      !this.imageErrorKey
    );
  }
  async startCrop() {
    if (!this.canCrop()) return;

    const sourceFile = this.editorSourceFile ?? this.workingImageFile;
    if (!sourceFile) return;

    const selected = this.getSelectedFormatOption();
    if (!selected) return;
    const editorFormats = this.getCurrentFormatOptions();
    const eReaderOptimizationEnabledForFeature =
      await this.resolveEReaderOptimizationEnabled();
    const initialState = this.cropState;

    const sid = this.editorSession.createSession({
      file: sourceFile,
      target: {
        width: selected.target.width,
        height: selected.target.height,
      },
      initialState,
      tools: {
        formats: {
          options: editorFormats,
          selectedId: selected.id,
        },
        eReaderOptimization: {
          enabled:
            this.editorEReaderOptimizationFeatureEnabled &&
            eReaderOptimizationEnabledForFeature,
        },
      },
      output: {
        includeRenderedBlob: false,
      },
      preferences: {
        artifactReductionInfo: {
          hasSeen: async () => {
            const settings = await this.settings.load();
            return (
              settings.preferences?.[this.artifactReductionInfoSeenKey] === true
            );
          },
          markSeen: async () => {
            await this.settings.set((prev) => ({
              ...prev,
              preferences: {
                ...(prev.preferences ?? {}),
                [this.artifactReductionInfoSeenKey]: true,
              },
            }));
          },
        },
      },
      returnUrl: this.getEditorReturnUrl(),
    });

    this.lastEditorSessionId = sid;
    const shouldShowEditorTour = await this.shouldShowEditorTour();
    if (shouldShowEditorTour) {
      await this.settings.set((prev) => ({
        ...prev,
        preferences: {
          ...(prev.preferences ?? {}),
          [this.editorTourSeenVersionKey]: this.currentEditorTourVersion,
        },
      }));
    }

    this.router.navigate(['/editor'], {
      queryParams: {
        sid,
        ...(shouldShowEditorTour
          ? { tour: '1', tourCurrent: '4', tourTotal: '6' }
          : {}),
      },
    });
  }

  private getSelectedFormatOption(): CropFormatOption | null {
    const options = this.getCurrentFormatOptions();
    if (!options.length) return null;
    const selected =
      options.find((opt) => opt.id === this.selectedFormatId) ?? options[0];
    if (selected && selected.id !== this.selectedFormatId) {
      this.selectedFormatId = selected.id;
    }
    return selected ?? null;
  }

  private getEditorReturnUrl(): string {
    const current = this.router.url;
    if (current.startsWith('/tabs/')) return current;
    return '/tabs/change';
  }

  private async resolveEReaderOptimizationEnabled(): Promise<boolean> {
    if (!this.editorEReaderOptimizationFeatureEnabled) {
      return false;
    }
    const settings = await this.settings.load();
    const stored =
      settings.preferences?.[EDITOR_EREADER_OPTIMIZATION_PREF_KEY];
    return stored !== false;
  }

  canExport(): boolean {
    return (
      !!(this.originalImageFile ?? this.workingImageFile) &&
      !!this.cropState &&
      !this.imageErrorKey
    );
  }

  private async applyCropResult(result: EditorResult): Promise<void> {
    const newFile = result.file;
    if (!newFile) return;
    const renderedBlob = result.renderedBlob;
    this.isApplyingFromEditor = true;
    this.previewGenerationToken += 1;
    this.currentPreviewOrigin = 'edited';

    const editorSource =
      this.editorSourceFile ?? this.workingImageFile ?? newFile;
    if (!this.editorSourceFile) {
      this.editorSourceFile = editorSource;
    }

    if (result.formatId) {
      this.selectedFormatId = result.formatId;
    }
    const selected = this.getSelectedFormatOption();
    if (selected?.id && selected.id !== this.persistedCropTargetId) {
      await this.persistCropTargetId(selected.id);
    }
    const outW = selected?.target.width;
    const outH = selected?.target.height;
    this.targetWidth = outW ?? selected?.target.width ?? this.baseTarget.width;
    this.targetHeight =
      outH ?? selected?.target.height ?? this.baseTarget.height;

    if (result.state) {
      const nextLayers = Array.isArray(result.state.textLayers)
        ? result.state.textLayers.map((layer) => ({ ...layer }))
        : undefined;
      this.cropState = {
        ...result.state,
        textLayers: nextLayers,
      };
    } else {
      this.cropState = this.cropState;
    }
    this.clearImageError();
    this.clearImageWarn();

    this.workingImageFile = newFile;
    this.exportImageFile = undefined;
    this.renderedImageFile = undefined;
    this.renderedImageBlob = undefined;
    this.renderedImageInfo = undefined;

    this.cleanupGeneratedTempOutput();
    this.generatedPdfBytes = undefined;
    this.generatedPdfPath = undefined;
    this.generatedPdfNativePath = undefined;
    this.generatedPdfFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;

    this.selectedImageName = newFile.name;
    if (!this.workingImageDims) {
      const dims = await this.imagePipe.getDimensions(newFile);
      if (!dims) return this.failImage('CORRUPT', newFile);
      this.workingImageDims = dims;
    }

    try {
      if (renderedBlob) {
        const renderedInfo = this.normalizeRenderedInfo(result) ?? undefined;
        const renderedFile = this.buildRenderedFile(
          renderedBlob,
          renderedInfo?.mimeType,
        );
        this.renderedImageFile = renderedFile;
        this.renderedImageBlob = renderedBlob;
        this.renderedImageInfo = renderedInfo;

        const url = URL.createObjectURL(renderedBlob);
        this.setPreviewUrl(url);
        const thumb = await this.buildThumbFromBlob(
          renderedBlob,
          ChangePage.THUMB_SIZE,
        );
        this.setPreviewThumbUrl(thumb ?? url);
        await this.applySmallWarn(
          'editor-apply',
          undefined,
          renderedInfo ?? undefined,
        );
        this.isApplyingFromEditor = false;
        this.zone.run(() => {
          this.previewNonce += 1;
        });
        return;
      } else {
        await this.applySmallWarn('editor-apply');
        this.isApplyingFromEditor = false;
        await this.updatePreviewFromComposition();
      }
    } finally {
      this.isApplyingFromEditor = false;
      await this.homeTour.completeInteraction('editor-apply');
    }
  }

  private buildCompositionInput(purpose: 'preview' | 'export' = 'preview') {
    const workingFile = this.editorSourceFile ?? this.workingImageFile;
    if (!workingFile || !this.workingImageDims) {
      return null;
    }

    const selected = this.getSelectedFormatOption();
    if (!selected) return null;

    const state = this.cropState ?? this.buildDefaultCropState();
    const rawTarget = selected.target;
    const layoutState = this.applyLayoutBase(state, rawTarget);

    return buildCompositionInputForPurpose({
      purpose,
      sources: {
        working: {
          file: workingFile,
          naturalWidth: this.workingImageDims.width,
          naturalHeight: this.workingImageDims.height,
        },
        original:
          this.originalImageFile && this.originalImageDims
            ? {
                file: this.originalImageFile,
                naturalWidth: this.originalImageDims.width,
                naturalHeight: this.originalImageDims.height,
              }
            : undefined,
      },
      target: {
        width: rawTarget.width,
        height: rawTarget.height,
        output: rawTarget.output,
      },
      state: layoutState,
      frameFallback: { width: rawTarget.width, height: rawTarget.height },
    });
  }

  private async updatePreviewFromComposition(): Promise<void> {
    if (this.isApplyingFromEditor) return;
    if (this.renderedImageBlob) return;
    const token = ++this.previewGenerationToken;
    const input = this.buildCompositionInput('preview');
    if (!input) return;

    const baseCanvas = await renderCompositionToCanvas(input, {
      mode: 'preview',
      outputScale: 1,
      debugLabel: 'ECC_PREVIEW',
    });
    if (!baseCanvas) return;

    const isDithered = this.isPreviewDithered();
    const modalCanvas = isDithered
      ? baseCanvas
      : this.downscaleCanvas(baseCanvas, ChangePage.PREVIEW_MAX_SIDE, false);

    const blob: Blob | null = await new Promise((resolve) =>
      modalCanvas.toBlob(
        (bb) => resolve(bb),
        isDithered ? 'image/png' : 'image/jpeg',
        isDithered ? undefined : 0.9,
      ),
    );
    if (!blob) return;

    if (token !== this.previewGenerationToken) return;
    const url = URL.createObjectURL(blob);
    this.setPreviewUrl(url);

    const thumb = this.buildThumbFromCanvas(baseCanvas, ChangePage.THUMB_SIZE);
    if (token !== this.previewGenerationToken) return;
    this.setPreviewThumbUrl(thumb ?? url);
  }

  private async ensureExportImageFile(): Promise<File | null> {
    if (this.exportImageFile) return this.exportImageFile;

    const input = this.buildCompositionInput('export');
    if (!input) return null;

    const selectedExportOptions = this.getSelectedCoverExportOptions();

    const file = await renderCompositionToFile(input, {
      mode: 'export',
      mimeType: this.resolveExportMimeType(),
      quality: this.resolveExportQuality(),
      maxDimension: selectedExportOptions?.maxDimension,
      backgroundFallbackColor:
        selectedExportOptions?.mimeType === 'image/jpeg'
          ? '#ffffff'
          : undefined,
    });
    if (!file) return null;

    this.exportImageFile = file;
    return file;
  }

  private resolveExportMimeType(): string | undefined {
    const selected = this.getSelectedCoverExportOptions();
    if (selected) {
      return selected.mimeType;
    }
    if (this.resolveInputImageMimeType() === 'image/png') {
      return 'image/png';
    }
    return undefined;
  }

  private resolveExportQuality(): number | undefined {
    const selected = this.getSelectedCoverExportOptions();
    if (selected) {
      return selected.quality;
    }
    if (this.resolveInputImageMimeType() === 'image/png') {
      return undefined;
    }
    return 1;
  }

  private getSelectedCoverExportOptions(): ReturnType<
    typeof getCoverExportOptions
  > | null {
    return getCoverExportOptions(this.getEffectiveExportQualityMode());
  }

  private resolveInputImageMimeType(): 'image/png' | 'image/jpeg' | null {
    const candidate =
      this.editorSourceFile ??
      this.workingImageFile ??
      this.selectedImageFile ??
      this.originalImageFile;
    const byType = this.normalizeMimeType(candidate?.type);
    if (byType) {
      return byType;
    }
    return this.mimeTypeFromFilename(candidate?.name);
  }

  private normalizeMimeType(
    mimeType?: string,
  ): 'image/png' | 'image/jpeg' | null {
    const normalized = (mimeType ?? '').trim().toLowerCase();
    if (normalized === 'image/png') {
      return 'image/png';
    }
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
      return 'image/jpeg';
    }
    return null;
  }

  private mimeTypeFromFilename(
    name?: string,
  ): 'image/png' | 'image/jpeg' | null {
    if (!name) {
      return null;
    }
    const lower = name.toLowerCase();
    if (lower.endsWith('.png')) {
      return 'image/png';
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    return null;
  }

  async onSave() {
    if (!this.canSaveShare()) return;

    const exportFile = await this.ensureExportImageFile();
    if (!exportFile) return;

    const currentFilename = this.generatedPdfFilename || 'pdf_cover';
    const nameWithoutExt = currentFilename.replace(/\.pdf$/i, '');

    const modal = await this.modalCtrl.create({
      component: SaveCoverModalComponent,
      componentProps: {
        initialFilename: nameWithoutExt,
        title: this.translate.instant('CHANGE.SAVE_RENAME_TITLE'),
        message: this.translate.instant('CHANGE.SAVE_RENAME_MESSAGE'),
        placeholder: this.translate.instant('CHANGE.SAVE_RENAME_PLACEHOLDER'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmText: this.translate.instant('COMMON.DONE'),
      },
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 1],
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      const newFilename = this.ensurePdfExtension(data);
      await this.performSave(newFilename);
    }
  }

  private ensurePdfExtension(name: string): string {
    return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
  }

  private async performSave(filename: string) {
    this.setBusy('export', 'CHANGE.SAVING');
    try {
      const requestedFilename = this.ensurePdfExtension(filename);

      if (
        this.lastSavedFilename &&
        requestedFilename.toLowerCase() === this.lastSavedFilename.toLowerCase()
      ) {
        const alreadySaved =
          await this.fileService.hasCoverByFilename(requestedFilename);
        if (alreadySaved) {
          await this.showToast(
            'CHANGE.SAVED_OK',
            { duration: 1600 },
            'success',
          );
          return;
        }
        this.lastSavedFilename = undefined;
        this.wasAutoSaved = false;
      }

      const exportFile = await this.ensureExportImageFile();
      if (!exportFile) return;

      if (this.lastSavedFilename) {
        const staleFilename = this.lastSavedFilename;
        try {
          const renamed = await this.fileService.renameGeneratedPdf({
            from: staleFilename,
            to: requestedFilename,
          });
          this.generatedPdfFilename = renamed.filename;
          this.lastSavedFilename = renamed.filename;
        } catch {
          const saved = this.usesNativeRewrite()
            ? this.generatedPdfPath
              ? await this.fileService.saveGeneratedPdfFromPath({
                  sourcePath: this.generatedPdfPath,
                  sourceDir: 'Data',
                  filename: requestedFilename,
                  coverFileForThumb: exportFile,
                  coverMetadata: this.buildCoverProcessingMetadata(),
                })
              : await this.fileService.saveGeneratedPdfFromExistingDocument({
                  sourceFilename: staleFilename,
                  filename: requestedFilename,
                  coverFileForThumb: exportFile,
                  coverMetadata: this.buildCoverProcessingMetadata(),
                })
            : await this.fileService.saveGeneratedPdf({
                bytes: this.generatedPdfBytes!,
                filename: requestedFilename,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
              });
          if (
            staleFilename &&
            staleFilename.toLowerCase() !== saved.filename.toLowerCase()
          ) {
            try {
              await this.fileService.deleteGeneratedPdf(staleFilename);
            } catch {
              // ignore missing stale filename
            }
          }
          this.logSaveFlow('finalWriteComplete', {
            flow: 'performSave',
            filename: saved.filename,
            writeCompletedAt: new Date().toISOString(),
          });
          this.generatedPdfFilename = saved.filename;
          this.lastSavedFilename = saved.filename;
        }
      } else {
        const uniqueFilename =
          await this.resolveUniquePdfFilename(requestedFilename);
        const saved =
          this.usesNativeRewrite() && this.generatedPdfPath
            ? await this.fileService.saveGeneratedPdfFromPath({
                sourcePath: this.generatedPdfPath,
                sourceDir: 'Data',
                filename: uniqueFilename,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
              })
            : await this.fileService.saveGeneratedPdf({
                bytes: this.generatedPdfBytes!,
                filename: uniqueFilename,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
              });
        this.logSaveFlow('finalWriteComplete', {
          flow: 'performSave',
          filename: saved.filename,
          writeCompletedAt: new Date().toISOString(),
        });
        this.generatedPdfFilename = saved.filename;
        this.lastSavedFilename = saved.filename;
      }

      this.coversEvents.emit({
        type: 'saved',
        filename: this.generatedPdfFilename,
      });
      this.logSaveFlow('savedEventEmitted', {
        flow: 'performSave',
        filename: this.generatedPdfFilename,
        emittedAt: new Date().toISOString(),
      });

      await this.showToast('CHANGE.SAVED_OK', { duration: 1600 }, 'success');
    } finally {
      this.zone.run(() => this.setBusy('none'));
    }
  }

  async onShare() {
    if (!this.canSaveShare()) {
      if (this.canGenerate()) {
        await this.showHintOnce(
          'cc_hint_save_share_explain_shown',
          'CHANGE.HINT_SAVE_SHARE_EXPLAIN',
          2200,
        );
      }
      return;
    }

    await this.showToast(
      'COMMON.SHARE_KINDLE_HINT',
      { duration: 2200 },
      'info',
    );

    if (this.lastSavedFilename) {
      await this.fileService.shareCoverByFilename(this.lastSavedFilename);
    } else if (this.usesNativeRewrite() && this.generatedPdfPath) {
      await this.fileService.shareGeneratedPdfFromPath({
        sourcePath: this.generatedPdfPath,
        sourceDir: 'Data',
        filename: this.generatedPdfFilename!,
        title: 'PDF Cover',
      });
    } else {
      await this.fileService.shareGeneratedPdf({
        bytes: this.generatedPdfBytes!,
        filename: this.generatedPdfFilename!,
        title: 'PDF Cover',
      });
    }
  }

  private failImage(err: ImageValidationError | 'CORRUPT', file: File) {
    this.resetSelectedImage();
    this.setImageError(err === 'CORRUPT' ? 'CORRUPT' : err, file);
  }

  private resetSelectedImage() {
    this.selectedImageFile = undefined;
    this.selectedImageName = undefined;
    this.originalImageDims = undefined;
    this.workingImageDims = undefined;
    this.originalImageFile = undefined;
    this.cropState = undefined;
    this.workingImageFile = undefined;
    this.exportImageFile = undefined;
    this.editorSourceFile = undefined;
    this.renderedImageFile = undefined;
    this.renderedImageBlob = undefined;
    this.renderedImageInfo = undefined;
    this.cleanupGeneratedTempOutput();
    this.generatedPdfBytes = undefined;
    this.generatedPdfPath = undefined;
    this.generatedPdfNativePath = undefined;
    this.wasAutoSaved = false;
    this.generatedPdfFilename = undefined;
    this.lastSavedFilename = undefined;

    this.revokePreviewUrl();
    this.previewThumbUrl = undefined;
    this.workingMaxSideApplied = null;
    this.isFrameDetected = false;
    this.isDetectingFrame = false;
  }

  private revokePreviewUrl() {
    if (this.previewUrl) {
      if (this.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this.previewUrl);
      }
      this.previewUrl = undefined;
    }
  }

  private setPreviewUrl(url?: string) {
    this.revokePreviewUrl();
    this.zone.run(() => {
      this.previewUrl = url;
      this.previewNonce += 1;
    });
  }

  private setPreviewThumbUrl(url?: string) {
    this.zone.run(() => {
      this.previewThumbUrl = url;
    });
  }

  private buildDefaultCropState(): CoverCropState {
    return buildDefaultCoverCropState();
  }

  private buildThumbFromCanvas(
    canvas: HTMLCanvasElement,
    size = ChangePage.THUMB_SIZE,
  ): string | null {
    try {
      const thumb = document.createElement('canvas');
      thumb.width = size;
      thumb.height = size;
      const ctx = thumb.getContext('2d');
      if (!ctx) return null;

      const scale = Math.min(
        size / Math.max(1, canvas.width),
        size / Math.max(1, canvas.height),
      );
      const dw = canvas.width * scale;
      const dh = canvas.height * scale;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(canvas, dx, dy, dw, dh);
      return thumb.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    }
  }

  private async buildThumbFromBlob(
    blob: Blob,
    size = ChangePage.THUMB_SIZE,
  ): Promise<string | null> {
    try {
      const thumb = document.createElement('canvas');
      thumb.width = size;
      thumb.height = size;
      const ctx = thumb.getContext('2d');
      if (!ctx) return null;

      const loaded = await this.loadImageFromBlob(blob);
      if (!loaded) return null;
      const { width, height, draw, close } = loaded;

      const scale = Math.min(
        size / Math.max(1, width),
        size / Math.max(1, height),
      );
      const dw = width * scale;
      const dh = height * scale;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;

      ctx.clearRect(0, 0, size, size);
      draw(ctx, dx, dy, dw, dh);
      close?.();

      return thumb.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  private downscaleCanvas(
    src: HTMLCanvasElement,
    maxSide: number,
    preserveHardEdges = false,
  ): HTMLCanvasElement {
    if (!maxSide || maxSide <= 0) return src;

    const sw = src.width;
    const sh = src.height;
    const sMax = Math.max(sw, sh);
    if (sMax <= maxSide) {
      return src;
    }

    const scale = maxSide / sMax;
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));

    const dst = document.createElement('canvas');
    dst.width = dw;
    dst.height = dh;
    const dctx = dst.getContext('2d');
    if (!dctx) return src;
    dctx.imageSmoothingEnabled = !preserveHardEdges;
    if (!preserveHardEdges) {
      dctx.imageSmoothingQuality = 'high';
    }
    dctx.drawImage(src, 0, 0, dw, dh);
    return dst;
  }

  private setOriginalPdfPreviewUrl(file: File): void {
    const url = URL.createObjectURL(file);
    this.revokeOriginalPdfPreviewUrl();
    this.originalPdfPreviewUrl = url;
  }

  private revokeOriginalPdfPreviewUrl(): void {
    if (!this.originalPdfPreviewUrl) {
      return;
    }
    URL.revokeObjectURL(this.originalPdfPreviewUrl);
    this.originalPdfPreviewUrl = null;
  }

  private async loadImageFromBlob(blob: Blob): Promise<{
    width: number;
    height: number;
    draw: (
      ctx: CanvasRenderingContext2D,
      dx: number,
      dy: number,
      dw: number,
      dh: number,
    ) => void;
    close?: () => void;
  } | null> {
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(blob);
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw: (ctx, dx, dy, dw, dh) =>
            ctx.drawImage(
              bitmap,
              0,
              0,
              bitmap.width,
              bitmap.height,
              dx,
              dy,
              dw,
              dh,
            ),
          close: () => bitmap.close?.(),
        };
      } catch {
        // fall back below
      }
    }

    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const cleanup = () => URL.revokeObjectURL(url);

      img.onload = () => {
        cleanup();
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        resolve({
          width,
          height,
          draw: (ctx, dx, dy, dw, dh) =>
            ctx.drawImage(img, 0, 0, width, height, dx, dy, dw, dh),
        });
      };

      img.onerror = () => {
        cleanup();
        resolve(null);
      };

      img.src = url;
    });
  }

  private async ensureNativeRewriteCoverFile(file: File): Promise<File> {
    const targetMime = this.nativeRewriteTargetMimeType();
    const targetExt = this.nativeRewriteTargetExtension();
    if (!targetMime) {
      return targetExt
        ? new File([file], this.renameFileExtension(file.name, targetExt), {
            type: file.type,
          })
        : file;
    }

    // If MIME is missing, force a re-encode to the target format instead of only renaming.
    if (file.type === targetMime) {
      return targetExt
        ? new File([file], this.renameFileExtension(file.name, targetExt), {
            type: targetMime,
          })
        : file;
    }

    const loaded = await this.loadImageFromBlob(file);
    if (!loaded) return file;

    const { width, height, draw, close } = loaded;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      close?.();
      return file;
    }

    draw(ctx, 0, 0, width, height);
    close?.();

    const quality = targetMime === 'image/jpeg' ? 0.92 : undefined;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((nextBlob) => resolve(nextBlob), targetMime, quality),
    );

    if (!blob) return file;

    return new File(
      [blob],
      this.renameFileExtension(file.name, targetExt || 'jpg'),
      { type: targetMime },
    );
  }

  private nativeRewriteTargetExtension(): 'jpg' | 'png' | 'webp' | null {
    const selected = this.getSelectedCoverExportOptions();
    if (selected) {
      return selected.extension;
    }
    return 'jpg';
  }

  private nativeRewriteTargetMimeType(): string | null {
    const ext = this.nativeRewriteTargetExtension();
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'jpg') return 'image/jpeg';
    return null;
  }

  private renameFileExtension(name: string, ext: string): string {
    const base = (name || 'cover').replace(/\.[^.]+$/, '');
    return `${base}.${ext}`;
  }

  private cleanupGeneratedTempOutput() {
    const path = this.generatedPdfPath;
    if (!path || path === this.workingPdfPath) return;
    void this.workingCopy.cleanupWorkingCopy(path);
  }

  private activateInvalidCoverFallback() {
    this.revokePreviewUrl();
    this.setPreviewThumbUrl(undefined);
    this.originalImageFile = undefined;
    this.selectedImageFile = undefined;
    this.selectedImageName = undefined;
    this.originalImageDims = undefined;
    this.workingImageDims = undefined;
    this.workingImageFile = undefined;
    this.exportImageFile = undefined;
    this.editorSourceFile = undefined;
    this.renderedImageFile = undefined;
    this.renderedImageBlob = undefined;
    this.renderedImageInfo = undefined;
    this.cropState = undefined;
    this.targetWidth = undefined;
    this.targetHeight = undefined;
    this.workingMaxSideApplied = null;
    this.isFrameDetected = false;
    this.isDetectingFrame = false;
    this.clearImageError();
    this.imageWarnKey = this.invalidCoverWarnKey;
    this.imageWarnParams = {};
    this.resetBestCandidateState(true);
  }

  private async activateBestCandidateFallback(): Promise<void> {
    const firstPageApplied = await this.tryApplyFirstPageCoverFallback();
    if (firstPageApplied) {
      this.resetBestCandidateState(true);
      return;
    }
    this.activateInvalidCoverFallback();
    await this.detectCoverAutomatically();
  }

  private async tryApplyFirstPageCoverFallback(): Promise<boolean> {
    let firstPageFile: File | null = null;

    if (this.workingPdfNativePath && this.pdfRewrite.isSupported()) {
      try {
        const extracted = await this.pdfRewrite.extractFirstPagePreviewFile({
          inputPath: this.workingPdfNativePath,
          pdfName: this.selectedPdfName || 'pdf',
          maxDimension: 1600,
        });
        firstPageFile = extracted.file;
        const nativeDims = this.normalizeDims({
          width: extracted.width,
          height: extracted.height,
        });
        if (nativeDims) {
          this.pdfFirstPageDims = nativeDims;
        }
      } catch {
        // Continue with file-based fallback.
      }
    }

    if (!firstPageFile) {
      const candidates = [this.workingPdfFile, this.sourcePdfFile].filter(
        (file): file is File => !!file,
      );
      for (const file of candidates) {
        try {
          const extracted = await this.fileService.extractCoverFromPdfFile(file);
          if (extracted) {
            firstPageFile = extracted;
            const extractedDims = this.normalizeDims(
              await this.imagePipe.getDimensions(extracted),
            );
            if (extractedDims) {
              this.pdfFirstPageDims = extractedDims;
            }
            break;
          }
        } catch {
          // Continue trying next source.
        }
      }
    }

    if (!firstPageFile) {
      return false;
    }

    const coverLoaded = await this.applyImageSource(firstPageFile, false);
    if (!coverLoaded) {
      return false;
    }

    this.coverEntryPath = 'first-page-render';
    this.clearImageWarn();
    return true;
  }

  private resetBestCandidateState(revokeUrls: boolean): void {
    this.bestCandidateRequested = false;
    this.bestCandidateLoading = false;
    this.bestCandidates = [];
    this.selectedBestCandidateId = undefined;
    if (this.previewCandidateOverride) {
      this.closePreview();
    }
    if (revokeUrls) {
      this.revokeCandidateBlobUrls();
    }
  }

  private revokeCandidateBlobUrls(): void {
    for (const url of this.candidateBlobUrls) {
      URL.revokeObjectURL(url);
    }
    this.candidateBlobUrls.clear();
  }

  private candidateFileFromMetadata(candidate: BestCandidateImage): File | null {
    const candidateFile = candidate.metadata?.['file'];
    return candidateFile instanceof File ? candidateFile : null;
  }

  private clearImageWarn() {
    this.imageWarnKey = undefined;
    this.imageWarnParams = {};
  }

  private clearImageError() {
    this.imageErrorKey = undefined;
    this.imageErrorParams = {};
  }

  private setImageError(err: ImageValidationError | 'CORRUPT', file: File) {
    const ext = (file.name.split('.').pop() ?? '').toUpperCase();
    const type = file.type || ext || 'file';

    this.imageErrorKey =
      err === 'UNSUPPORTED_TYPE'
        ? 'CHANGE.IMAGE_ERROR_TYPE'
        : err === 'TOO_LARGE'
          ? 'CHANGE.IMAGE_ERROR_SIZE'
          : 'CHANGE.IMAGE_ERROR_CORRUPT';

    this.imageErrorParams =
      err === 'UNSUPPORTED_TYPE'
        ? { type }
        : err === 'TOO_LARGE'
          ? { maxSize: Math.floor(this.imagePipe.maxBytes / (1024 * 1024)) }
          : {};
  }

  canGenerate(): boolean {
    return this.canExport() && !this.isExporting;
  }

  canShowRemoveAdsEntryPoint(): boolean {
    return !this.adsRemoved && this.billing.canShowRemoveAdsEntryPoint();
  }

  getRemoveAdsCtaSubtitleKey(): string {
    return this.removeAdsPriceFormatted
      ? 'COMMON.REMOVE_ADS_CTA_SUBTITLE_WITH_PRICE'
      : 'COMMON.REMOVE_ADS_CTA_SUBTITLE';
  }

  getRemoveAdsPriceParams(): Record<string, string> {
    return this.removeAdsPriceFormatted
      ? { price: this.removeAdsPriceFormatted }
      : {};
  }

  getRemoveAdsPurchaseState(): 'ready' | 'unavailable' {
    return this.billing.isBillingAvailable() && this.isOnline
      ? 'ready'
      : 'unavailable';
  }

  getRemoveAdsModalDescriptionKey(): string {
    return this.getRemoveAdsPurchaseState() === 'ready'
      ? 'COMMON.REMOVE_ADS_DESCRIPTION'
      : 'COMMON.BILLING_UNAVAILABLE';
  }

  shouldShowRemoveAdsModalPrice(): boolean {
    return (
      this.getRemoveAdsPurchaseState() === 'ready' &&
      !!this.removeAdsPriceFormatted
    );
  }

  canPurchaseRemoveAds(): boolean {
    return (
      this.canShowRemoveAdsEntryPoint() &&
      this.getRemoveAdsPurchaseState() === 'ready' &&
      !this.purchaseBusy
    );
  }

  canRestoreRemoveAds(): boolean {
    return (
      this.canShowRemoveAdsEntryPoint() &&
      this.getRemoveAdsPurchaseState() === 'ready' &&
      !this.purchaseBusy
    );
  }

  private syncRemoveAdsPulse(): void {
    this.maybeTrackRemoveAdsCtaImpression();
    const shouldAnimate = this.canShowRemoveAdsEntryPoint();
    if (!shouldAnimate || typeof globalThis.setInterval !== 'function') {
      this.clearRemoveAdsPulse();
      return;
    }

    if (this.removeAdsPulseInterval) {
      return;
    }

    this.triggerRemoveAdsPulse();
    this.removeAdsPulseInterval = setInterval(() => {
      this.triggerRemoveAdsPulse();
    }, 8000);
  }

  private triggerRemoveAdsPulse(): void {
    this.removeAdsPulseActive = true;

    if (this.removeAdsPulseResetTimeout) {
      clearTimeout(this.removeAdsPulseResetTimeout);
    }

    this.removeAdsPulseResetTimeout = setTimeout(() => {
      this.removeAdsPulseActive = false;
      this.removeAdsPulseResetTimeout = null;
    }, 800);
  }

  private clearRemoveAdsPulse(): void {
    if (this.removeAdsPulseInterval) {
      clearInterval(this.removeAdsPulseInterval);
      this.removeAdsPulseInterval = null;
    }

    if (this.removeAdsPulseResetTimeout) {
      clearTimeout(this.removeAdsPulseResetTimeout);
      this.removeAdsPulseResetTimeout = null;
    }

    this.removeAdsPulseActive = false;
  }

  private maybeTrackRemoveAdsCtaImpression(): void {
    if (
      this.removeAdsCtaImpressionTracked ||
      !this.canShowRemoveAdsEntryPoint()
    ) {
      return;
    }

    this.removeAdsCtaImpressionTracked = true;
    this.trackRemoveAdsEvent('remove_ads_cta_impression', {
      price: this.removeAdsPriceFormatted,
    });
  }

  private trackRemoveAdsEvent(
    eventName: string,
    payload: Record<string, unknown> = {},
  ): void {
    const suffix =
      Object.keys(payload).length > 0 ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[ECC:remove-ads] ${eventName}${suffix}`);
  }

  async openPurchaseModal(): Promise<void> {
    if (!this.canShowRemoveAdsEntryPoint()) {
      return;
    }

    if (this.purchaseBusy) {
      return;
    }

    this.trackRemoveAdsEvent('remove_ads_cta_click', {
      price: this.removeAdsPriceFormatted,
    });

    this.purchaseBusy = true;
    try {
      await this.billing.preparePurchaseUi();
    } finally {
      this.purchaseBusy = false;
    }

    if (!this.canShowRemoveAdsEntryPoint()) {
      return;
    }

    this.trackRemoveAdsEvent('remove_ads_modal_open', {
      price: this.removeAdsPriceFormatted,
    });
    this.purchaseModalOpen = true;
  }

  closePurchaseModal(): void {
    this.purchaseModalOpen = false;
  }

  async onPurchaseRemoveAds(): Promise<void> {
    if (!this.canPurchaseRemoveAds()) {
      return;
    }

    this.purchaseBusy = true;
    try {
      const success = await this.billing.purchaseRemoveAds();
      if (!success) {
        return;
      }

      this.closePurchaseModal();
      this.trackRemoveAdsEvent('remove_ads_purchase_success', {
        price: this.removeAdsPriceFormatted,
      });
      await this.showToast(
        'COMMON.REMOVE_ADS_PURCHASED',
        { duration: 1800 },
        'success',
      );
    } catch {
      await this.showToast(
        'COMMON.PURCHASE_ERROR',
        { duration: 1800 },
        'error',
      );
    } finally {
      this.purchaseBusy = false;
    }
  }

  async onRestorePurchases(): Promise<void> {
    if (!this.canRestoreRemoveAds()) {
      return;
    }

    this.purchaseBusy = true;
    try {
      const restored = await this.billing.restorePurchases();
      if (!restored) {
        await this.showToast(
          'COMMON.RESTORE_ERROR',
          { duration: 1800 },
          'error',
        );
        return;
      }

      this.closePurchaseModal();
      await this.showToast(
        'COMMON.REMOVE_ADS_RESTORED',
        { duration: 1800 },
        'success',
      );
    } catch {
      await this.showToast('COMMON.RESTORE_ERROR', { duration: 1800 }, 'error');
    } finally {
      this.purchaseBusy = false;
    }
  }

  canSaveShare(): boolean {
    const hasGeneratedOutput = this.usesNativeRewrite()
      ? !!(this.generatedPdfPath || this.lastSavedFilename)
      : !!this.generatedPdfBytes;

    return (
      this.canExport() &&
      hasGeneratedOutput &&
      !!this.generatedPdfFilename &&
      !this.isExporting
    );
  }

  getChangeActionKey(): string {
    return this.adsRemoved
      ? 'CHANGE.CHANGE_ACTION'
      : 'CHANGE.CHANGE_ACTION_REWARDED';
  }

  shouldShowExportOptions(): boolean {
    return (
      this.hasValidPdf() &&
      !!(this.editorSourceFile ?? this.workingImageFile) &&
      !this.imageErrorKey
    );
  }

  shouldShowInsertTocWarning(): boolean {
    return this.hasValidPdf() && this.coverPageMode === 'insert';
  }

  getEffectiveExportQualityMode(): ExportQualityMode {
    return normalizeExportQualityMode(this.exportQualityMode, this.adsRemoved);
  }

  shouldShowPreviewLongPressHint(): boolean {
    return !!this.previewUrl && this.currentPreviewOrigin === 'edited';
  }

  async onExportQualityModeSelect(mode: ExportQualityMode): Promise<void> {
    const normalized = normalizeExportQualityMode(mode, this.adsRemoved);
    if (normalized !== mode) {
      await this.openPurchaseModal();
      return;
    }

    if (this.exportQualityMode === mode) {
      return;
    }

    this.exportQualityMode = mode;
    this.exportImageFile = undefined;
    this.invalidateGeneratedOutputState();
    await this.settings.setForScope('exportQuality', { exportQualityMode: mode });
  }

  onCoverPageModeChange(mode: CoverPageMode): void {
    if (this.coverPageMode === mode) return;
    this.coverPageMode = mode;
    this.invalidateGeneratedOutputState();
  }

  private syncAuthorizedExportQualityMode(reason: string): void {
    const normalized = normalizeExportQualityMode(
      this.exportQualityMode,
      this.adsRemoved,
    );
    if (normalized === this.exportQualityMode) {
      return;
    }

    this.exportQualityMode = normalized;
    this.exportImageFile = undefined;
    this.invalidateGeneratedOutputState();
    void this.settings.setForScope('exportQuality', {
      exportQualityMode: normalized,
    });
  }

  shouldShowDitheringHint(): boolean {
    return this.isPreviewDithered();
  }

  async onGenerate() {
    if (!this.canGenerate()) return;

    this.setBusy('export', 'CHANGE.GENERATING');

    try {
      if (!this.billing.isAdsRemoved()) {
        const result: RewardedAdResult = await this.ads.showRewarded();

        // Handle ad failure
        if (result.failed) {
          await this.showToast(
            'CHANGE.ADS_REQUIRED',
            { duration: 1800 },
            'error',
          );
          return;
        }

        // Handle ad closed without reward (user didn't watch it completely)
        if (result.adClosed && !result.rewardEarned) {
          await this.showToast(
            'CHANGE.ADS_REQUIRED',
            { duration: 1800 },
            'error',
          );
          return;
        }

        // Only proceed if BOTH reward earned AND ad closed
        if (!result.rewardEarned || !result.adClosed) {
          return;
        }

        this.trackRemoveAdsEvent('rewarded_generate_completed');
      }

      await this.generateChangedCover();
    } finally {
      this.zone.run(() => this.setBusy('none'));
    }
  }

  private async generateChangedCover(): Promise<void> {
    const exportFile = await this.ensureExportImageFile();
    if (!exportFile) return;

    const preferredFilename = this.outputBaseName
      ? `${this.outputBaseName}.pdf`
      : this.selectedPdfName;

    if (this.usesNativeRewrite()) {
      await this.generateWithNativeRewrite(exportFile, preferredFilename);
      await this.homeTour.completeInteraction('cover-created');
      return;
    }

    const sourcePdf = this.workingPdfFile;
    let res: { bytes: Uint8Array; filename: string };
    if (sourcePdf) {
      try {
        res = await this.fileService.generatePdfBytesFromSource({
          sourcePdfFile: sourcePdf,
          coverFile: exportFile,
          filename: preferredFilename,
          coverMode: this.coverPageMode,
        });
      } catch {
        res = await this.fileService.generatePdfBytes({
          modelId: this.baseModelId,
          coverFile: exportFile,
          title: 'PDF Cover',
        });
      }
    } else {
      res = await this.fileService.generatePdfBytes({
        modelId: this.baseModelId,
        coverFile: exportFile,
        title: 'PDF Cover',
      });
    }

    this.generatedPdfBytes = res.bytes;
    this.generatedPdfFilename = await this.resolveUniquePdfFilename(
      res.filename,
    );

    this.setBusy('export', 'CHANGE.SAVING');

    const saved = await this.fileService.saveGeneratedPdf({
      bytes: this.generatedPdfBytes,
      filename: this.generatedPdfFilename,
      coverFileForThumb: exportFile,
      coverMetadata: this.buildCoverProcessingMetadata(),
    });
    this.logSaveFlow('finalWriteComplete', {
      flow: 'onGenerate',
      filename: saved.filename,
      writeCompletedAt: new Date().toISOString(),
    });

    this.generatedPdfFilename = saved.filename;

    this.coversEvents.emit({
      type: 'saved',
      filename: saved.filename,
    });
    this.logSaveFlow('savedEventEmitted', {
      flow: 'onGenerate',
      filename: saved.filename,
      emittedAt: new Date().toISOString(),
    });

    this.wasAutoSaved = true;
    this.lastSavedFilename = saved.filename;

    await this.zone.run(async () => {
      await this.showToast(
        'CHANGE.COVER_CHANGED',
        { duration: 2200 },
        'success',
      );
    });
    await this.maybeAskForRatingAfterSuccessfulSave('web');
    await this.homeTour.completeInteraction('cover-created');
  }

  private async resolveUniquePdfFilename(
    requestedFilename: string,
  ): Promise<string> {
    const normalized = this.ensurePdfExtension(requestedFilename);
    const base = normalized.replace(/\.pdf$/i, '').trim() || 'pdf';
    let candidate = `${base}.pdf`;
    let index = 1;

    while (await this.fileService.hasCoverByFilename(candidate)) {
      candidate = `${base} (${index}).pdf`;
      index += 1;
    }

    return candidate;
  }

  private invalidateGeneratedOutputState(): void {
    this.cleanupGeneratedTempOutput();
    this.generatedPdfBytes = undefined;
    this.generatedPdfPath = undefined;
    this.generatedPdfNativePath = undefined;
    this.generatedPdfFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;
  }

  async cancelNativeRewrite() {
    if (!this.isNativeRewriteInProgress || this.isCancellingNativeRewrite) {
      return;
    }

    this.isCancellingNativeRewrite = true;
    await this.pdfRewrite.cancelRewrite();
  }

  private async generateWithNativeRewrite(
    exportFile: File,
    preferredFilename?: string,
  ) {
    if (!this.workingPdfNativePath || !this.workingPdfPath) {
      throw new PdfRewriteError('REWRITE_UNAVAILABLE');
    }

    const outputBaseName = this.outputBaseName || 'pdf';
    const rewriteCoverFile =
      await this.ensureNativeRewriteCoverFile(exportFile);
    const tempCover = await this.workingCopy.writeTempCoverFile(
      rewriteCoverFile,
      outputBaseName,
    );
    const requestedFilename = this.ensurePdfExtension(
      preferredFilename || `${outputBaseName}.pdf`,
    );
    const outputTarget =
      await this.fileService.reserveNativeDocumentOutput(requestedFilename);

    this.isNativeRewriteInProgress = true;
    this.isCancellingNativeRewrite = false;
    this.rewriteProgressPercent = 0;

    try {
      const result = await this.pdfRewrite.rewriteCover({
        inputPath: this.workingPdfNativePath,
        outputPath: outputTarget.nativePath,
        newCoverPath: tempCover.nativePath,
        mode: this.coverPageMode,
      });

      if (!result.success) {
        if (result.error === 'CANCELLED') {
          await this.showToast(
            'CHANGE.PROCESS_CANCELLED',
            { duration: 1600 },
            'info',
          );
          return;
        }

        throw new PdfRewriteError(result.error ?? 'REWRITE_FAILED', {
          message: result.message,
          stage: result.stage,
          requiredBytes: result.requiredBytes,
          availableBytes: result.availableBytes,
        });
      }

      this.generatedPdfBytes = undefined;
      this.generatedPdfPath = undefined;
      this.generatedPdfNativePath = outputTarget.nativePath;
      this.generatedPdfFilename = outputTarget.filename;
      this.rewriteProgressPercent = 100;
      this.logSaveFlow('finalWriteComplete', {
        flow: 'nativeRewrite',
        filename: outputTarget.filename,
        outputPath: outputTarget.nativePath,
        writeCompletedAt: new Date().toISOString(),
      });

      this.setBusy('export', 'CHANGE.SAVING');
      await this.fileService.persistCoverAssetsForGeneratedFilename({
        filename: outputTarget.filename,
        coverFileForThumb: rewriteCoverFile,
        coverMetadata: this.buildCoverProcessingMetadata(),
      });

      this.coversEvents.emit({
        type: 'saved',
        filename: outputTarget.filename,
      });
      this.logSaveFlow('savedEventEmitted', {
        flow: 'nativeRewrite',
        filename: outputTarget.filename,
        emittedAt: new Date().toISOString(),
      });

      this.wasAutoSaved = true;
      this.lastSavedFilename = outputTarget.filename;

      await this.showToast(
        'CHANGE.COVER_CHANGED',
        { duration: 2200 },
        'success',
      );
      await this.maybeAskForRatingAfterSuccessfulSave('native');
    } catch (error) {
      this.maybeDisableNativeRewriteForSession(error, 'rewrite_cover');
      if (!(error instanceof PdfRewriteError) || error.code !== 'CANCELLED') {
        const toastMessage = this.mapNativeRewriteToast(error);
        await this.showToast(
          toastMessage.key,
          { duration: 2200 },
          'error',
          toastMessage.params,
        );
      }
    } finally {
      this.isNativeRewriteInProgress = false;
      this.isCancellingNativeRewrite = false;
      await this.workingCopy.cleanupWorkingCopy(tempCover.path);
    }
  }

  private usesNativeRewrite(): boolean {
    return (
      Capacitor.getPlatform() === 'android' &&
      this.pdfRewrite.isSupported() &&
      !this.nativeRewriteSessionDisabled &&
      !this.nativeRewriteSdkBlocked
    );
  }

  private async initializeNativeRewriteSafetyGate(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      this.nativeRewriteSdkBlocked = false;
      return;
    }

    try {
      const info = await Device.getInfo();
      const sdk = this.resolveAndroidSdk(info);
      // The native PDF plugin uses Java APIs that are riskier on API 24/25.
      this.nativeRewriteSdkBlocked = sdk !== null && sdk < 26;
    } catch {
      // If we cannot read device info, keep native enabled and let runtime checks decide.
      this.nativeRewriteSdkBlocked = false;
    }
  }

  private resolveAndroidSdk(info: unknown): number | null {
    if (!info || typeof info !== 'object') {
      return null;
    }

    const maybeInfo = info as {
      androidSDKVersion?: number;
      osVersion?: string;
    };

    if (typeof maybeInfo.androidSDKVersion === 'number') {
      return Number.isFinite(maybeInfo.androidSDKVersion)
        ? maybeInfo.androidSDKVersion
        : null;
    }

    const osVersion = maybeInfo.osVersion;
    if (!osVersion) {
      return null;
    }

    const major = Number.parseInt(osVersion.split('.')[0], 10);
    if (!Number.isFinite(major)) {
      return null;
    }

    // Fallback heuristic only when sdk is unavailable.
    if (major <= 7) return 24;
    if (major === 8) return 26;
    if (major === 9) return 28;
    if (major === 10) return 29;
    if (major === 11) return 30;
    if (major === 12) return 31;
    if (major === 13) return 33;
    if (major >= 14) return 34;
    return null;
  }

  private maybeDisableNativeRewriteForSession(
    error: unknown,
    _stage: 'pick_pdf' | 'rewrite_cover',
  ): void {
    if (error instanceof PdfRewriteError) {
      // User/content/storage errors should not permanently disable native in-session.
      if (
        error.code === 'PICK_CANCELLED' ||
        error.code === 'CANCELLED' ||
        error.code === 'PDF_TOO_LARGE' ||
        error.code === 'NO_SPACE' ||
        error.code === 'PDF_CORRUPT' ||
        error.code === 'PDF_ENCRYPTED' ||
        error.code === 'PDF_PASSWORD_REQUIRED' ||
        error.code === 'UNSUPPORTED_PDF' ||
        error.code === 'REWRITE_FAILED'
      ) {
        return;
      }
    }

    this.nativeRewriteSessionDisabled = true;
  }

  private mapNativePdfError(error: unknown): string {
    if (error instanceof PdfRewriteError && error.code === 'PDF_TOO_LARGE') {
      return 'PDF_ERROR_SIZE';
    }
    if (error instanceof PdfRewriteError && error.code === 'NO_SPACE') {
      return 'PDF_ERROR_STORAGE';
    }
    if (error instanceof PdfRewriteError && error.code === 'PDF_ENCRYPTED') {
      return 'PDF_ERROR_TYPE';
    }
    if (
      error instanceof PdfRewriteError &&
      error.code === 'PDF_PASSWORD_REQUIRED'
    ) {
      return 'PDF_ERROR_TYPE';
    }
    if (
      error instanceof PdfRewriteError &&
      error.code === 'UNSUPPORTED_PDF'
    ) {
      return 'PDF_ERROR_TYPE';
    }
    return 'PDF_ERROR_CORRUPT';
  }

  private mapNativeRewriteToast(error: unknown): {
    key: string;
    params?: Record<string, unknown>;
  } {
    if (error instanceof PdfRewriteError && error.code === 'NO_SPACE') {
      return {
        key: 'CHANGE.PDF_ERROR_STORAGE',
        params: this.buildNativeStorageErrorParams(error),
      };
    }

    if (
      error instanceof PdfRewriteError &&
      (error.code === 'PDF_ENCRYPTED' ||
        error.code === 'PDF_PASSWORD_REQUIRED' ||
        error.code === 'UNSUPPORTED_PDF')
    ) {
      return { key: 'CHANGE.PDF_ERROR_TYPE' };
    }

    return { key: 'CHANGE.PDF_ERROR_REWRITE' };
  }

  private mapValidationErrorToUiKey(
    errorKey: string | undefined,
  ): string {
    if (!errorKey) return 'PDF_ERROR_CORRUPT';
    if (errorKey === 'PDF_ERROR_EMPTY') return 'PDF_ERROR_CORRUPT';
    if (errorKey === 'PDF_ERROR_NO_FILE') return 'PDF_ERROR_TYPE';
    if (errorKey === 'PDF_ERROR_CANCELLED') return 'PDF_ERROR_CORRUPT';
    return errorKey;
  }

  private buildNativeStorageErrorParams(
    error: unknown,
  ): Record<string, unknown> {
    if (!(error instanceof PdfRewriteError)) {
      return {};
    }

    const requiredBytes = error.details?.requiredBytes;
    const availableBytes = error.details?.availableBytes;
    if (
      !Number.isFinite(requiredBytes as number) ||
      !Number.isFinite(availableBytes as number)
    ) {
      return {};
    }

    const requiredMB = Math.ceil((requiredBytes as number) / (1024 * 1024));
    const availableMB = Math.max(
      0,
      Math.floor((availableBytes as number) / (1024 * 1024)),
    );

    return { requiredMB, availableMB };
  }

  private async showHintOnce(
    storageKey: string,
    i18nKey: string,
    duration = 2200,
  ) {
    const settings = await this.settings.load();
    const shown = settings.preferences?.[storageKey] === true;
    if (shown) return;

    await this.showToast(i18nKey, { duration }, 'success');

    await this.settings.set((prev) => ({
      ...prev,
      preferences: {
        ...(prev.preferences ?? {}),
        [storageKey]: true,
      },
    }));
  }

  openInfo() {
    this.infoEvent = null;
    this.infoOpen = true;
  }

  toggleInfo() {
    if (this.infoOpen) {
      this.closeInfo();
    } else {
      this.infoEvent = null;
      this.infoOpen = true;
    }
  }

  closeInfo() {
    this.infoOpen = false;
    this.infoEvent = null;
  }

  openPreview() {
    if (!this.previewUrl) return;
    this.previewCandidateOverride = null;
    this.previewOpen = true;
  }

  closePreview() {
    this.previewOpen = false;
    this.previewCandidateOverride = null;
    this.suppressNextImagePick = false;
  }

  shouldShowComparePreview(): boolean {
    return !!this.previewUrl && this.currentPreviewOrigin !== 'source-pdf';
  }

  isPreviewDithered(): boolean {
    return isDitheringEnabled(this.cropState);
  }

  private buildCoverProcessingMetadata(): CoverProcessingMetadataInput {
    const colorMode = resolveCoverColorMode(this.cropState);
    const artifactReductionMode = resolveArtifactReductionMode(this.cropState);
    const isDithered = isDitheringEnabled(this.cropState);
    const ditheringMode = this.cropState?.dithering?.mode ?? 'floyd-steinberg';
    return {
      colorMode,
      artifactReductionEnabled: isArtifactReductionEnabled(this.cropState),
      artifactReductionMode,
      isDithered,
      ditherAlgorithm: isDithered
        ? ditheringMode === 'ordered'
          ? 'ordered-bayer-4x4'
          : 'floyd-steinberg'
        : null,
    };
  }

  onPreviewPressStart() {
    if (!this.previewUrl) return;
    this.clearPreviewLongPress();
    this.previewLongPressTimer = setTimeout(() => {
      this.suppressNextImagePick = true;
      this.openPreview();
    }, 450);
  }

  onPreviewPressEnd() {
    this.clearPreviewLongPress();
  }

  private clearPreviewLongPress() {
    if (this.previewLongPressTimer) {
      clearTimeout(this.previewLongPressTimer);
      this.previewLongPressTimer = null;
    }
  }

  ionViewWillLeave() {
    this.closeInfo();
  }

  ionViewWillEnter() {
    this.consumeEditorResult();
    void this.refreshHeaderItems();
  }

  async ionViewDidEnter() {
    this.homeTour.registerContent(this.content);
    await this.maybeStartHomeTour(
      this.homeTour.consumePendingManualStart(HOME_TOUR_ID),
    );
  }

  onTourContentScroll() {
    this.homeTour.requestSync();
  }

  private async refreshHeaderItems(): Promise<void> {
    this.recommendedApps =
      await this.recommendedAppsService.getRecommendedApps();
    this.showRecommended = this.recommendedApps.length > 0;
    this.headerItems = buildHomeHeaderItems(this.showRecommended, {
      appsLabel: this.translate.instant('ARR.TOOLS.APPS'),
      guideLabel: this.translate.instant('ARR.TOOLS.GUIDE'),
    });
  }

  async onHeaderItemClick(id: string): Promise<void> {
    await handleHomeHeaderAction(id, {
      closeInfo: () => this.closeInfo(),
      toggleInfo: () => this.toggleInfo(),
      navigateToRecommended: async () => {
        await this.router.navigateByUrl('/recommended-apps');
      },
    });
  }

  private async consumeEditorResult(): Promise<void> {
    let result: EditorResult | null = null;

    if (this.lastEditorSessionId) {
      result = this.editorSession.consumeResult(this.lastEditorSessionId);
      this.lastEditorSessionId = undefined;
    }

    if (!result) {
      result = this.editorSession.consumeLatestResult();
    }

    if (result?.file) {
      await this.applyCropResult(result);
    }
  }

  private async showToast(
    messageKey: string,
    opts: Partial<ToastOptions> = {},
    variant: 'success' | 'error' | 'info' = 'success',
    params?: Record<string, unknown>,
  ) {
    const extra = opts.cssClass
      ? Array.isArray(opts.cssClass)
        ? opts.cssClass
        : [opts.cssClass]
      : [];

    const toast = await this.toastCtrl.create({
      ...opts,
      message: this.translate.instant(messageKey, params),
      position: 'middle',
      duration: opts.duration ?? 1800,
      animated: true,
      translucent: true,
      cssClass: ['cc-toast', `cc-toast--${variant}`, ...extra],
    });

    await toast.present();
  }

  private computeDownscaleDims(
    width: number,
    height: number,
    maxSide: number,
  ): { width: number; height: number; applied: boolean } {
    const max = Math.max(width, height);
    if (!maxSide || maxSide <= 0 || max <= maxSide) {
      return { width, height, applied: false };
    }
    const scale = maxSide / max;
    const dw = Math.max(1, Math.round(width * scale));
    const dh = Math.max(1, Math.round(height * scale));
    return { width: dw, height: dh, applied: true };
  }

  private applyLayoutBase(
    state: CoverCropState,
    target: CropTarget,
  ): CoverCropState {
    const next: CoverCropState = { ...state };
    next.frameWidth = target.width;
    next.frameHeight = target.height;
    return next;
  }

  private normalizeRenderedInfo(result: EditorResult): {
    width: number;
    height: number;
    mimeType: string;
    formatId?: string;
  } | null {
    const width = result.renderedWidth;
    const height = result.renderedHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    const mimeType =
      result.renderedMimeType || result.renderedBlob?.type || 'image/png';
    return {
      width: width as number,
      height: height as number,
      mimeType,
      formatId: result.formatId,
    };
  }

  private buildRenderedFile(blob: Blob, mimeType?: string): File {
    const type = mimeType || blob.type || 'image/png';
    const ext = type === 'image/png' ? 'png' : 'jpg';
    const baseName =
      (
        this.selectedImageName ||
        this.originalImageFile?.name ||
        'cover'
      )?.replace(/\.(png|jpg|jpeg|webp)$/i, '') || 'cover';
    return new File([blob], `${baseName}_rendered.${ext}`, { type });
  }

  private resolveFormatId(formatId?: string): string {
    if (
      formatId === ChangePage.FORMAT_ID_WITH_FRAME ||
      formatId === ChangePage.FORMAT_ID_WITHOUT_FRAME
    ) {
      return formatId;
    }

    return ChangePage.FORMAT_ID_WITHOUT_FRAME;
  }

  private async resolveExportDimsForSmallWarn(): Promise<{
    width: number;
    height: number;
  } | null> {
    const compositionInput = this.buildCompositionInput('export');
    const croppedSourceDims = compositionInput
      ? computeSourceCropDims(compositionInput)
      : null;
    if (croppedSourceDims) {
      return croppedSourceDims;
    }

    const exportFile =
      this.exportImageFile ?? (await this.ensureExportImageFile());
    if (!exportFile) return null;
    const dims = await this.imagePipe.getDimensions(exportFile);
    return dims ?? null;
  }

  private debugSmallWarn(data: {
    reason: string;
    targetId: string;
    target: { width: number; height: number };
    exportDims: { width: number; height: number } | null;
    legacyDims: { width: number; height: number } | null;
    usedDims: { width: number; height: number } | null;
    willWarn: boolean;
  }): void {
    if (!this.isSmallWarnDebugEnabled()) return;
    console.info('[ECC][SMALL_WARN_DEBUG]', data);
  }

  private isSmallWarnDebugEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as Window & { __CC_WARN_DEBUG__?: boolean };
    if (w.__CC_WARN_DEBUG__ === true) return true;
    try {
      return localStorage.getItem(this.warnDebugKey) === '1';
    } catch {
      return false;
    }
  }

  private async persistCropTargetId(formatId: string): Promise<void> {
    const resolved = this.resolveFormatId(formatId);
    this.persistedCropTargetId = resolved;
    await this.settings.set({ cropTargetId: resolved });
  }

  private async maybeAskForRatingAfterSuccessfulSave(
    flow: 'native' | 'web',
  ): Promise<void> {
    await this.ratingService.trackSuccessEvent('pdf_saved');
    await this.ratingService.maybeAskForRating({
      source: 'save-success',
      metadata: { flow },
    });
  }

  private async maybeStartHomeTour(force = false): Promise<void> {
    if (this.homeTour.isActive()) {
      return;
    }

    const settings = await this.settings.load();
    if (!force && !this.shouldAutoStartHomeTour(settings)) {
      return;
    }

    await this.ensureTourLocaleReady(settings);
    this.closeInfo();
    await this.homeTour.start(buildHomeTourDefinition(this.translate), {
      onComplete: async (reason: TourCompletionReason) => {
        await this.markHomeTourSeen(reason);
      },
    });
  }

  private async ensureTourLocaleReady(settings: PcmSettings): Promise<void> {
    const expectedLanguage =
      settings.language ?? (await detectSupportedLocale());
    if (this.translate.currentLang === expectedLanguage) {
      return;
    }

    await firstValueFrom(this.translate.use(expectedLanguage));
  }

  private shouldAutoStartHomeTour(settings: PcmSettings): boolean {
    return (settings.homeTourVersion ?? 0) < CURRENT_HOME_TOUR_VERSION;
  }

  private async markHomeTourSeen(_reason: TourCompletionReason): Promise<void> {
    await this.settings.set((prev) => ({
      ...prev,
      homeTourSeen: true,
      homeTourVersion: CURRENT_HOME_TOUR_VERSION,
      homeTourSeenAt: new Date().toISOString(),
      preferences: {
        ...(prev.preferences ?? {}),
        [this.editorTourSeenVersionKey]: this.currentEditorTourVersion,
      },
    }));
  }

  private async shouldShowEditorTour(): Promise<boolean> {
    const settings = await this.settings.load();
    const seenVersion = settings.preferences?.[this.editorTourSeenVersionKey];
    return (
      typeof seenVersion !== 'number' ||
      seenVersion < this.currentEditorTourVersion
    );
  }

  private logSaveFlow(event: string, payload?: Record<string, unknown>): void {
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[ECC:change:save-flow] ${event}${suffix}`);
  }
}

