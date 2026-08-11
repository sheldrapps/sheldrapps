import {
  ChangeDetectorRef,
  Component,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
  NgZone,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Device } from '@capacitor/device';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonIcon,
  IonButton,
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
  CoverSourceActionsComponent,
  CoverCropState,
  CoverImageStateComponent,
  ImagePipelineService,
  PreviewEditingPageService,
  ImageValidationError,
  buildCompositionInputForPurpose,
  isArtifactReductionEnabled,
  isDitheringEnabled,
  encodeRenderedBlob,
  renderCompositionToCanvas,
  renderCompositionToFile,
  toEditorRenderQuality,
  updateEditorRenderQuality,
  type EditorRenderInfo,
  resolveArtifactReductionMode,
  resolveCoverColorMode,
} from '@sheldrapps/image-workflow';
import type {
  CropTarget,
  CropFormatOption,
} from '@sheldrapps/image-workflow';
import {
  EditorSessionService,
  EditorSessionExitService,
  consumeEditorResultSnapshot,
  ProjectSaveState,
} from '@sheldrapps/image-workflow/editor';
import type {
  CropTargetCategory,
  CropTargetCategoryConfig,
  CropTargetPreset,
  CropTargetsConfig,
} from '@sheldrapps/image-workflow/editor';

import {
  imageOutline,
  alertCircleOutline,
  checkmarkCircle,
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
  getCoverExportOptions,
  normalizeExportQualityMode,
  type ExportQualityMode,
} from '@sheldrapps/export-quality-kit';
import {
  AdFallbackService,
  type AdFallbackTelemetryEventName,
  type AdFallbackTelemetryPayload,
  type AdFailureConfidence,
  type AdFailureReason,
} from '@sheldrapps/ad-fallback-kit';
import {
  PURCHASE_INTENT_QUERY_PARAM,
  REMOVE_ADS_PURCHASE_INTENT,
  RemoveAdsPurchasePageService,
} from '@sheldrapps/ads-kit';
import { CoverPageMode } from '@sheldrapps/cover-page-mode-kit';
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
import { RatingService } from '@sheldrapps/rating-kit';
import {
  SpinnerComponent,
  ActionCardComponent,
  RenameIconComponent,
  ProBadgeComponent,
  SaveCoverModalComponent,
  ScrollableBarItem,
  ScrollableButtonBarComponent,
  TripleButtonComponent,
  WorkflowNavigationComponent,
  WorkflowStepperComponent,
} from '@sheldrapps/ui-theme';
import type { WorkflowStep } from '@sheldrapps/ui-theme';
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
import type { PdfPageDimension } from '../../services/pdf-candidate-image.service';
import { TourService } from '../../shared/tour/tour.service';
import {
  LifecycleDiagnosticsService,
  WorkflowRecoveryCoordinator,
} from '@sheldrapps/lifecycle-kit';

type EditorResult = {
  file: File;
  state?: CoverCropState;
  formatId?: string;
  renderedBlob?: Blob;
  editorMasterBlob?: Blob;
  renderedWidth?: number;
  renderedHeight?: number;
  renderInfo?: EditorRenderInfo;
  renderedMimeType?: string;
};

type EditorSourceMode = 'image' | 'scratch';

type FrameDetectionResult = {
  hasFrame: boolean;
};

type PcmRecoverySnapshot = {
  workflowStep: number;
  workingPdfPath?: string;
  workingPdfNativePath?: string;
  workingPdfName?: string;
  outputBaseName?: string;
  selectedPdfName?: string;
  generatedPdfPath?: string;
  generatedPdfFilename?: string;
  lastSavedFilename?: string;
  selectedFormatId: string;
  exportQualityMode: ExportQualityMode;
  originalImageDims?: { width: number; height: number };
  workingImageDims?: { width: number; height: number };
  selectedImageName?: string;
  cropState?: CoverCropState;
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
    IonIcon,
    IonButton,
    IonRow,
    IonGrid,
    IonPopover,
    SpinnerComponent,
    ActionCardComponent,
    RenameIconComponent,
    ProBadgeComponent,
    CoverImageStateComponent,
    CoverSourceActionsComponent,
    ScrollableButtonBarComponent,
    TripleButtonComponent,
    BestCandidatePickerComponent,
    WorkflowNavigationComponent,
    WorkflowStepperComponent,
  ],
})
export class ChangePage implements OnInit, OnDestroy {
  private static readonly PREVIEW_MAX_SIDE = 1280;
  private static readonly THUMB_SIZE = 96;
  private static readonly FORMAT_ID_AUTO = 'auto';
  private static readonly FORMAT_ID_A4 = 'a4';
  private static readonly FORMAT_ID_A3 = 'a3';
  private static readonly FORMAT_ID_A5 = 'a5';
  private static readonly FORMAT_ID_A6 = 'a6';
  private static readonly FORMAT_ID_LETTER = 'letter';
  private static readonly FORMAT_ID_LEGAL = 'legal';
  private static readonly FORMAT_ID_TABLOID = 'tabloid';
  private static readonly FORMAT_ID_NINE_SIXTEEN = 'nine_sixteen';
  private static readonly FORMAT_ID_THREE_FOUR = 'three_four';
  private static readonly FORMAT_ID_ONE_ONE = 'one_one';
  private static readonly FORMAT_ID_CUSTOM = 'custom';
  private static readonly CROP_TARGET_I18N_PREFIX =
    'EDITOR.PANELS.TOOLS.WIDGETS.CROP_PANEL';
  private modalCtrl = inject(ModalController);
  private fileService = inject(FileService);
  private workingCopy = inject(PdfWorkingCopyService);
  private pdfRewrite = inject(PdfRewriteService);
  private imagePipe = inject(ImagePipelineService);
  private readonly previewEditingPage = inject(PreviewEditingPageService);
  private billing = inject(BillingService);
  private removeAdsPurchasePage = inject(RemoveAdsPurchasePageService);
  private toastCtrl = inject(ToastController);
  private popoverCtrl = inject(PopoverController);
  private coversEvents = inject(CoversEventsService);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);
  private changeDetector = inject(ChangeDetectorRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private editorSession = inject(EditorSessionService);
  private editorSessionExit = inject(EditorSessionExitService);
  private settings = inject(SettingsStore<PcmSettings>);
  private ratingService = inject(RatingService);
  private recommendedAppsService = inject(RecommendedAppsService);
  private bestCandidateService = inject(BestCandidateService);
  private candidateImageService = inject(PdfCandidateImageService);
  private homeTour = inject(TourService);
  private appInjector = inject(Injector);
  private readonly lifecycle = inject(LifecycleDiagnosticsService);
  private readonly recovery = inject(WorkflowRecoveryCoordinator);
  private readonly baseTarget = { width: 1236, height: 1648 };
  private readonly baseModelId = 'pdf';
  private readonly maxPdfSizeMB = 2048;
  private routerSub?: Subscription;
  private coversEventsSub?: Subscription;
  private rewriteProgressSub?: PluginListenerHandle;
  private lastEditorSessionId?: string;
  private editorTargetOverride?: CropTarget;
  private lastEditorRenderInfo?: EditorRenderInfo;
  private lastEditorSourceMode: EditorSourceMode = 'image';
  private previewLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressNextImagePick = false;
  private workingMaxSideApplied: boolean | null = null;
  private persistedCropTargetId = 'pdf';
  private readonly artifactReductionInfoSeenKey =
    'pcm_editor_artifact_reduction_info_seen';
  private readonly editorEReaderOptimizationFeatureEnabled = true;
  private projectEditReturnUrl: string | null = null;
  private lastHandledProjectRouteKey: string | null = null;
  private isOpeningProjectFromRoute = false;
  private adFallbackTrialActive = false;
  private readonly adFallbackTotal = 1;
  private adFallbackRemaining = this.adFallbackTotal;
  private readonly adFallbackApp = 'pcm' as const;
  private readonly adFallbackRemainingPrefKey = 'pcm_ad_fallback_remaining';
  private readonly adFallbackTrialActivePrefKey = 'pcm_ad_fallback_trial_active';
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
  private editorOpenedFromCurrentCover = false;

  readonly workflowSteps: readonly WorkflowStep[] = [
    { id: 'pdf', label: this.translate.instant('CHANGE.STEPPER.PDF') },
    { id: 'cover-mode', label: this.translate.instant('CHANGE.STEPPER.PAGE_1') },
    { id: 'cover', label: this.translate.instant('CHANGE.STEPPER.COVER') },
    { id: 'adjust', label: this.translate.instant('CHANGE.STEPPER.ADJUST') },
    { id: 'create', label: this.translate.instant('CHANGE.STEPPER.CREATE') },
  ];
  workflowStep = 0;

  @ViewChild(IonContent) content?: IonContent;
  @ViewChild('pdfInput') pdfInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  constructor() {
    addIcons({
      checkmarkCircle,
      closeCircleOutline,
      alertCircleOutline,
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
  private readonly purchaseBusyState = signal(false);

  get purchaseBusy(): boolean {
    return this.purchaseBusyState();
  }

  set purchaseBusy(value: boolean) {
    this.purchaseBusyState.set(value);
  }
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
  pdfPageTargets: PdfPageDimension[] = [];
  pdfErrorKey?: string;
  pdfErrorParams: Record<string, any> = {};
  private readonly isPickingPdfState = signal(false);

  get isPickingPdf(): boolean {
    return this.isPickingPdfState();
  }

  set isPickingPdf(value: boolean) {
    this.isPickingPdfState.set(value);
  }

  // Image state
  originalImageFile?: File;
  selectedImageFile?: File;
  selectedImageName?: string;
  originalImageDims?: { width: number; height: number };
  workingImageDims?: { width: number; height: number };

  previewUrl?: string;
  previewRevision = 0;
  previewThumbUrl?: string;
  originalPdfPreviewUrl: string | null = null;
  cropState?: CoverCropState;
  selectedFormatId = ChangePage.FORMAT_ID_AUTO;
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

  private readonly isPickingImageState = signal(false);
  private readonly isExportingState = signal(false);
  private readonly isRebuildingExportQualityState = signal(false);
  private readonly isResettingFlowState = signal(false);
  readonly operationCompleted = signal(false);

  get isPickingImage(): boolean {
    return this.isPickingImageState();
  }

  set isPickingImage(value: boolean) {
    this.isPickingImageState.set(value);
  }

  get isExporting(): boolean {
    return this.isExportingState();
  }

  set isExporting(value: boolean) {
    this.isExportingState.set(value);
  }

  get isRebuildingExportQuality(): boolean {
    return this.isRebuildingExportQualityState();
  }

  set isRebuildingExportQuality(value: boolean) {
    this.isRebuildingExportQualityState.set(value);
  }

  get isResettingFlow(): boolean {
    return this.isResettingFlowState();
  }

  set isResettingFlow(value: boolean) {
    this.isResettingFlowState.set(value);
  }
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
  private readonly projectSaveState = new ProjectSaveState();
  private readonly rewriteProgressPercentState = signal(0);

  get rewriteProgressPercent(): number {
    return this.rewriteProgressPercentState();
  }

  set rewriteProgressPercent(value: number) {
    this.rewriteProgressPercentState.set(value);
  }
  private readonly isNativeRewriteInProgressState = signal(false);

  get isNativeRewriteInProgress(): boolean {
    return this.isNativeRewriteInProgressState();
  }

  set isNativeRewriteInProgress(value: boolean) {
    this.isNativeRewriteInProgressState.set(value);
  }
  isCancellingNativeRewrite = false;
  private readonly pdfLoadProgressPercentState = signal(0);

  get pdfLoadProgressPercent(): number {
    return this.pdfLoadProgressPercentState();
  }

  set pdfLoadProgressPercent(value: number) {
    this.pdfLoadProgressPercentState.set(value);
  }
  pdfLoadStage: 'copy' | 'inspect' | null = null;

  infoOpen = false;
  infoEvent: Event | null = null;
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
  private exportQualityRevision = 0;
  private currentPreviewOrigin: 'source-pdf' | 'replacement' | 'edited' | null =
    null;
  private readonly invalidCoverWarnKey = 'CHANGE.IMAGE_WARN_INVALID_PDF_COVER';

  get previewUrlWithNonce(): string | null {
    return this.previewUrl ?? null;
  }

  get previewModalImageSrc(): string | null {
    return this.previewCandidateOverride?.src ?? this.previewUrlWithNonce;
  }

  get previewModalImageWidth(): number | null {
    if (this.previewCandidateOverride)
      return this.previewCandidateOverride.width;
    return this.targetWidth ?? null;
  }

  get previewModalImageHeight(): number | null {
    if (this.previewCandidateOverride)
      return this.previewCandidateOverride.height;
    return this.targetHeight ?? null;
  }

  get currentCoverWarningSourceDims(): { width: number; height: number } | null {
    return this.originalImageDims ?? null;
  }

  get currentCoverWarningTarget(): { width: number; height: number } | null {
    return this.normalizeDims({
      width: this.targetWidth,
      height: this.targetHeight,
    });
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
    const hasCandidateState =
      this.bestCandidateRequested || this.bestCandidates.length > 0;
    return (
      (this.workflowStep === 2 && hasCandidateState) ||
      (!this.previewUrl && this.showInvalidCoverFallback)
    );
  }

  get workflowPreviousLabel(): string {
    return this.translate.instant('CHANGE.WORKFLOW_PREVIOUS');
  }

  get workflowNextLabel(): string {
    return this.translate.instant('CHANGE.WORKFLOW_CONTINUE');
  }

  canContinueWorkflow(): boolean {
    switch (this.workflowStep) {
      case 0:
        return this.hasValidPdf();
      case 1:
        return !!this.coverPageMode;
      case 2:
        return this.canCrop();
      case 3:
        return this.canExport();
      default:
        return false;
    }
  }

  async onWorkflowPrevious(): Promise<void> {
    if (this.workflowStep <= 0 || this.isExporting) return;
    this.operationCompleted.set(false);
    this.workflowStep -= 1;
  }

  async onWorkflowNext(): Promise<void> {
    if (!this.canContinueWorkflow()) return;
    if (this.workflowStep === 3) {
      await this.startCrop();
      return;
    }
    this.workflowStep += 1;
  }

  async onWorkflowStepSelected(step: number): Promise<void> {
    if (step < 0 || step > 4 || step === this.workflowStep) return;
    this.operationCompleted.set(false);
    if (step === 0 && this.hasValidPdf()) this.workflowStep = step;
    if (step === 1 && this.hasValidPdf()) this.workflowStep = step;
    if (step === 2 && this.hasValidPdf()) this.workflowStep = step;
    if (step === 3 && this.canCrop()) {
      this.workflowStep = step;
      await this.startCrop();
    }
    if (step === 4 && this.canExport()) this.workflowStep = step;
  }

  hasCurrentPdfCover(): boolean {
    return !!this.originalPdfPreviewUrl && this.canCrop();
  }

  async onCurrentCoverSelected(): Promise<void> {
    if (!this.hasCurrentPdfCover()) return;
    this.editorOpenedFromCurrentCover = true;
    await this.openEditor('image');
  }

  getSuggestedStepId():
    | 'pdf-picker'
    | 'cover-source-image'
    | 'create-button'
    | 'result-actions'
    | null {
    if (!this.hasValidPdf() || this.pdfErrorKey) return 'pdf-picker';
    if (!this.previewUrl || this.imageErrorKey) return 'cover-source-image';
    if (this.canSaveShare()) return 'result-actions';
    if (this.canGenerate()) return 'create-button';
    return null;
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
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe(
      (value: boolean) => {
        this.runInZone(() => {
          const tierChanged = this.adsRemoved !== value;
          this.adsRemoved = value;
          if (this.adsRemoved) {
            this.adFallbackTrialActive = false;
            void this.persistAdFallbackState();
          }
          if (tierChanged) {
            this.exportImageFile = undefined;
            this.invalidateGeneratedOutputState();
            this.syncAuthorizedExportQualityMode('billing-state-change');
          }
          this.syncRemoveAdsPulse();
        });
      },
    );
    this.removeAdsPriceFormatted = this.billing.getRemoveAdsPriceFormatted();
    this.removeAdsPriceSub = this.billing.removeAdsPrice$.subscribe(
      (value: string | null) => {
        this.runInZone(() => {
          this.removeAdsPriceFormatted = value;
        });
      },
    );
    this.syncRemoveAdsPulse();

    const settings = await this.settings.load();
    this.hydrateAdFallbackState(settings.preferences);
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
          const normalizedPercent = Math.max(
            0,
            Math.min(100, Math.round(percent ?? 0)),
          );
          if (this.isNativeRewriteInProgress) {
            if (this.rewriteProgressPercentState() !== normalizedPercent) {
              this.rewriteProgressPercentState.set(normalizedPercent);
            }
            return;
          }
          if (this.isPickingPdf) {
            if (this.pdfLoadProgressPercentState() !== normalizedPercent) {
              this.pdfLoadProgressPercentState.set(normalizedPercent);
            }
          }
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

    void this.consumeEditorResult();

    this.coversEventsSub = this.coversEvents.events$
      .pipe(filter((event) => event.type === 'deleted'))
      .subscribe((event) => {
        if (!event.filename) return;
        if (event.filename !== this.lastSavedFilename) return;
        this.lastSavedFilename = undefined;
        this.wasAutoSaved = false;
      });

    this.registerRecovery();
    await this.recovery.restore();
  }

  ngOnDestroy() {
    this.lifecycle.log('Ionic.ChangePage.ngOnDestroy', {
      workflowStep: this.workflowStep,
    });
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

  private runInZone<T>(fn: () => T): T {
    return NgZone.isInAngularZone() ? fn() : this.zone.run(fn);
  }

  private async flushUi(): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }
    this.runInZone(() => {
      this.changeDetector.markForCheck();
      this.changeDetector.detectChanges();
    });
  }

  private async clearBusyUi(): Promise<void> {
    this.setBusy('none');
  }

  private getCurrentFormatOptions(): CropFormatOption[] {
    const dims = this.resolveDocumentDims() ?? this.baseTarget;

    const options: CropFormatOption[] = [
      {
        id: ChangePage.FORMAT_ID_AUTO,
        label: this.translate.instant('CHANGE.FORMAT_AUTO'),
        target: this.buildAbsoluteTarget(dims),
      },
      {
        id: ChangePage.FORMAT_ID_A3,
        label: this.cropTargetLabel('PAPER.PRESETS.A3'),
        target: this.buildPhysicalTarget('a3', 297, 420, 'mm'),
      },
      {
        id: ChangePage.FORMAT_ID_A4,
        label: this.translate.instant('CHANGE.FORMAT_A4'),
        target: this.buildPhysicalTarget('a4', 210, 297, 'mm'),
      },
      {
        id: ChangePage.FORMAT_ID_A5,
        label: this.cropTargetLabel('PAPER.PRESETS.A5'),
        target: this.buildPhysicalTarget('a5', 148, 210, 'mm'),
      },
      {
        id: ChangePage.FORMAT_ID_A6,
        label: this.cropTargetLabel('PAPER.PRESETS.A6'),
        target: this.buildPhysicalTarget('a6', 105, 148, 'mm'),
      },
      {
        id: ChangePage.FORMAT_ID_LETTER,
        label: this.translate.instant('CHANGE.FORMAT_CARTA'),
        target: this.buildPhysicalTarget('letter', 8.5, 11, 'in'),
      },
      {
        id: ChangePage.FORMAT_ID_LEGAL,
        label: this.translate.instant('CHANGE.FORMAT_OFICIO'),
        target: this.buildPhysicalTarget('legal', 8.5, 14, 'in'),
      },
      {
        id: ChangePage.FORMAT_ID_TABLOID,
        label: this.cropTargetLabel('PAPER.PRESETS.TABLOID'),
        target: this.buildPhysicalTarget('tabloid', 11, 17, 'in'),
      },
      {
        id: ChangePage.FORMAT_ID_NINE_SIXTEEN,
        label: this.translate.instant('CHANGE.FORMAT_NINE_SIXTEEN'),
        target: this.buildAspectTarget('nine_sixteen', 9, 16, 'ratio'),
      },
      {
        id: 'sixteen_nine',
        label: this.cropTargetLabel('RATIO.PRESETS.16_9'),
        target: this.buildAspectTarget('sixteen_nine', 16, 9, 'ratio'),
      },
      {
        id: 'sixteen_ten',
        label: this.cropTargetLabel('RATIO.PRESETS.16_10'),
        target: this.buildAspectTarget('sixteen_ten', 16, 10, 'ratio'),
      },
      {
        id: ChangePage.FORMAT_ID_THREE_FOUR,
        label: this.translate.instant('CHANGE.FORMAT_THREE_FOUR'),
        target: this.buildAspectTarget('three_four', 3, 4, 'ratio'),
      },
      {
        id: ChangePage.FORMAT_ID_ONE_ONE,
        label: this.translate.instant('CHANGE.FORMAT_ONE_ONE'),
        target: this.buildAspectTarget('one_one', 1, 1, 'ratio'),
      },
      {
        id: 'four_five',
        label: this.cropTargetLabel('RATIO.PRESETS.4_5'),
        target: this.buildAspectTarget('four_five', 4, 5, 'ratio'),
      },
      {
        id: 'five_seven',
        label: this.cropTargetLabel('RATIO.PRESETS.5_7'),
        target: this.buildAspectTarget('five_seven', 5, 7, 'ratio'),
      },
      {
        id: 'two_three',
        label: this.cropTargetLabel('RATIO.PRESETS.2_3'),
        target: this.buildAspectTarget('two_three', 2, 3, 'ratio'),
      },
      {
        id: 'five_eight',
        label: this.cropTargetLabel('RATIO.PRESETS.5_8'),
        target: this.buildAspectTarget('five_eight', 5, 8, 'ratio'),
      },
      {
        id: 'custom_ratio',
        label: this.cropTargetLabel('RATIO.PRESETS.CUSTOM'),
        target: this.buildAspectTarget('custom_ratio', 1, 1, 'ratio'),
      },
      {
        id: ChangePage.FORMAT_ID_CUSTOM,
        label: this.buildCustomFormatLabel(),
        target: this.buildAbsoluteTarget(dims),
      },
    ];

    if (!this.editorTargetOverride) return options;
    return options.map((option) =>
      option.id === this.editorTargetOverride?.formatId
        ? { ...option, target: { ...this.editorTargetOverride } }
        : option,
    );
  }

  private buildAbsoluteTarget(dims: { width: number; height: number }): CropTarget {
    const normalized = this.normalizeDims(dims) ?? this.baseTarget;
    return {
      formatId: 'fixed-document',
      width: normalized.width,
      height: normalized.height,
      output: 'target',
      unit: 'px',
      outputMode: 'fixed-size',
    };
  }

  private buildAspectTarget(
    formatId: string,
    width: number,
    height: number,
    unit: 'mm' | 'in' | 'ratio',
  ): CropTarget {
    return {
      formatId,
      width,
      height,
      output: 'source',
      unit,
      outputMode: 'aspect-only',
    };
  }

  private buildPhysicalTarget(
    formatId: string,
    width: number,
    height: number,
    unit: 'mm' | 'in' | 'pt',
  ): CropTarget {
    return {
      formatId,
      width,
      height,
      output: 'source',
      unit,
      outputMode: 'physical-size',
    };
  }

  private buildCropTargetsConfig(): CropTargetsConfig {
    const activeCategory = this.resolveCropTargetCategory(this.selectedFormatId);
    const prefix = ChangePage.CROP_TARGET_I18N_PREFIX;

    return {
      activeCategory,
      pdfOriginal: this.hasValidPdf()
        ? this.buildPdfOriginalConfig(prefix)
        : undefined,
      paper: {
        catalog: [
          {
            parentId: 'iso-216',
            parentI18nKey: `${prefix}.CATALOG.PAPER.GROUPS.ISO_216`,
            id: 'a-series',
            i18nKey: `${prefix}.CATALOG.PAPER.GROUPS.A_SERIES`,
            items: [
              this.paperPreset('a3', `${prefix}.CATALOG.PAPER.PRESETS.A3`, 297, 420, 'mm'),
              this.paperPreset('a4', `${prefix}.CATALOG.PAPER.PRESETS.A4`, 210, 297, 'mm'),
              this.paperPreset('a5', `${prefix}.CATALOG.PAPER.PRESETS.A5`, 148, 210, 'mm'),
              this.paperPreset('a6', `${prefix}.CATALOG.PAPER.PRESETS.A6`, 105, 148, 'mm'),
            ],
          },
          {
            parentId: 'north-american',
            parentI18nKey: `${prefix}.CATALOG.PAPER.GROUPS.NORTH_AMERICAN`,
            id: 'office',
            i18nKey: `${prefix}.CATALOG.PAPER.GROUPS.NORTH_AMERICAN_OFFICE`,
            items: [
              this.paperPreset('letter', `${prefix}.CATALOG.PAPER.PRESETS.LETTER`, 8.5, 11, 'in'),
              this.paperPreset('legal', `${prefix}.CATALOG.PAPER.PRESETS.LEGAL`, 8.5, 14, 'in'),
              this.paperPreset('tabloid', `${prefix}.CATALOG.PAPER.PRESETS.TABLOID`, 11, 17, 'in'),
            ],
          },
        ],
        selectedParentId: 'iso-216',
        selectedGroupId: 'a-series',
        supportsOrientation: true,
        defaultOrientation: 'portrait',
      },
      books: this.buildBooksConfig(prefix),
      presentation: this.buildPresentationConfig(prefix),
      ratio: {
        catalog: [
          {
            parentId: 'common',
            parentI18nKey: `${prefix}.CATALOG.RATIO.GROUPS.COMMON`,
            id: 'common-ratios',
            i18nKey: `${prefix}.CATALOG.RATIO.GROUPS.COMMON`,
            items: [
              this.ratioPreset('one_one', `${prefix}.CATALOG.RATIO.PRESETS.1_1`, 1, 1),
              this.ratioPreset('four_five', `${prefix}.CATALOG.RATIO.PRESETS.4_5`, 4, 5),
              this.ratioPreset('three_four', `${prefix}.CATALOG.RATIO.PRESETS.3_4`, 3, 4),
              this.ratioPreset('five_seven', `${prefix}.CATALOG.RATIO.PRESETS.5_7`, 5, 7),
              this.ratioPreset('two_three', `${prefix}.CATALOG.RATIO.PRESETS.2_3`, 2, 3),
              this.ratioPreset('five_eight', `${prefix}.CATALOG.RATIO.PRESETS.5_8`, 5, 8),
              this.ratioPreset('nine_sixteen', `${prefix}.CATALOG.RATIO.PRESETS.9_16`, 9, 16),
              this.ratioPreset('sixteen_nine', `${prefix}.CATALOG.RATIO.PRESETS.16_9`, 16, 9),
              this.ratioPreset('sixteen_ten', `${prefix}.CATALOG.RATIO.PRESETS.16_10`, 16, 10),
              this.ratioPreset('custom_ratio', `${prefix}.CATALOG.RATIO.PRESETS.CUSTOM`, 1, 1),
            ],
          },
        ],
        selectedParentId: 'common',
        selectedGroupId: 'common-ratios',
        supportsOrientation: true,
        defaultOrientation: 'portrait',
      },
    };
  }

  private paperPreset(
    id: string,
    i18nKey: string,
    width: number,
    height: number,
    unit: 'mm' | 'in',
  ): CropTargetPreset {
    return { id, i18nKey, width, height, unit, outputMode: 'physical-size' };
  }

  private buildPdfOriginalConfig(prefix: string): CropTargetCategoryConfig {
    const pageTargets = this.pdfPageTargets.length
      ? this.pdfPageTargets.map((target) => ({
          id: `pdf-page-${target.pageNumber}`,
          i18nKey: `${prefix}.PDF_ORIGINAL.PAGE`,
          width: target.width,
          height: target.height,
          unit: 'pt' as const,
          outputMode: 'physical-size' as const,
          sourcePageNumber: target.pageNumber,
          sourcePageBox: target.sourcePageBox,
        }))
      : [
          {
            id: 'pdf-page-1',
            i18nKey: `${prefix}.PDF_ORIGINAL.PAGE`,
            width: 595.2756,
            height: 841.8898,
            unit: 'pt' as const,
            outputMode: 'physical-size' as const,
            sourcePageNumber: 1,
            sourcePageBox: 'media-box' as const,
          },
        ];
    const first = pageTargets[0];
    const predominant = this.findPredominantPdfTarget(pageTargets);
    const makePreset = (
      id: string,
      key: string,
      target: (typeof pageTargets)[number],
    ): CropTargetPreset => ({
      ...target,
      id,
      i18nKey: key,
    });

    return {
      catalog: [
        {
          parentId: 'pdf-original',
          id: 'pdf-reference',
          i18nKey: `${prefix}.PDF_ORIGINAL.REFERENCE`,
          items: [
            makePreset('pdf-first-page', `${prefix}.PDF_ORIGINAL.FIRST_PAGE`, first),
            makePreset('pdf-predominant-size', `${prefix}.PDF_ORIGINAL.PREDOMINANT_SIZE`, predominant),
            makePreset('pdf-specific-page', `${prefix}.PDF_ORIGINAL.SPECIFIC_PAGE`, first),
          ],
        },
      ],
      selectedParentId: 'pdf-original',
      selectedGroupId: 'pdf-reference',
      selectedPreset: makePreset(
        'pdf-first-page',
        `${prefix}.PDF_ORIGINAL.FIRST_PAGE`,
        first,
      ),
      sourcePageTargets: pageTargets,
    };
  }

  private findPredominantPdfTarget<T extends CropTargetPreset>(
    targets: T[],
  ): T {
    const groups: Array<{ target: CropTargetPreset; count: number }> = [];
    for (const target of targets) {
      const group = groups.find(
        (entry) =>
          Math.abs(entry.target.width - target.width) <= 1 &&
          Math.abs(entry.target.height - target.height) <= 1,
      );
      if (group) {
        group.count += 1;
      } else {
        groups.push({ target, count: 1 });
      }
    }
    return (groups.sort((a, b) => b.count - a.count)[0]?.target ?? targets[0]) as T;
  }

  private buildBooksConfig(prefix: string): CropTargetCategoryConfig {
    const group = (
      id: string,
      key: string,
      items: CropTargetPreset[],
    ) => ({ parentId: 'books', id, i18nKey: key, items });
    const preset = (id: string, key: string, width: number, height: number, unit: 'in' | 'mm', badgeI18nKey?: string) => ({
      id,
      i18nKey: key,
      width,
      height,
      unit,
      outputMode: 'physical-size' as const,
      ...(badgeI18nKey ? { badgeI18nKey } : {}),
    });
    return {
      catalog: [
        group('compact', `${prefix}.BOOK_GROUPS.COMPACT`, [
          preset('book-4-25x6-87', `${prefix}.BOOK_FORMATS.4_25X6_87`, 4.25, 6.87, 'in'),
          preset('book-5x8', `${prefix}.BOOK_FORMATS.5X8`, 5, 8, 'in'),
          preset('book-5-25x8', `${prefix}.BOOK_FORMATS.5_25X8`, 5.25, 8, 'in'),
          preset('book-a5', `${prefix}.BOOK_FORMATS.A5`, 148, 210, 'mm'),
        ]),
        group('trade', `${prefix}.BOOK_GROUPS.TRADE`, [
          preset('book-5-5x8-5', `${prefix}.BOOK_FORMATS.5_5X8_5`, 5.5, 8.5, 'in'),
          preset('book-6x9', `${prefix}.BOOK_FORMATS.6X9`, 6, 9, 'in', 'COMMON.POPULAR'),
          preset('book-6-14x9-21', `${prefix}.BOOK_FORMATS.6_14X9_21`, 6.14, 9.21, 'in'),
          preset('book-7x10', `${prefix}.BOOK_FORMATS.7X10`, 7, 10, 'in'),
        ]),
        group('large', `${prefix}.BOOK_GROUPS.LARGE`, [
          preset('book-8x10', `${prefix}.BOOK_FORMATS.8X10`, 8, 10, 'in'),
          preset('book-8-25x11', `${prefix}.BOOK_FORMATS.8_25X11`, 8.25, 11, 'in'),
          preset('book-8-5x11', `${prefix}.BOOK_FORMATS.8_5X11`, 8.5, 11, 'in'),
          preset('book-a4', `${prefix}.BOOK_FORMATS.A4`, 210, 297, 'mm'),
        ]),
        group('square', `${prefix}.BOOK_GROUPS.SQUARE`, [
          preset('book-8x8', `${prefix}.BOOK_FORMATS.8X8`, 8, 8, 'in'),
          preset('book-8-5x8-5', `${prefix}.BOOK_FORMATS.8_5X8_5`, 8.5, 8.5, 'in'),
          preset('book-10x10', `${prefix}.BOOK_FORMATS.10X10`, 10, 10, 'in'),
        ]),
      ],
      selectedParentId: 'books',
      selectedGroupId: 'trade',
      supportsOrientation: true,
      defaultOrientation: 'portrait',
    };
  }

  private buildPresentationConfig(prefix: string): CropTargetCategoryConfig {
    const preset = (id: string, key: string, width: number, height: number, description: string) => ({
      id,
      i18nKey: key,
      width,
      height,
      unit: 'in' as const,
      outputMode: 'physical-size' as const,
      descriptionI18nKey: description,
    });
    return {
      catalog: [
        {
          parentId: 'presentation',
          id: 'powerpoint',
          i18nKey: `${prefix}.PRESENTATION_GROUPS.POWERPOINT`,
          items: [
            preset('presentation-widescreen', `${prefix}.PRESENTATION_FORMATS.WIDESCREEN`, 13.333, 7.5, `${prefix}.PRESENTATION_RATIOS.16_9`),
            preset('presentation-standard', `${prefix}.PRESENTATION_FORMATS.STANDARD`, 10, 7.5, `${prefix}.PRESENTATION_RATIOS.4_3`),
            preset('presentation-on-screen-16-9', `${prefix}.PRESENTATION_FORMATS.ON_SCREEN_16_9`, 10, 5.625, `${prefix}.PRESENTATION_RATIOS.16_9`),
            preset('presentation-on-screen-16-10', `${prefix}.PRESENTATION_FORMATS.ON_SCREEN_16_10`, 10, 6.25, `${prefix}.PRESENTATION_RATIOS.16_10`),
          ],
        },
      ],
      selectedParentId: 'presentation',
      selectedGroupId: 'powerpoint',
      supportsOrientation: true,
      defaultOrientation: 'landscape',
    };
  }

  private ratioPreset(
    id: string,
    i18nKey: string,
    width: number,
    height: number,
  ): CropTargetPreset {
    return { id, i18nKey, width, height, unit: 'ratio', outputMode: 'aspect-only' };
  }

  private resolveCropTargetCategory(id?: string): CropTargetCategory {
    if (
      ['a3', 'a4', 'a5', 'a6', 'letter', 'legal', 'tabloid'].includes(id ?? '')
    ) {
      return 'paper';
    }
    if (
      ['one_one', 'two_three', 'three_four', 'four_five', 'five_seven', 'five_eight', 'nine_sixteen', 'sixteen_nine', 'sixteen_ten', 'custom_ratio'].includes(id ?? '')
    ) {
      return 'ratio';
    }
    return this.hasValidPdf() ? 'pdf-original' : 'paper';
  }

  private buildCustomFormatLabel(): string {
    return this.translate.instant('CHANGE.FORMAT_CUSTOM');
  }

  private cropTargetLabel(path: string): string {
    return this.translate.instant(
      `${ChangePage.CROP_TARGET_I18N_PREFIX}.CATALOG.${path}`,
    );
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
    this.pdfPageTargets = [];

    try {
      this.pdfPageTargets = await this.candidateImageService.getPageDimensions({
        pdfFile: this.workingPdfFile,
        pdfNativePath: this.workingPdfNativePath,
        pdfName: this.selectedPdfName || this.workingPdfName || 'pdf',
      });
      const firstTarget = this.pdfPageTargets[0];
      if (firstTarget) {
        const normalized = this.normalizeDims(firstTarget);
        if (normalized) {
          this.pdfFirstPageDims = normalized;
          return;
        }
      }
    } catch {
      this.pdfPageTargets = [];
    }

    try {
      const directDims = await this.candidateImageService.getFirstPageDimensions(
        {
          pdfFile: this.workingPdfFile,
          pdfNativePath: this.workingPdfNativePath,
          pdfName: this.selectedPdfName || this.workingPdfName || 'pdf',
        },
      );
      const normalizedDirectDims = this.normalizeDims(directDims);
      if (normalizedDirectDims) {
        this.pdfFirstPageDims = normalizedDirectDims;
        this.pdfPageTargets = [
          {
            pageNumber: 1,
            width: normalizedDirectDims.width,
            height: normalizedDirectDims.height,
            sourcePageBox: 'media-box',
          },
        ];
        return;
      }
    } catch {
      // Best effort: fall back to render-based extraction below.
    }

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
    if (this.canUseNativePdfPicker()) {
      void this.pickNativePdf();
      return;
    }
    this.pdfInput.nativeElement.click();
  }

  private canUseNativePdfPicker(): boolean {
    return (
      Capacitor.getPlatform() === 'android' && this.pdfRewrite.isSupported()
    );
  }

  async onPdfSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await this.runInZone(async () => {
      this.resetPdfLoadProgress();
      this.setBusy('pdf', 'CHANGE.LOADING_PDF');

      try {
        await this.resetWorkflowForNewPdf();

        const validation = this.fileService.validatePdf(
          file,
          this.maxPdfSizeMB,
        );
        if (!validation.valid) {
          this.failPdf(
            this.mapValidationErrorToUiKey(validation.errorKey),
            file,
          );
          return;
        }

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

        const strictCover =
          await this.candidateImageService.resolveStrictCover({
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
        await this.clearBusyUi();
        input.value = '';
      }
    });
  }

  private async pickNativePdf() {
    await this.runInZone(async () => {
      this.resetPdfLoadProgress();
      this.setBusy('pdf', 'CHANGE.LOADING_PDF');
      this.pdfLoadStage = 'copy';
      this.pdfLoadProgressPercent = 0;

      try {
        const prepared = await this.pdfRewrite.pickAndPreparePdf({
          maxBytes: this.maxPdfSizeMB * 1024 * 1024,
        });
        await this.applyPreparedNativePdf(prepared);
      } catch (error) {
        if (error instanceof PdfRewriteError && error.code === 'PICK_CANCELLED') {
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
        await this.clearBusyUi();
      }
    });
  }

  private async applyPreparedNativePdf(
    prepared: Awaited<ReturnType<PdfRewriteService['pickAndPreparePdf']>>,
  ): Promise<void> {
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
      !!(this.workingPdfFile || this.workingPdfNativePath) && !this.pdfErrorKey
    );
  }

  private resetPdfLoadProgress() {
    this.pdfLoadProgressPercent = 0;
    this.pdfLoadStage = null;
  }

  private resetWorkflow() {
    this.operationCompleted.set(false);
    this.workflowStep = 0;
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

  private async resetWorkflowForNewPdf(waitForCleanup = true) {
    const cleanupPromise = this.cleanupWorkingCopy();
    this.resetWorkflow();
    this.lastEditorSessionId = undefined;
    this.editorSession.clearSessions();
    this.projectSaveState.clear();
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
    if (waitForCleanup) {
      await cleanupPromise;
      return;
    }

    void cleanupPromise.catch(() => undefined);
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
        this.editorOpenedFromCurrentCover = false;
        await this.homeTour.completeInteraction('cover-image-selected');
        await this.openEditor('image');
      }
    } finally {
      this.setBusy('none');
      await this.flushUi();
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
      const discovered =
        await this.candidateImageService.discoverInternalImages({
          pdfFile: this.workingPdfFile,
          pdfNativePath: this.workingPdfNativePath,
          pdfName: this.selectedPdfName,
          maxImages: 8,
        });
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

      const ranked =
        this.bestCandidateService.rankCandidatesWithDiagnostics(images);
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
      this.selectedBestCandidateId = ranked.results[0]?.image.id;
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

    const loaded = await this.applyImageSource(file, true);
    if (!loaded) return;

    if (candidate.sourcePath) {
      this.coverEntryPath = candidate.sourcePath;
    }
    console.info(
      '[ECC_BEST_CANDIDATE] selected candidate:',
      candidate.sourcePath || candidate.fileName || candidate.id,
    );
    await this.homeTour.completeInteraction('cover-image-selected');
    await this.openEditor('image');
  }

  onBestCandidatePreviewRequested(candidate: BestCandidateImage): void {
    if (this.bestCandidateLoading) return;
    const src = candidate.src?.trim();
    if (!src) return;
    this.previewEditingPage.open({
      imageSrc: src,
      imageWidth: candidate.width,
      imageHeight: candidate.height,
      titleKey: 'BEST_CANDIDATE.PREVIEW.TITLE',
      returnUrl: '/tabs/change',
    });
    void this.router.navigateByUrl('/tabs/preview-editing');
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

    this.workflowStep = 1;

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
      this.selectedFormatId = this.resolveFormatId(this.selectedFormatId);
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
      frameLikeByUniformBand && innerOuterContrast > 58 * orientationAwareBoost;

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
    renderInfo?: EditorRenderInfo,
  ): Promise<void> {
    void reason;
    void legacyDimsHint;
    this.clearImageWarn();
    if (renderInfo?.warningCode !== 'FIXED_TARGET_UPSCALE') return;
    this.imageWarnKey = 'EDITOR_RESOLUTION.UPSCALE_MESSAGE';
    this.imageWarnParams = {
      width: renderInfo.requestedWidth ?? renderInfo.renderedWidth,
      height: renderInfo.requestedHeight ?? renderInfo.renderedHeight,
      effectiveSourceWidth: renderInfo.effectiveSourceWidth ?? 0,
      effectiveSourceHeight: renderInfo.effectiveSourceHeight ?? 0,
      upscaleFactor: renderInfo.upscaleFactor,
    };
    this.homeTour.requestSync();
  }

  canCrop(): boolean {
    return (
      this.hasValidPdf() &&
      !!(this.editorSourceFile ?? this.workingImageFile) &&
      !this.imageErrorKey
    );
  }
  canStartScratch(): boolean {
    return this.hasValidPdf() && !this.isPickingImage && !this.isExporting;
  }

  async onStartScratch(): Promise<void> {
    if (!this.canStartScratch()) return;
    const frameDetected = this.isFrameDetected;
    const frameDetecting = this.isDetectingFrame;
    this.isFrameDetected = frameDetected;
    this.isDetectingFrame = frameDetecting;
    this.clearImageError();
    this.clearImageWarn();
    this.editorOpenedFromCurrentCover = false;
    await this.homeTour.completeInteraction('cover-image-selected');
    await this.openEditor('scratch');
  }

  async startCrop() {
    if (!this.canCrop()) return;
    await this.openEditor(
      this.lastEditorSourceMode === 'scratch' ? 'scratch' : 'image',
    );
  }

  private async openEditor(sourceMode: EditorSourceMode): Promise<void> {
    const selected = this.getSelectedFormatOption();
    if (!selected) return;
    const sourceFile =
      sourceMode === 'image'
        ? (this.editorSourceFile ?? this.workingImageFile)
        : undefined;
    if (sourceMode === 'image' && !sourceFile) return;

    const editorFormats = this.getCurrentFormatOptions();
    const initialState =
      sourceMode === 'scratch' ? this.buildDefaultCropState() : this.cropState;

    const sid = this.editorSession.createSession({
      file: sourceFile,
      sourceMode,
      target: {
        formatId: selected.id,
        width: selected.target.width,
        height: selected.target.height,
        output: selected.target.output,
        unit:
          selected.target.unit ??
          (selected.target.output === 'source' ? 'ratio' : 'px'),
        outputMode:
          selected.target.outputMode ??
          (selected.target.output === 'source' ? 'aspect-only' : 'fixed-size'),
      },
      initialState,
      tools: {
        formatNavigation: 'categories',
        formats: {
          options: editorFormats,
          selectedId: selected.id,
        },
        cropTargets: this.buildCropTargetsConfig(),
        eReaderOptimization: {
          enabled: this.editorEReaderOptimizationFeatureEnabled,
        },
      },
      output: {
        includeRenderedBlob: true,
        exportQuality: toEditorRenderQuality(this.getEffectiveExportQualityMode()),
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
      onResultApplied: async (result) => {
        await this.applyCropResult(result);
        const appliedSessionId = this.lastEditorSessionId;
        if (appliedSessionId) this.editorSession.consumeResult(appliedSessionId);
        this.lastEditorSessionId = undefined;
      },
    });

    this.lastEditorSourceMode = sourceMode;
    this.lastEditorSessionId = sid;
    this.workflowStep = 3;
    await this.homeTour.completeInteraction('editor-apply');

    const entryPath = sourceMode === 'scratch' ? '/editor/tools' : '/editor';
    this.router.navigate([entryPath], {
      queryParams: {
        sid,
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
    if (this.projectEditReturnUrl) return this.projectEditReturnUrl;
    const current = this.router.url;
    if (current.startsWith('/tabs/')) return current;
    return '/tabs/change';
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
    const sessionTarget = this.lastEditorSessionId
      ? this.editorSession.getSession(this.lastEditorSessionId)?.target
      : undefined;
    if (result.formatId && sessionTarget?.formatId === result.formatId) {
      this.editorTargetOverride = { ...sessionTarget };
    }
    this.editorOpenedFromCurrentCover = false;
    this.workflowStep = 4;
    const renderedBlob = result.renderedBlob;
    this.lastEditorRenderInfo = result.renderInfo;
    this.isApplyingFromEditor = true;
    this.previewGenerationToken += 1;
    this.currentPreviewOrigin = 'edited';

    const editorSource =
      this.editorSourceFile ?? this.workingImageFile ?? newFile;
    if (!this.editorSourceFile) {
      this.editorSourceFile = editorSource;
    }

    if (result.formatId) {
      this.selectedFormatId = this.resolveFormatId(result.formatId);
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
    const dims = await this.imagePipe.getDimensions(newFile);
    if (!dims) return this.failImage('CORRUPT', newFile);
    this.workingImageDims = dims;

    try {
      if (!renderedBlob) {
        console.warn('[PCM] editor result missing renderedBlob; skipping preview fallback');
        this.isApplyingFromEditor = false;
        return;
      }

      const renderedInfo = this.normalizeRenderedInfo(result) ?? undefined;
      const renderedFile = this.buildRenderedFile(
        renderedBlob,
        renderedInfo?.mimeType,
      );
      this.renderedImageFile = renderedFile;
      this.renderedImageBlob = result.editorMasterBlob;
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
        result.renderInfo,
      );
      this.isApplyingFromEditor = false;
      return;
    } finally {
      this.isApplyingFromEditor = false;
      await this.homeTour.completeInteraction('editor-apply');
    }
  }

  private buildCompositionInput(purpose: 'preview' | 'export' = 'preview') {
    const isScratchComposition = this.lastEditorSourceMode === 'scratch';
    const workingFile = isScratchComposition
      ? this.workingImageFile
      : this.editorSourceFile ?? this.workingImageFile;
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
      exportSource: 'working',
      sources: {
        working: {
          file: workingFile,
          naturalWidth: this.workingImageDims.width,
          naturalHeight: this.workingImageDims.height,
        },
        original:
          !isScratchComposition && this.originalImageFile && this.originalImageDims
            ? {
                file: this.originalImageFile,
                naturalWidth: this.originalImageDims.width,
                naturalHeight: this.originalImageDims.height,
              }
            : undefined,
      },
      target: {
        formatId: selected.id,
        width: rawTarget.width,
        height: rawTarget.height,
        output:
          (rawTarget.outputMode ??
            (rawTarget.output === 'source' ? 'aspect-only' : 'fixed-size')) ===
          'aspect-only'
            ? 'source'
            : 'target',
        unit:
          rawTarget.unit ??
          (rawTarget.output === 'source' ? 'ratio' : 'px'),
        outputMode:
          rawTarget.outputMode ??
          (rawTarget.output === 'source' ? 'aspect-only' : 'fixed-size'),
      },
      state: layoutState,
      frameFallback: { width: rawTarget.width, height: rawTarget.height },
    });
  }

  private async updatePreviewFromComposition(): Promise<void> {
    if (this.isApplyingFromEditor) return;
    const token = ++this.previewGenerationToken;
    const master = this.renderedImageBlob;
    if (master) {
      const qualityFile = await this.ensureExportImageFile();
      if (!qualityFile || token !== this.previewGenerationToken) return;
      const url = URL.createObjectURL(qualityFile);
      this.setPreviewUrl(url);
      const thumb = await this.buildThumbFromBlob(qualityFile, ChangePage.THUMB_SIZE);
      if (token !== this.previewGenerationToken) return;
      this.setPreviewThumbUrl(thumb ?? url);
      return;
    }

    const input = this.buildCompositionInput('preview');
    if (!input) return;

    const baseCanvas = await renderCompositionToCanvas(input, {
      mode: 'preview',
      outputScale: 1,
      includePreviewCheckerboard: false,
      debugLabel: 'ECC_PREVIEW',
    });
    if (!baseCanvas) return;

    const isDithered = this.isPreviewDithered();
    const isPngQuality =
      this.getSelectedCoverExportOptions()?.mimeType === 'image/png';
    const modalCanvas = isDithered
      ? baseCanvas
      : this.downscaleCanvas(baseCanvas, ChangePage.PREVIEW_MAX_SIDE, false);

    const blob: Blob | null = await new Promise((resolve) =>
      modalCanvas.toBlob(
        (bb) => resolve(bb),
        isDithered || isPngQuality ? 'image/png' : 'image/jpeg',
        isDithered || isPngQuality ? undefined : 0.9,
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
    const revision = this.exportQualityRevision;

    const master = this.renderedImageBlob;
    if (master) {
      const quality = toEditorRenderQuality(this.exportQualityMode);
      const file = await encodeRenderedBlob(
        master,
        this.selectedImageName ?? this.workingImageFile?.name ?? 'cover.png',
        quality,
        quality === 'high-quality' ? undefined : '#ffffff',
      );
      if (!file || revision !== this.exportQualityRevision) return null;
      this.exportImageFile = file;
      return file;
    }

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
    if (revision !== this.exportQualityRevision) return null;

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
    return getCoverExportOptions(this.exportQualityMode);
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

    const nameWithoutExt = this.projectSaveState.getSuggestedBaseName(
      '.pdf',
      this.lastSavedFilename,
      this.generatedPdfFilename,
      'pdf_cover',
    );

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
      const isRename = !!this.lastSavedFilename;

      const isProjectEditSave =
        this.projectSaveState.isCurrentFilename(requestedFilename);

      if (isProjectEditSave) {
        const exportFile = await this.ensureExportImageFile();
        if (!exportFile) return;

        const saved = this.usesNativeRewrite()
          ? this.generatedPdfPath
            ? await this.fileService.saveGeneratedPdfFromPath({
                sourcePath: this.generatedPdfPath,
                sourceDir: 'Data',
                filename: this.projectSaveState.getCurrentFilename()!,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
                overwriteExisting: true,
              })
            : await this.fileService.saveGeneratedPdfFromExistingDocument({
                sourceFilename: this.projectSaveState.getCurrentFilename()!,
                filename: this.projectSaveState.getCurrentFilename()!,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
                overwriteExisting: true,
              })
              : await this.fileService.saveGeneratedPdf({
              bytes: this.generatedPdfBytes!,
              filename: this.projectSaveState.getCurrentFilename()!,
              coverFileForThumb: exportFile,
              coverMetadata: this.buildCoverProcessingMetadata(),
              overwriteExisting: true,
            });

        this.logSaveFlow('finalWriteComplete', {
          flow: 'performSave:edit-overwrite',
          filename: saved.filename,
          writeCompletedAt: new Date().toISOString(),
        });

        this.generatedPdfFilename = saved.filename;
        this.lastSavedFilename = saved.filename;
        this.projectSaveState.setCurrentFilename(saved.filename);
        this.wasAutoSaved = false;

        try {
          await this.saveLocalProjectSnapshot(saved.filename, exportFile);
        } catch (error) {
          console.warn('[PCM:change] project snapshot save failed', error);
        }

        this.coversEvents.emit({
          type: 'saved',
          filename: saved.filename,
        });
        this.logSaveFlow('savedEventEmitted', {
          flow: 'performSave:edit-overwrite',
          filename: saved.filename,
          emittedAt: new Date().toISOString(),
        });

        await this.consumeAdFallbackAttemptAfterSuccess('save');
        await this.showToast('CHANGE.SAVED_OK', { duration: 1600 }, 'success');
        return;
      }

      if (
        this.lastSavedFilename &&
        requestedFilename.toLowerCase() === this.lastSavedFilename.toLowerCase()
      ) {
        const alreadySaved =
          await this.fileService.hasCoverByFilename(requestedFilename);
        if (alreadySaved) {
          const exportFile = await this.ensureExportImageFile();
          if (!exportFile) return;

          this.generatedPdfFilename = requestedFilename;
          this.lastSavedFilename = requestedFilename;
          this.projectSaveState.setCurrentFilename(requestedFilename);
          this.wasAutoSaved = true;

          try {
            await this.saveLocalProjectSnapshot(requestedFilename, exportFile);
          } catch (error) {
            console.warn('[PCM:change] project snapshot save failed', error);
          }

          this.coversEvents.emit({
            type: 'saved',
            filename: requestedFilename,
          });
          this.logSaveFlow('savedEventEmitted', {
            flow: 'performSave:auto-save',
            filename: requestedFilename,
            emittedAt: new Date().toISOString(),
          });

          await this.consumeAdFallbackAttemptAfterSuccess('save');
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
          this.projectSaveState.setCurrentFilename(renamed.filename);
          this.wasAutoSaved = false;
          try {
            await this.saveLocalProjectSnapshot(renamed.filename, exportFile);
          } catch (error) {
            console.warn('[PCM:change] project snapshot save failed', error);
          }
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
          this.projectSaveState.setCurrentFilename(saved.filename);
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
        this.projectSaveState.setCurrentFilename(saved.filename);
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

      await this.consumeAdFallbackAttemptAfterSuccess('save');
      await this.showToast(
        isRename ? 'CHANGE.RENAMED_OK' : 'CHANGE.SAVED_OK',
        { duration: 1600 },
        'success',
      );
    } finally {
      await this.clearBusyUi();
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
    this.renderedImageBlob = undefined;
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
      this.previewRevision += 1;
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
      return thumb.toDataURL(
        this.getSelectedCoverExportOptions()?.mimeType === 'image/png'
          ? 'image/png'
          : 'image/jpeg',
        0.82,
      );
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
        let timer: ReturnType<typeof setTimeout> | null = null;
        const bitmap = await Promise.race([
          createImageBitmap(blob),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), 8000);
          }),
        ]);
        if (timer) {
          clearTimeout(timer);
        }
        if (!bitmap) {
          throw new Error('IMAGE_BITMAP_TIMEOUT');
        }
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
      let settled = false;
      const img = new Image();
      const cleanup = () => URL.revokeObjectURL(url);
      const timer = setTimeout(() => finish(null), 8000);
      const finish = (result: {
        width: number;
        height: number;
        draw: (
          ctx: CanvasRenderingContext2D,
          dx: number,
          dy: number,
          dw: number,
          dh: number,
        ) => void;
      } | null) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        cleanup();
        resolve(result);
      };

      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        finish({
          width,
          height,
          draw: (ctx, dx, dy, dw, dh) =>
            ctx.drawImage(img, 0, 0, width, height, dx, dy, dw, dh),
        });
      };

      img.onerror = () => {
        finish(null);
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
    this.homeTour.requestSync();
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

    if (!this.pdfFirstPageDims) {
      try {
        const directDims =
          await this.candidateImageService.getFirstPageDimensions({
            pdfFile: this.workingPdfFile,
            pdfNativePath: this.workingPdfNativePath,
            pdfName: this.selectedPdfName || this.workingPdfName || 'pdf',
          });
        const normalizedDirectDims = this.normalizeDims(directDims);
        if (normalizedDirectDims) {
          this.pdfFirstPageDims = normalizedDirectDims;
        }
      } catch {
        // Keep going with the rendered first-page fallback below.
      }
    }

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
          const extracted =
            await this.fileService.extractCoverFromPdfFile(file);
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

  private candidateFileFromMetadata(
    candidate: BestCandidateImage,
  ): File | null {
    const candidateFile = candidate.metadata?.['file'];
    return candidateFile instanceof File ? candidateFile : null;
  }

  private clearImageWarn() {
    this.imageWarnKey = undefined;
    this.imageWarnParams = {};
    this.homeTour.requestSync();
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
    return this.billing.isDevelopmentMode() ||
      (this.billing.isBillingAvailable() &&
        (Capacitor.getPlatform() === 'web' || this.isOnline))
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

  private logPurchaseUiState(source: string): void {
    this.billing.logPurchaseUiState(source, {
      app: 'pcm',
      adsRemoved: this.adsRemoved,
      isOnline: this.isOnline,
      purchaseBusy: this.purchaseBusy,
      entryPointVisible: this.canShowRemoveAdsEntryPoint(),
      purchaseState: this.getRemoveAdsPurchaseState(),
      purchaseButtonEnabled: this.canPurchaseRemoveAds(),
      restoreButtonEnabled: this.canRestoreRemoveAds(),
    });
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

  private async openAdFallbackFromFailure(
    result: RewardedAdResult,
  ): Promise<boolean> {
    const adFallback = this.appInjector.get(AdFallbackService, null);
    if (!adFallback) {
      console.warn('[PCM:ad-fallback] service unavailable');
      return false;
    }

    try {
      await this.dismissActiveTourForBlockingModal();
      console.warn(
        `[PCM:ad-fallback] opening modal ${JSON.stringify({
          reason: this.normalizeFailureReason(result.failureReason),
          confidence: this.normalizeFailureConfidence(result.failureConfidence),
          remaining: this.resolveAdFallbackRemaining(),
        })}`,
      );
      const remaining = this.resolveAdFallbackRemaining();
      const decision = await adFallback.handleAdFailure({
        app: this.adFallbackApp,
        reason: this.normalizeFailureReason(result.failureReason),
        confidence: this.normalizeFailureConfidence(result.failureConfidence),
        remaining,
        total: this.adFallbackTotal,
        countdownSeconds: 5,
        onTelemetry: (eventName, payload) =>
          this.trackAdFallbackTelemetry(eventName, payload),
      }, this.modalCtrl);

      if (decision === 'accepted') {
        this.adFallbackTrialActive = true;
        await this.persistAdFallbackState();
        return true;
      }

      return false;
    } catch (error) {
      console.warn('[PCM:ad-fallback] failed to present fallback modal', error);
      return false;
    }
  }

  private async confirmActiveAdFallbackTrial(): Promise<boolean> {
    const adFallback = this.appInjector.get(AdFallbackService, null);
    if (!adFallback) {
      return false;
    }

    try {
      await this.dismissActiveTourForBlockingModal();
      const remaining = this.resolveAdFallbackRemaining();
      const decision = await adFallback.handleAdFailure({
        app: this.adFallbackApp,
        reason: 'unknown',
        confidence: 'low',
        remaining,
        total: this.adFallbackTotal,
        countdownSeconds: 5,
        onTelemetry: (eventName, payload) =>
          this.trackAdFallbackTelemetry(eventName, payload),
      }, this.modalCtrl);

      return decision === 'accepted';
    } catch (error) {
      console.warn(
        '[PCM:ad-fallback] failed to present active trial confirmation',
        error,
      );
      return false;
    }
  }

  private resolveAdFallbackRemaining(): number {
    return this.adFallbackRemaining;
  }

  private async dismissActiveTourForBlockingModal(): Promise<void> {
    if (!this.homeTour.isActive()) return;
    await this.homeTour.skip();
  }

  private hydrateAdFallbackState(
    preferences: Record<string, unknown> | undefined,
  ): void {
    const rawRemaining = preferences?.[this.adFallbackRemainingPrefKey];
    const parsedRemaining =
      typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)
        ? Math.floor(rawRemaining)
        : this.adFallbackTotal;
    this.adFallbackRemaining = Math.max(
      0,
      Math.min(this.adFallbackTotal, parsedRemaining),
    );

    const rawActive = preferences?.[this.adFallbackTrialActivePrefKey];
    this.adFallbackTrialActive =
      rawActive === true && this.adFallbackRemaining > 0;
  }

  private async persistAdFallbackState(): Promise<void> {
    const clampedRemaining = Math.max(
      0,
      Math.min(this.adFallbackTotal, Math.floor(this.adFallbackRemaining)),
    );
    this.adFallbackRemaining = clampedRemaining;
    const active = this.adFallbackTrialActive && clampedRemaining > 0;
    this.adFallbackTrialActive = active;

    await this.settings.set((prev) => ({
      ...prev,
      preferences: {
        ...(prev.preferences ?? {}),
        [this.adFallbackRemainingPrefKey]: clampedRemaining,
        [this.adFallbackTrialActivePrefKey]: active,
      },
    }));
  }

  private async consumeAdFallbackAttemptAfterSuccess(
    source: 'generate-web' | 'generate-native' | 'save',
  ): Promise<void> {
    if (!this.adFallbackTrialActive) {
      return;
    }

    const remaining = this.resolveAdFallbackRemaining();
    if (remaining <= 0) {
      this.adFallbackTrialActive = false;
      await this.persistAdFallbackState();
      return;
    }

    this.adFallbackRemaining = remaining - 1;
    this.adFallbackTrialActive = false;
    await this.persistAdFallbackState();
    console.info(
      `[PCM:ad-fallback] consumed on ${source} ${JSON.stringify({
        remaining: this.adFallbackRemaining,
        total: this.adFallbackTotal,
      })}`,
    );
    this.trackAdFallbackAnalyticsEvent('ad_fallback_trial_consumed', {
      app: this.adFallbackApp,
      source,
      remaining: this.adFallbackRemaining,
      total: this.adFallbackTotal,
    });
  }

  private normalizeFailureReason(value: unknown): AdFailureReason {
    switch (value) {
      case 'network':
      case 'dns':
      case 'no-fill':
      case 'blocked':
      case 'region':
      case 'unknown':
        return value;
      default:
        return 'unknown';
    }
  }

  private normalizeFailureConfidence(value: unknown): AdFailureConfidence {
    return value === 'high' ? 'high' : 'low';
  }

  private trackAdFallbackTelemetry(
    eventName: AdFallbackTelemetryEventName,
    payload: AdFallbackTelemetryPayload,
  ): void {
    console.info(`[PCM:ad-fallback] ${eventName} ${JSON.stringify(payload)}`);
    console.warn(`[PCM:ad-fallback] ${eventName} ${JSON.stringify(payload)}`);
    this.trackAdFallbackAnalyticsEvent(eventName, payload);
  }

  private trackAdFallbackAnalyticsEvent(
    eventName: string,
    payload: Record<string, unknown>,
  ): void {
    const plugins = (
      globalThis as typeof globalThis & {
        Capacitor?: {
          Plugins?: Record<string, Record<string, (...args: unknown[]) => unknown>>;
        };
      }
    ).Capacitor?.Plugins;

    const analytics =
      plugins?.['FirebaseAnalytics'] ?? plugins?.['CapacitorFirebaseAnalytics'];

    const logEvent =
      analytics && typeof analytics['logEvent'] === 'function'
        ? analytics['logEvent'].bind(analytics)
        : null;

    if (!logEvent) {
      console.warn(
        `[PCM:ad-fallback] analytics plugin unavailable ${JSON.stringify({
          eventName,
        })}`,
      );
      return;
    }

    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string' || typeof value === 'number') {
        params[key] = value;
        continue;
      }
      if (typeof value === 'boolean') {
        params[key] = value ? 1 : 0;
      }
    }

    void Promise.resolve(
      logEvent({
        name: eventName,
        params,
      }),
    ).catch((error) => {
      console.error(
        `[PCM:ad-fallback] analytics logEvent failed ${JSON.stringify({
          eventName,
          message: error instanceof Error ? error.message : String(error),
        })}`,
      );
    });
  }

  async openPurchaseModal(): Promise<void> {
    this.logPurchaseUiState('open-before-guard');
    if (!this.canShowRemoveAdsEntryPoint() || this.purchaseBusy) {
      return;
    }

    this.trackRemoveAdsEvent('remove_ads_cta_click', {
      price: this.removeAdsPriceFormatted,
    });

    this.removeAdsPurchasePage.open({
      variant: 'PCM',
      returnUrl: '/tabs/change',
    });
    await this.router.navigateByUrl('/remove-ads');
    await this.homeTour.completeInteraction('remove-ads-open');
  }

  closePurchaseModal(): void {
    this.runInZone(() => {
      this.purchaseModalOpen = false;
    });
  }

  onPurchaseModalCloseClick(): void {
    void this.homeTour.completeInteraction('remove-ads-close');
    this.closePurchaseModal();
  }

  async onPurchaseRemoveAds(): Promise<void> {
    if (!this.canPurchaseRemoveAds()) {
      return;
    }

    this.runInZone(() => {
      this.purchaseBusy = true;
    });
    await this.flushUi();
    try {
      const success = await this.billing.purchaseRemoveAds();
      if (!success) {
        return;
      }

      this.runInZone(() => {
        this.closePurchaseModal();
      });
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
      this.runInZone(() => {
        this.purchaseBusy = false;
      });
      await this.flushUi();
    }
  }

  async onRestorePurchases(): Promise<void> {
    if (!this.canRestoreRemoveAds()) {
      return;
    }

    this.runInZone(() => {
      this.purchaseBusy = true;
    });
    await this.flushUi();
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

      this.runInZone(() => {
        this.closePurchaseModal();
      });
      await this.showToast(
        'COMMON.REMOVE_ADS_RESTORED',
        { duration: 1800 },
        'success',
      );
    } catch {
      await this.showToast('COMMON.RESTORE_ERROR', { duration: 1800 }, 'error');
    } finally {
      this.runInZone(() => {
        this.purchaseBusy = false;
      });
      await this.flushUi();
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
    return this.canGenerate();
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
      await this.homeTour.completeInteraction('export-quality-select');
      await this.openPurchaseModal();
      return;
    }

    if (this.exportQualityMode === mode) {
      return;
    }

    const revision = ++this.exportQualityRevision;
    this.exportQualityMode = mode;
    this.isRebuildingExportQuality = true;
    try {
      await this.homeTour.completeInteraction('export-quality-select');
      await this.invalidateEditorRenderedOutput();
      if (revision !== this.exportQualityRevision) return;
      if (this.lastEditorRenderInfo) {
        this.lastEditorRenderInfo = updateEditorRenderQuality(
          this.lastEditorRenderInfo,
          toEditorRenderQuality(this.getEffectiveExportQualityMode()),
        );
      }
      void this.applySmallWarn('editor-apply', undefined, this.lastEditorRenderInfo);
      this.invalidateGeneratedOutputState();
      await this.settings.setForScope('exportQuality', {
        exportQualityMode: mode,
      });
    } finally {
      this.isRebuildingExportQuality = false;
    }
  }

  private async invalidateEditorRenderedOutput(): Promise<void> {
    this.previewGenerationToken += 1;
    this.renderedImageInfo = undefined;
    this.renderedImageFile = undefined;
    this.exportImageFile = undefined;
    await this.updatePreviewFromComposition();
  }

  onCoverPageModeChange(mode: CoverPageMode): void {
    void this.homeTour.completeInteraction('cover-mode-selected');
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
    this.exportQualityRevision += 1;
    this.invalidateEditorRenderedOutput();
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
    this.operationCompleted.set(false);

    this.setBusy('export', 'CHANGE.GENERATING');
    try {
      console.info(
        `[PCM:ads-gate] start ${JSON.stringify({
          adsRemoved: this.billing.isAdsRemoved(),
          trialActive: this.adFallbackTrialActive,
        })}`,
      );
      if (!this.billing.isAdsRemoved()) {
        if (this.adFallbackTrialActive && this.resolveAdFallbackRemaining() > 0) {
          console.info('[PCM:ads] active fallback trial requires explicit accept');
          const accepted = await this.confirmActiveAdFallbackTrial();
          if (!accepted) {
            await this.showToast(
              'CHANGE.ADS_REQUIRED',
              { duration: 1800 },
              'error',
            );
            return;
          }
          console.info('[PCM:ads-gate] active-trial accepted');
        } else {
          const adsService = this.appInjector.get(AdsService, null);
          if (!adsService) {
            const accepted = await this.openAdFallbackFromFailure({
              rewardEarned: false,
              adClosed: false,
              failed: true,
              failureReason: 'unknown',
              failureConfidence: 'low',
            });
            if (!accepted) {
              await this.showToast(
                'CHANGE.ADS_REQUIRED',
                { duration: 1800 },
                'error',
              );
              return;
            }
            console.info('[PCM:ads-gate] no-ads-service fallback accepted');
          }

          if (adsService) {
            const result: RewardedAdResult = await adsService.showRewarded();
            console.info(
              `[PCM:ads] rewarded result ${JSON.stringify(result)}`,
            );
            const shouldFallback =
              result.failed || (!result.rewardEarned && !result.adClosed);

            if (shouldFallback) {
              const fallbackPayload: RewardedAdResult = result.failed
                ? result
                : {
                    rewardEarned: false,
                    adClosed: false,
                    failed: true,
                    failureReason: 'unknown',
                    failureConfidence: 'low',
                  };
              const accepted = await this.openAdFallbackFromFailure(
                fallbackPayload,
              );
              if (!accepted) {
                await this.showToast(
                  'CHANGE.ADS_REQUIRED',
                  { duration: 1800 },
                  'error',
                );
                return;
              }
              console.info('[PCM:ads-gate] ad-failed fallback accepted');
            } else if (result.adClosed && !result.rewardEarned) {
              await this.showToast(
                'CHANGE.ADS_REQUIRED',
                { duration: 1800 },
                'error',
              );
              return;
            } else if (result.rewardEarned && result.adClosed) {
              console.info('[PCM:ads-gate] rewarded');
              this.trackRemoveAdsEvent('rewarded_generate_completed');
            } else {
              const accepted = await this.openAdFallbackFromFailure({
                rewardEarned: false,
                adClosed: false,
                failed: true,
                failureReason: 'unknown',
                failureConfidence: 'low',
              });
              if (!accepted) {
                await this.showToast(
                  'CHANGE.ADS_REQUIRED',
                  { duration: 1800 },
                  'error',
                );
                return;
              }
              console.info('[PCM:ads-gate] inconclusive fallback accepted');
            }
          }
        }
      }

      console.info('[PCM:ads-gate] completed, start generation');
      console.info('[PCM:generate] busy set, invoking generateChangedCover');
      const generated = await this.generateChangedCover();
      console.info(
        `[PCM:generate] generateChangedCover resolved ${JSON.stringify({
          generated,
        })}`,
      );
      if (!generated) {
        console.warn('[PCM:generate] generateChangedCover returned false');
      }
    } catch (error) {
      const maybeError = error as { message?: string; stack?: string };
      const errorPayload = {
        message: maybeError?.message ?? String(error),
        stack: maybeError?.stack ?? null,
      };
      console.error(
        `[PCM:generate] onGenerate failed ${JSON.stringify(errorPayload)}`,
      );
      await this.showToast(
        'CHANGE.PDF_ERROR_REWRITE',
        { duration: 2200 },
        'error',
      );
    } finally {
      await this.clearBusyUi();
    }
  }

  async onTripleExportQualityModeSelect(value: string): Promise<void> {
    if (value !== 'thumbnail' && value !== 'compressed' && value !== 'best') {
      return;
    }

    await this.onExportQualityModeSelect(value);
  }

  private async generateChangedCover(): Promise<boolean> {
    const exportFile = await this.ensureExportImageFile();
    if (!exportFile) return false;

    const pageTarget = this.resolveEditorPdfPageTarget();

    const preferredFilename = this.projectSaveState.getSuggestedBaseName(
      '.pdf',
      this.lastSavedFilename,
      this.outputBaseName,
      this.selectedPdfName,
      'pdf_cover',
    );

    if (this.usesNativeRewrite()) {
      const generated = await this.generateWithNativeRewrite(
        exportFile,
        preferredFilename,
        pageTarget,
      );
      if (generated) {
        await this.homeTour.completeInteraction('cover-created');
        this.operationCompleted.set(true);
      }
      return generated;
    }

    const sourcePdf = this.workingPdfFile;
    const overwriteFilename = this.projectSaveState.getOverwriteFilename();
    const overwriteExisting = !!overwriteFilename;
    let res: { bytes: Uint8Array; filename: string };
    if (sourcePdf) {
      try {
        res = await this.fileService.generatePdfBytesFromSource({
          sourcePdfFile: sourcePdf,
          coverFile: exportFile,
          filename: preferredFilename,
          coverMode: this.coverPageMode,
          pageWidthPt: pageTarget?.widthPt,
          pageHeightPt: pageTarget?.heightPt,
        });
      } catch {
        res = await this.fileService.generatePdfBytes({
          modelId: this.baseModelId,
          coverFile: exportFile,
          title: 'PDF Cover',
          pageWidthPt: pageTarget?.widthPt,
          pageHeightPt: pageTarget?.heightPt,
        });
      }
    } else {
      res = await this.fileService.generatePdfBytes({
        modelId: this.baseModelId,
          coverFile: exportFile,
          title: 'PDF Cover',
          pageWidthPt: pageTarget?.widthPt,
          pageHeightPt: pageTarget?.heightPt,
        });
    }

    this.generatedPdfBytes = res.bytes;
    this.generatedPdfFilename = overwriteFilename
      ? overwriteFilename
      : await this.resolveUniquePdfFilename(res.filename);
    this.projectSaveState.setCurrentFilename(this.generatedPdfFilename);

    this.setBusy('export', 'CHANGE.SAVING');

    const saved = await this.fileService.saveGeneratedPdf({
      bytes: this.generatedPdfBytes,
      filename: this.generatedPdfFilename,
      coverFileForThumb: exportFile,
      coverMetadata: this.buildCoverProcessingMetadata(),
      overwriteExisting,
    });
    this.logSaveFlow('finalWriteComplete', {
      flow: 'onGenerate',
      filename: saved.filename,
      writeCompletedAt: new Date().toISOString(),
    });

    this.generatedPdfFilename = saved.filename;
    try {
      await this.saveLocalProjectSnapshot(saved.filename, exportFile);
    } catch (error) {
      console.warn('[PCM:change] project snapshot save failed', error);
    }

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
    await this.consumeAdFallbackAttemptAfterSuccess('generate-web');
    await this.homeTour.completeInteraction('cover-created');
    this.operationCompleted.set(true);
    return true;
  }

  private async saveLocalProjectSnapshot(
    coverFilename: string,
    coverFileForThumb: File,
  ): Promise<void> {
    const sourceFile =
      this.originalImageFile ?? this.editorSourceFile ?? this.workingImageFile;
    if (!sourceFile) return;
    const sourceDims = this.originalImageDims ?? this.workingImageDims;

    const selected = this.getSelectedFormatOption();
    if (!selected) return;

    await this.fileService.saveProjectSnapshot({
      coverFilename,
      sourceFile,
      coverFileForThumb,
      cropState: this.cropState ?? buildDefaultCoverCropState(),
      target: {
        width: selected.target.width,
        height: selected.target.height,
      },
      coverMetadata: this.buildCoverProcessingMetadata(),
      sourceInfo: {
        name: sourceFile.name,
        width: sourceDims?.width,
        height: sourceDims?.height,
        originalName: this.originalImageFile?.name ?? sourceFile.name,
        originalWidth: this.originalImageDims?.width ?? sourceDims?.width,
        originalHeight: this.originalImageDims?.height ?? sourceDims?.height,
      },
    });
  }

  private async tryOpenProjectFromRoute(): Promise<boolean> {
    const projectFilename = this.route.snapshot.queryParamMap.get('project');
    if (!projectFilename) {
      this.lastHandledProjectRouteKey = null;
      return false;
    }

    const editMode =
      this.route.snapshot.queryParamMap.get('editMode') === 'copy'
        ? 'copy'
        : 'overwrite';
    const routeKey = `${projectFilename}::${editMode}`;
    if (this.isOpeningProjectFromRoute) {
      return false;
    }
    if (this.lastHandledProjectRouteKey === routeKey) {
      return false;
    }

    this.isOpeningProjectFromRoute = true;
    try {
      const opened = await this.openProjectByFilename(projectFilename, editMode);
      if (opened) {
        this.lastHandledProjectRouteKey = routeKey;
      }
      return opened;
    } finally {
      this.isOpeningProjectFromRoute = false;
    }
  }

  private async openProjectByFilename(
    filename: string,
    editMode: 'overwrite' | 'copy' = 'overwrite',
  ): Promise<boolean> {
    try {
      const loaded = await this.fileService.loadProjectByFilename(filename);
      if (!loaded) {
        return false;
      }

      const sourcePdfFile = await this.fileService.loadGeneratedPdfByFilename(
        loaded.snapshot.coverFilename,
      );
      if (!sourcePdfFile) {
        return false;
      }

      await this.resetWorkflowForNewPdf();
      await this.hydrateProjectPdfContext(
        loaded.snapshot.coverFilename,
        sourcePdfFile,
      );

      const snapshot = loaded.snapshot;
      const dims =
        this.sourceInfoToDims(snapshot.sourceInfo) ??
        (await this.imagePipe.getDimensions(loaded.sourceFile)) ??
        snapshot.target;
      this.originalImageFile = loaded.sourceFile;
      this.selectedImageFile = loaded.sourceFile;
      this.selectedImageName = loaded.sourceFile.name;
      this.originalImageDims = dims;
      this.workingImageDims = dims;
      this.workingImageFile = loaded.sourceFile;
      this.editorSourceFile = loaded.sourceFile;
      this.cropState = snapshot.cropState;
      this.exportImageFile = undefined;
      this.projectSaveState.setProject(snapshot.coverFilename, editMode);
      this.generatedPdfFilename =
        editMode === 'overwrite' ? snapshot.coverFilename : undefined;
      this.lastSavedFilename =
        editMode === 'overwrite' ? snapshot.coverFilename : undefined;
      const options = this.getCurrentFormatOptions();
      const matchedFormat = options.find(
        (option) =>
          option.target.width === snapshot.target.width &&
          option.target.height === snapshot.target.height,
      );
      if (matchedFormat) {
        this.selectedFormatId = matchedFormat.id;
      }
      this.setPreviewUrl(URL.createObjectURL(loaded.sourceFile));

      this.projectEditReturnUrl = '/tabs/change';
      try {
        await this.openEditor('image');
        return true;
      } finally {
        this.projectEditReturnUrl = null;
      }
    } catch {
      return false;
    }
  }

  private async hydrateProjectPdfContext(
    filename: string,
    sourcePdfFile: File,
  ): Promise<void> {
    const outputBaseName =
      filename.replace(/\.pdf$/i, '').trim() || 'pdf_cover';

    if (this.usesNativeRewrite()) {
      const cycle = await this.workingCopy.startStreamingCycle(sourcePdfFile);
      this.sourcePdfFile = sourcePdfFile;
      this.sourcePdfMeta = cycle.sourceMeta;
      this.workingPdfFile = sourcePdfFile;
      this.workingPdfPath = cycle.workingPath;
      this.workingPdfNativePath = cycle.workingNativePath;
      this.workingPdfName = cycle.workingName;
      this.outputBaseName = outputBaseName;
    } else {
      const cycle = await this.workingCopy.startCycle(sourcePdfFile);
      this.sourcePdfFile = sourcePdfFile;
      this.sourcePdfMeta = cycle.sourceMeta;
      this.workingPdfFile = cycle.workingFile;
      this.workingPdfPath = cycle.workingPath;
      this.workingPdfNativePath = undefined;
      this.workingPdfName = cycle.workingName;
      this.outputBaseName = outputBaseName;
    }

    this.selectedPdfName = filename;
    this.coverEntryPath = undefined;
    this.clearPdfError();
    await this.resolvePdfFirstPageDims();
  }

  private sourceInfoToDims(sourceInfo?: {
    width?: number;
    height?: number;
    originalWidth?: number;
    originalHeight?: number;
  }): { width: number; height: number } | null {
    const width = sourceInfo?.width ?? sourceInfo?.originalWidth;
    const height = sourceInfo?.height ?? sourceInfo?.originalHeight;
    if (!width || !height) return null;
    return { width, height };
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
    pageTarget?: { widthPt: number; heightPt: number },
  ): Promise<boolean> {
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
    const overwriteExisting = !!this.projectSaveState.getOverwriteFilename();
    const outputTarget =
      await this.fileService.reserveNativeDocumentOutput(requestedFilename, {
        overwriteExisting,
      });

    this.isNativeRewriteInProgress = true;
    this.isCancellingNativeRewrite = false;
    this.rewriteProgressPercent = 0;

    try {
      const result = await this.pdfRewrite.rewriteCover({
        inputPath: this.workingPdfNativePath,
        outputPath: outputTarget.rewriteNativePath,
        newCoverPath: tempCover.nativePath,
        mode: this.coverPageMode,
        pageWidthPt: pageTarget?.widthPt,
        pageHeightPt: pageTarget?.heightPt,
      });

      if (!result.success) {
        if (result.error === 'CANCELLED') {
          await this.showToast(
            'CHANGE.PROCESS_CANCELLED',
            { duration: 1600 },
            'info',
          );
          return false;
        }

        throw new PdfRewriteError(result.error ?? 'REWRITE_FAILED', {
          message: result.message,
          stage: result.stage,
          requiredBytes: result.requiredBytes,
          availableBytes: result.availableBytes,
        });
      }

      const committedOutput =
        await this.fileService.commitNativeDocumentOutput(outputTarget);
      this.generatedPdfBytes = undefined;
      this.generatedPdfPath = undefined;
      this.generatedPdfNativePath = committedOutput.uri;
      this.generatedPdfFilename = outputTarget.filename;
      this.rewriteProgressPercent = 100;
      this.logSaveFlow('finalWriteComplete', {
        flow: 'nativeRewrite',
        filename: outputTarget.filename,
        outputPath: committedOutput.uri,
        bytes: committedOutput.size,
        writeCompletedAt: new Date().toISOString(),
      });

      this.setBusy('export', 'CHANGE.SAVING');
      await this.fileService.persistCoverAssetsForGeneratedFilename({
        filename: outputTarget.filename,
        coverFileForThumb: rewriteCoverFile,
        coverMetadata: this.buildCoverProcessingMetadata(),
      });

      try {
        await this.saveLocalProjectSnapshot(outputTarget.filename, rewriteCoverFile);
      } catch (error) {
        console.warn('[PCM:change] project snapshot save failed', error);
      }

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
      this.projectSaveState.setCurrentFilename(outputTarget.filename);

      await this.showToast(
        'CHANGE.COVER_CHANGED',
        { duration: 2200 },
        'success',
      );
      await this.maybeAskForRatingAfterSuccessfulSave('native');
      await this.consumeAdFallbackAttemptAfterSuccess('generate-native');
      return true;
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
      return false;
    } finally {
      this.isNativeRewriteInProgress = false;
      this.isCancellingNativeRewrite = false;
      await this.workingCopy.cleanupWorkingCopy(tempCover.path);
      await this.fileService.cleanupNativeDocumentOutput(outputTarget);
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
    stage: 'pick_pdf' | 'rewrite_cover',
  ): void {
    // Keep native picker available even when rewrite path is disabled.
    if (stage === 'pick_pdf') {
      return;
    }

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
    if (error instanceof PdfRewriteError && error.code === 'UNSUPPORTED_PDF') {
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

  private mapValidationErrorToUiKey(errorKey: string | undefined): string {
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
    this.previewEditingPage.open({
      imageSrc: this.previewModalImageSrc,
      imageWidth: this.previewModalImageWidth,
      imageHeight: this.previewModalImageHeight,
      beforeSrc: this.previewModalBeforeSrc,
      afterSrc: this.previewModalAfterSrc,
      beforeLabel:
        this.previewModalMode === 'compare'
          ? 'CHANGE.PREVIEW_ORIGINAL_LABEL'
          : null,
      afterLabel:
        this.previewModalMode === 'compare' && !!this.previewModalBeforeSrc
          ? 'CHANGE.PREVIEW_NEW_LABEL'
          : 'CHANGE.PREVIEW_NEW_ONLY_LABEL',
      mode: this.previewModalMode,
      comparisonEnabled: this.previewModalComparisonEnabled,
      isDithered: this.isPreviewDithered(),
      returnUrl: '/tabs/change',
    });
    void this.router.navigateByUrl('/tabs/preview-editing');
  }

  closePreview() {
    this.previewEditingPage.clear();
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

  private registerRecovery(): void {
    this.recovery.register<PcmRecoverySnapshot>({
      snapshot: () => ({
        workflowStep: this.workflowStep,
        workingPdfPath: this.workingPdfPath,
        workingPdfNativePath: this.workingPdfNativePath,
        workingPdfName: this.workingPdfName,
        outputBaseName: this.outputBaseName,
        selectedPdfName: this.selectedPdfName,
        generatedPdfPath: this.generatedPdfPath,
        generatedPdfFilename: this.generatedPdfFilename,
        lastSavedFilename: this.lastSavedFilename,
        selectedFormatId: this.selectedFormatId,
        exportQualityMode: this.exportQualityMode,
        originalImageDims: this.originalImageDims,
        workingImageDims: this.workingImageDims,
        selectedImageName: this.selectedImageName,
        cropState: this.cropState,
      }),
      assets: () => ({
        sourcePdf: this.sourcePdfFile ?? this.workingPdfFile,
        originalImage: this.originalImageFile,
        workingImage: this.workingImageFile,
      }),
      restore: async (snapshot, assets) => {
        const sourcePdf = assets['sourcePdf'];
        if (sourcePdf) {
          const cycle = await this.workingCopy.startCycle(sourcePdf);
          this.sourcePdfFile = sourcePdf;
          this.workingPdfFile = cycle.workingFile;
          this.workingPdfPath = cycle.workingPath;
          this.workingPdfNativePath = snapshot.workingPdfNativePath;
          this.workingPdfName = cycle.workingName;
        } else {
          this.workingPdfPath = snapshot.workingPdfPath;
          this.workingPdfNativePath = snapshot.workingPdfNativePath;
          this.workingPdfName = snapshot.workingPdfName;
        }
        this.outputBaseName = snapshot.outputBaseName;
        this.selectedPdfName = snapshot.selectedPdfName;
        this.generatedPdfPath = snapshot.generatedPdfPath;
        this.generatedPdfFilename = snapshot.generatedPdfFilename;
        this.lastSavedFilename = snapshot.lastSavedFilename;
        this.selectedFormatId = snapshot.selectedFormatId;
        this.exportQualityMode = snapshot.exportQualityMode;
        this.workflowStep = Math.max(0, Math.min(4, snapshot.workflowStep));
        this.originalImageDims = snapshot.originalImageDims;
        this.workingImageDims = snapshot.workingImageDims;
        this.selectedImageName = snapshot.selectedImageName;
        this.cropState = snapshot.cropState;
        this.originalImageFile = assets['originalImage'];
        this.workingImageFile = assets['workingImage'] ?? assets['originalImage'];
        this.editorSourceFile = this.workingImageFile;
        if (this.workingImageFile) {
          this.setPreviewUrl(URL.createObjectURL(this.workingImageFile));
        }
      },
    });
  }

  ionViewWillLeave() {
    this.lifecycle.log('Ionic.ChangePage.ionViewWillLeave', {
      workflowStep: this.workflowStep,
    });
    void this.recovery.save();
    this.closeInfo();
  }

  async ionViewWillEnter() {
    this.lifecycle.log('Ionic.ChangePage.ionViewWillEnter', {
      workflowStep: this.workflowStep,
    });
    const openedProject = await this.tryOpenProjectFromRoute();
    if (!openedProject) {
      await this.consumeEditorResult();
    }
    await this.tryOpenPurchaseFromRoute();
    void this.refreshHeaderItems();
  }

  private async tryOpenPurchaseFromRoute(): Promise<void> {
    if (
      this.route.snapshot.queryParamMap.get(PURCHASE_INTENT_QUERY_PARAM) !==
      REMOVE_ADS_PURCHASE_INTENT
    ) {
      return;
    }

    await this.openPurchaseModal();
  }

  private async refreshHeaderItems(): Promise<void> {
    this.recommendedApps =
      await this.recommendedAppsService.getRecommendedApps();
    this.showRecommended = this.recommendedApps.length > 0;
    this.headerItems = buildHomeHeaderItems(this.showRecommended, {
      appsLabel: this.translate.instant('ARR.TOOLS.APPS'),
      resetLabel: this.translate.instant('UI_THEME.RESET'),
      includeGuide: false,
    });
  }

  async onHeaderItemClick(id: string): Promise<void> {
    await handleHomeHeaderAction(id, {
      closeInfo: () => this.closeInfo(),
      toggleInfo: () => this.toggleInfo(),
      navigateToRecommended: async () => {
        await this.router.navigateByUrl('/tabs/recommended-apps');
      },
      resetFlow: () => this.resetFlow(),
    });
  }

  async resetFlow(): Promise<void> {
    if (this.isResettingFlow) return;
    if (!(await this.editorSessionExit.confirmResetFlow())) return;
    this.runInZone(() => {
      this.isResettingFlow = true;
      this.changeDetector.detectChanges();
    });
    await this.runInZone(async () => {
      try {
        await this.clearBusyUi();
        if (this.isNativeRewriteInProgress && !this.isCancellingNativeRewrite) {
          await this.cancelNativeRewrite();
        }
        await this.resetWorkflowForNewPdf(true);
        await this.recovery.clear();
        if (this.pdfInput?.nativeElement) {
          this.pdfInput.nativeElement.value = '';
        }
      } finally {
        this.isResettingFlow = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  async onOperationDone(): Promise<void> {
    if (this.isResettingFlow) return;
    this.runInZone(() => {
      this.isResettingFlow = true;
      this.changeDetector.detectChanges();
    });
    await this.runInZone(async () => {
      try {
        await this.clearBusyUi();
        if (this.isNativeRewriteInProgress && !this.isCancellingNativeRewrite) {
          await this.cancelNativeRewrite().catch(() => undefined);
        }
        await this.resetWorkflowForNewPdf(true);
        if (this.pdfInput?.nativeElement) {
          this.pdfInput.nativeElement.value = '';
        }
        await this.router.navigateByUrl('/tabs/my-pdfs');
      } finally {
        this.isResettingFlow = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  private async consumeEditorResult(sessionId?: string): Promise<void> {
    const { session, result } = consumeEditorResultSnapshot(
      this.editorSession,
      sessionId ?? this.lastEditorSessionId,
    );

    if (result) {
      this.lastEditorSessionId = undefined;
    }

    if (result?.file) {
      await this.applyCropResult(result);
      return;
    }

    if (session && !result) {
      if (!this.editorOpenedFromCurrentCover) {
        this.currentPreviewOrigin = this.originalPdfPreviewUrl
          ? 'source-pdf'
          : null;
      }
      this.workflowStep = 2;
      this.editorOpenedFromCurrentCover = false;
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
    if (!Number.isFinite(next.frameWidth as number)) {
      next.frameWidth = target.width;
    }
    if (!Number.isFinite(next.frameHeight as number)) {
      next.frameHeight = target.height;
    }
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
    const options = this.getCurrentFormatOptions();
    if (formatId === 'with_frame' || formatId === 'without_frame') {
      return ChangePage.FORMAT_ID_AUTO;
    }
    const legacyAliases: Record<string, string> = {
      carta: 'letter',
      oficio: 'legal',
    };
    const normalizedId = formatId ? legacyAliases[formatId] ?? formatId : undefined;
    if (normalizedId && options.some((option) => option.id === normalizedId)) {
      return normalizedId;
    }

    return options[0]?.id ?? ChangePage.FORMAT_ID_AUTO;
  }

  private resolveEditorPdfPageTarget(): { widthPt: number; heightPt: number } | undefined {
    const info = this.lastEditorRenderInfo;
    const widthPt = info?.pageWidthPt;
    const heightPt = info?.pageHeightPt;
    if (
      info?.outputMode !== 'physical-size' ||
      typeof widthPt !== 'number' ||
      typeof heightPt !== 'number' ||
      !Number.isFinite(widthPt) ||
      !Number.isFinite(heightPt) ||
      widthPt <= 0 ||
      heightPt <= 0
    ) {
      return undefined;
    }
    return { widthPt, heightPt };
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

  private logSaveFlow(event: string, payload?: Record<string, unknown>): void {
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[ECC:change:save-flow] ${event}${suffix}`);
  }
}


