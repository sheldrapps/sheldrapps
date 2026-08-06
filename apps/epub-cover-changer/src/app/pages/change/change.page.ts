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
  type KindleGroup,
  type CropOrientation,
  type CropTargetCategory,
  type CropTargetPreset,
  type CropTargetGroup,
  type PublishingCropPreset,
  type CropTargetsConfig,
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
import { EpubWorkingCopyService } from '../../services/epub-working-copy.service';
import {
  AdFallbackService,
  type AdFailureConfidence,
  type AdFailureReason,
} from '@sheldrapps/ad-fallback-kit';
import {
  PURCHASE_INTENT_QUERY_PARAM,
  REMOVE_ADS_PURCHASE_INTENT,
  RemoveAdsPurchasePageService,
} from '@sheldrapps/ads-kit';
import {
  AdsService,
  BillingService,
  type RewardedAdResult,
} from '../../services/ads.service';
import { CoversEventsService } from '../../services/covers-events.service';
import {
  EpubRewriteError,
  EpubRewriteService,
} from '../../services/epub-rewrite.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastOptions } from '@ionic/angular';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { RatingService } from '@sheldrapps/rating-kit';
import {
  ActionCardComponent,
  SpinnerComponent,
  RenameIconComponent,
  ProBadgeComponent,
  SaveCoverModalComponent,
  ScrollableBarItem,
  ScrollableButtonBarComponent,
  WorkflowNavigationComponent,
  WorkflowStepperComponent,
  TripleButtonComponent,
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
import { EccSettings } from '../../settings/ecc-settings.schema';
import { EpubCandidateImageService } from '../../services/epub-candidate-image.service';
import { TourService } from '../../shared/tour/tour.service';
import { EccLifecycleDiagnosticsService } from '../../services/ecc-lifecycle-diagnostics.service';
import {
  EccEditorRecoveryService,
  type EccRecoverySnapshot,
} from '../../services/ecc-editor-recovery.service';

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
    ActionCardComponent,
    SpinnerComponent,
    RenameIconComponent,
    ProBadgeComponent,
    CoverImageStateComponent,
    CoverSourceActionsComponent,
    ScrollableButtonBarComponent,
    TripleButtonComponent,
    WorkflowNavigationComponent,
    WorkflowStepperComponent,
    BestCandidatePickerComponent,
  ],
})
export class ChangePage implements OnInit, OnDestroy {
  private static readonly PREVIEW_MAX_SIDE = 1280;
  private static readonly THUMB_SIZE = 96;
  private static readonly PUBLISHING_PRESET_PREFIXES = [
    'amazon-kdp-',
    'kobo-writing-life-',
    'apple-books-',
    'google-play-books-',
    'barnes-noble-press-',
    'tolino-media-',
    'ridi-',
    'draft2digital-',
    'ingramspark-',
    'publishdrive-',
    'streetlib-',
    'lulu-',
  ];
  private modalCtrl = inject(ModalController);
  private fileService = inject(FileService);
  private workingCopy = inject(EpubWorkingCopyService);
  private epubRewrite = inject(EpubRewriteService);
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
  private settings = inject(SettingsStore<EccSettings>);
  private ratingService = inject(RatingService);
  private recommendedAppsService = inject(RecommendedAppsService);
  private bestCandidateService = inject(BestCandidateService);
  private candidateImageService = inject(EpubCandidateImageService);
  private homeTour = inject(TourService);
  private lifecycle = inject(EccLifecycleDiagnosticsService);
  private recovery = inject(EccEditorRecoveryService);
  private appInjector = inject(Injector);
  private readonly baseTarget = { width: 1236, height: 1648 };
  private readonly baseModelId = 'epub';
  private readonly maxEpubSizeMB = 2048;
  private readonly formatOptions = this.buildFormatOptions();
  private kindleModelCatalog: KindleGroup[] = [];
  private persistedEReaderBrandId?: string;
  private persistedEReaderModelId?: string;
  private persistedCropTargetCategory?: CropTargetCategory;
  private persistedCropTargetOrientation?: CropOrientation;
  private routerSub?: Subscription;
  private coversEventsSub?: Subscription;
  private rewriteProgressSub?: PluginListenerHandle;
  private lastEditorSessionId?: string;
  private lastEditorRenderInfo?: EditorRenderInfo;
  private lastEditorSourceMode: EditorSourceMode = 'image';
  private previewLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressNextImagePick = false;
  private workingMaxSideApplied: boolean | null = null;
  private persistedCropTargetId = 'epub';
  private readonly artifactReductionInfoSeenKey =
    'ecc_editor_artifact_reduction_info_seen';
  private readonly editorEReaderOptimizationFeatureEnabled = true;
  private projectEditReturnUrl: string | null = null;
  private activeProjectFilename?: string;
  private lastHandledProjectRouteKey: string | null = null;
  private isOpeningProjectFromRoute = false;
  private adFallbackTrialActive = false;
  private readonly adFallbackTotal = 1;
  private adFallbackRemaining = this.adFallbackTotal;
  private readonly adFallbackApp = 'ecc' as const;
  private readonly adFallbackRemainingPrefKey = 'ecc_ad_fallback_remaining';
  private readonly adFallbackTrialActivePrefKey = 'ecc_ad_fallback_trial_active';
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

  readonly workflowSteps: readonly WorkflowStep[] = [
    { id: 'epub', label: this.translate.instant('CHANGE.STEPPER.EPUB') },
    { id: 'cover', label: this.translate.instant('CHANGE.STEPPER.COVER') },
    { id: 'adjust', label: this.translate.instant('CHANGE.STEPPER.ADJUST') },
    { id: 'create', label: this.translate.instant('CHANGE.STEPPER.CREATE') },
  ];
  workflowStep = 0;

  @ViewChild('epubInput') epubInput!: ElementRef<HTMLInputElement>;
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

  // EPUB state
  sourceEpubFile?: File;
  workingEpubFile?: File;
  workingEpubPath?: string;
  workingEpubNativePath?: string;
  sourceEpubUri?: string;
  sourceEpubUriPermissionPersisted = false;
  workingEpubName?: string;
  coverEntryPath?: string;
  outputBaseName?: string;
  sourceEpubMeta?: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  };
  selectedEpubName?: string;
  epubErrorKey?: string;
  epubErrorParams: Record<string, any> = {};
  // Image state
  originalImageFile?: File;
  selectedImageFile?: File;
  selectedImageName?: string;
  originalImageDims?: { width: number; height: number };
  workingImageDims?: { width: number; height: number };

  previewUrl?: string;
  previewRevision = 0;
  previewThumbUrl?: string;
  originalEpubPreviewUrl: string | null = null;
  cropState?: CoverCropState;
  selectedFormatId = 'epub';
  exportQualityMode: ExportQualityMode = DEFAULT_EXPORT_QUALITY_MODE;
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
  private readonly isPickingEpubState = signal(false);
  private readonly isNativeRewriteInProgressState = signal(false);

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

  get isPickingEpub(): boolean {
    return this.isPickingEpubState();
  }

  set isPickingEpub(value: boolean) {
    this.isPickingEpubState.set(value);
  }

  get isNativeRewriteInProgress(): boolean {
    return this.isNativeRewriteInProgressState();
  }

  set isNativeRewriteInProgress(value: boolean) {
    this.isNativeRewriteInProgressState.set(value);
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

  generatedEpubBytes?: Uint8Array;
  generatedEpubPath?: string;
  generatedEpubNativePath?: string;
  generatedEpubFilename?: string;
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
  isCancellingNativeRewrite = false;
  private readonly epubLoadProgressPercentState = signal(0);

  get epubLoadProgressPercent(): number {
    return this.epubLoadProgressPercentState();
  }

  set epubLoadProgressPercent(value: number) {
    this.epubLoadProgressPercentState.set(value);
  }
  epubLoadStage: 'copy' | 'inspect' | null = null;

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
  private editorOpenedFromCurrentCover = false;
  private previewGenerationToken = 0;
  private exportQualityRevision = 0;
  private currentPreviewOrigin:
    | 'source-epub'
    | 'replacement'
    | 'edited'
    | null = null;
  private readonly invalidCoverWarnKey = 'CHANGE.IMAGE_WARN_INVALID_EPUB_COVER';

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

  get previewModalMode(): 'single' | 'compare' {
    if (this.previewCandidateOverride) return 'single';
    return this.shouldShowComparePreview() ? 'compare' : 'single';
  }

  get previewModalBeforeSrc(): string | null {
    return this.previewCandidateOverride ? null : this.originalEpubPreviewUrl;
  }

  get previewModalAfterSrc(): string | null {
    return this.previewCandidateOverride ? null : this.previewUrlWithNonce;
  }

  get previewModalComparisonEnabled(): boolean {
    return !this.previewCandidateOverride;
  }

  get nativeLoadMode(): 'epub' | 'rewrite' | null {
    if (this.isNativeRewriteInProgress) return 'rewrite';
    if (this.isPickingEpub && this.usesNativeRewrite()) return 'epub';
    return null;
  }

  get showNativeLoadOverlay(): boolean {
    return this.nativeLoadMode !== null;
  }

  get nativeLoadTitleKey(): string {
    return this.nativeLoadMode === 'rewrite'
      ? 'CHANGE.CHANGING_COVER'
      : 'CHANGE.LOADING_EPUB';
  }

  get nativeLoadPercentLabel(): string {
    const raw =
      this.nativeLoadMode === 'rewrite'
        ? this.rewriteProgressPercent
        : this.epubLoadProgressPercent;
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
      this.hasValidEpub() &&
      !this.previewUrl &&
      !this.imageErrorKey &&
      this.imageWarnKey === this.invalidCoverWarnKey
    );
  }

  get shouldShowBestCandidateAction(): boolean {
    const hasCandidateState =
      this.bestCandidateRequested || this.bestCandidates.length > 0;
    return (
      (this.workflowStep === 1 && hasCandidateState) ||
      (!this.previewUrl && this.showInvalidCoverFallback)
    );
  }

  getSuggestedStepId():
    | 'epub-picker'
    | 'cover-source-image'
    | 'create-button'
    | 'result-actions'
    | null {
    if (!this.hasValidEpub() || this.epubErrorKey) return 'epub-picker';
    if (!this.previewUrl || this.imageErrorKey) return 'cover-source-image';
    if (this.canSaveShare()) return 'result-actions';
    if (this.canGenerate()) return 'create-button';
    return null;
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
        return this.hasValidEpub();
      case 1:
        return this.canCrop();
      case 2:
        return this.canExport();
      default:
        return false;
    }
  }

  async onWorkflowPrevious(): Promise<void> {
    if (this.workflowStep <= 0 || this.isExporting) return;
    await this.navigateToWorkflowStep(this.workflowStep - 1);
  }

  async onWorkflowNext(): Promise<void> {
    if (!this.canContinueWorkflow()) return;

    if (this.workflowStep === 1) {
      await this.startCrop();
      return;
    }

    await this.navigateToWorkflowStep(this.workflowStep + 1);
  }

  async onWorkflowStepSelected(step: number): Promise<void> {
    if (step < 0 || step > 3 || step === this.workflowStep) return;
    if (step === 0 && this.hasValidEpub()) {
      await this.navigateToWorkflowStep(step);
      return;
    }
    if (step === 1 && this.hasValidEpub()) {
      await this.navigateToWorkflowStep(step);
      return;
    }
    if (step === 2 && this.canCrop()) {
      await this.navigateToWorkflowStep(step);
      return;
    }
    if (step === 3 && this.canExport()) {
      await this.navigateToWorkflowStep(step);
    }
  }

  private async navigateToWorkflowStep(step: number): Promise<void> {
    this.workflowStep = step;
    if (step === 2 && this.canCrop()) {
      await this.startCrop();
    }
  }

  async ngOnInit() {
    this.lifecycle.log('ChangePage.ngOnInit', {
      workflowStep: this.workflowStep,
      route: this.router.url,
    });
    await this.loadKindleModelCatalog();
    await this.initializeNativeRewriteSafetyGate();
    await this.refreshHeaderItems();
    this.isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
    await this.billing.hydrateCachedState();
    this.adsRemoved = this.billing.isAdsRemoved();
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe((value) => {
      this.runInZone(() => {
        const previousAdsRemoved = this.adsRemoved;
        const tierChanged = previousAdsRemoved !== value;
        this.adsRemoved = value;
        if (value) {
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
    });
    this.removeAdsPriceFormatted = this.billing.getRemoveAdsPriceFormatted();
    this.removeAdsPriceSub = this.billing.removeAdsPrice$.subscribe((value) => {
      this.runInZone(() => {
        this.removeAdsPriceFormatted = value;
      });
    });
    this.syncRemoveAdsPulse();

    const settings = await this.settings.load();
    this.persistedEReaderBrandId = settings.eReaderBrandId;
    this.persistedEReaderModelId = settings.eReaderModelId;
    this.persistedCropTargetCategory = settings.cropTargetCategory;
    this.persistedCropTargetOrientation = settings.cropTargetOrientation;
    this.hydrateAdFallbackState(settings.preferences);
    this.selectedFormatId = this.resolveFormatId(settings.cropTargetId);
    this.persistedCropTargetId = this.selectedFormatId;
    this.exportQualityMode = normalizeExportQualityMode(
      settings.exportQualityMode,
      this.adsRemoved,
    );
    this.syncAuthorizedExportQualityMode('settings-load');

    if (this.usesNativeRewrite()) {
      this.rewriteProgressSub = await this.epubRewrite.addProgressListener(
        ({ percent }) => {
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
          if (this.isPickingEpub) {
            if (this.epubLoadProgressPercentState() !== normalizedPercent) {
              this.epubLoadProgressPercentState.set(normalizedPercent);
            }
          }
        },
      );
    }

    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        this.lifecycle.log('ChangePage.NavigationEnd', { url });
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

  }

  ngOnDestroy() {
    this.lifecycle.log('ChangePage.ngOnDestroy', {
      workflowStep: this.workflowStep,
      hasEpub: this.hasValidEpub(),
      hasCrop: !!this.cropState,
      hasOutput: !!this.generatedEpubFilename,
    });
    this.closeInfo();
    this.closePurchaseModal();
    this.clearPreviewLongPress();
    this.resetBestCandidateState(true);
    this.revokePreviewUrl();
    this.revokeOriginalEpubPreviewUrl();
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
    void this.persistRecoveryState('ChangePage.ngOnDestroy');
  }

  private async persistRecoveryState(reason: string): Promise<void> {
    if (!this.workingEpubPath || !this.workingEpubName) return;

    const snapshot: Omit<EccRecoverySnapshot, 'schemaVersion' | 'savedAt'> = {
      workflowStep: this.workflowStep,
      lastEditorSourceMode: this.lastEditorSourceMode,
      selectedFormatId: this.selectedFormatId,
      exportQualityMode: this.exportQualityMode,
      targetWidth: this.targetWidth,
      targetHeight: this.targetHeight,
      originalImageDims: this.originalImageDims,
      workingImageDims: this.workingImageDims,
      selectedImageName: this.selectedImageName,
      cropState: this.cropState,
      sourceEpub: {
        selectedName: this.selectedEpubName,
        workingPath: this.workingEpubPath,
        workingNativePath: this.workingEpubNativePath,
        workingName: this.workingEpubName,
        outputBaseName: this.outputBaseName,
        coverEntryPath: this.coverEntryPath,
        sourceUri: this.sourceEpubUri,
        sourceUriPermissionPersisted: this.sourceEpubUriPermissionPersisted,
        meta: this.sourceEpubMeta,
      },
      output: {
        filename: this.generatedEpubFilename,
        tempPath: this.generatedEpubPath,
        nativePath: this.generatedEpubNativePath,
        tempNativePath: this.generatedEpubNativePath,
        lastSavedFilename: this.lastSavedFilename,
        wasAutoSaved: this.wasAutoSaved,
      },
      processing: {
        kind: this.isNativeRewriteInProgress
          ? 'rewrite'
          : this.isExporting
            ? 'export'
            : this.isPickingEpub
              ? 'pick'
              : null,
        active: this.isNativeRewriteInProgress || this.isExporting || this.isPickingEpub,
      },
    };

    try {
      await this.recovery.save(snapshot, {
        originalImage: this.originalImageFile,
        workingImage: this.workingImageFile,
      });
      this.lifecycle.log('ECC.recovery.saved', {
        reason,
        workflowStep: this.workflowStep,
        hasCrop: !!this.cropState,
        hasWorkingEpub: !!this.workingEpubPath,
        hasOutput: !!this.generatedEpubFilename,
      });
    } catch (error) {
      this.lifecycle.log('ECC.recovery.save-failed', {
        reason,
        error: String(error),
      });
    }
  }

  private async restoreRecoveryState(): Promise<boolean> {
    const recovered = await this.recovery.load();
    if (!recovered) return false;

    const { snapshot, assets } = recovered;
    const source = snapshot.sourceEpub;
    if (!source?.workingPath || !source.workingName) {
      await this.recovery.clear();
      return false;
    }
    if (!(await this.workingCopy.hasWorkingCopy(source.workingPath))) {
      this.lifecycle.log('ECC.recovery.discarded', {
        reason: 'working-epub-missing',
        workingPath: source.workingPath,
      });
      await this.recovery.clear();
      return false;
    }

    let restoredWorkingEpub: File | null = null;
    if (!this.usesNativeRewrite()) {
      restoredWorkingEpub = await this.workingCopy.restoreWebWorkingCopy({
        workingPath: source.workingPath,
        workingName: source.workingName,
        sourceMeta: source.meta ?? {
          name: source.selectedName ?? source.workingName,
          size: 0,
          lastModified: Date.now(),
          type: 'application/epub+zip',
        },
      });
      if (!restoredWorkingEpub) {
        await this.recovery.clear();
        return false;
      }
    } else if (!source.workingNativePath) {
      await this.recovery.clear();
      return false;
    }

    if (snapshot.workflowStep > 0 && !assets.workingImage) {
      this.lifecycle.log('ECC.recovery.discarded', {
        reason: 'image-asset-missing',
        workflowStep: snapshot.workflowStep,
      });
      await this.recovery.clear();
      return false;
    }

    this.sourceEpubFile = restoredWorkingEpub ?? undefined;
    this.sourceEpubMeta = source.meta;
    this.workingEpubFile = restoredWorkingEpub ?? undefined;
    this.workingEpubPath = source.workingPath;
    this.workingEpubNativePath = source.workingNativePath;
    this.workingEpubName = source.workingName;
    this.outputBaseName = source.outputBaseName;
    this.selectedEpubName = source.selectedName;
    this.sourceEpubUri = source.sourceUri;
    this.sourceEpubUriPermissionPersisted =
      source.sourceUriPermissionPersisted === true;
    this.coverEntryPath = source.coverEntryPath;
    this.originalImageFile = assets.originalImage ?? assets.workingImage;
    this.selectedImageFile = assets.workingImage ?? assets.originalImage;
    this.workingImageFile = assets.workingImage ?? assets.originalImage;
    this.editorSourceFile = this.originalImageFile ?? this.workingImageFile;
    this.selectedImageName = snapshot.selectedImageName;
    this.originalImageDims = snapshot.originalImageDims;
    this.workingImageDims = snapshot.workingImageDims;
    this.cropState = snapshot.cropState;
    this.selectedFormatId = snapshot.selectedFormatId;
    this.exportQualityMode = normalizeExportQualityMode(
      snapshot.exportQualityMode as ExportQualityMode,
      this.adsRemoved,
    );
    this.targetWidth = snapshot.targetWidth;
    this.targetHeight = snapshot.targetHeight;
    this.workflowStep = Math.max(0, Math.min(3, snapshot.workflowStep));
    this.lastEditorSourceMode = snapshot.lastEditorSourceMode;
    this.generatedEpubBytes = undefined;
    this.generatedEpubPath = undefined;
    this.generatedEpubNativePath = snapshot.output?.nativePath;
    this.generatedEpubFilename = snapshot.output?.filename;
    this.lastSavedFilename = snapshot.output?.lastSavedFilename;
    this.wasAutoSaved = snapshot.output?.wasAutoSaved === true;
    this.isPickingEpub = false;
    this.isExporting = false;
    this.isNativeRewriteInProgress = false;
    this.rewriteProgressPercent = 0;
    if (this.lastSavedFilename) {
      this.projectSaveState.setCurrentFilename(this.lastSavedFilename);
    }

    this.revokePreviewUrl();
    this.revokeOriginalEpubPreviewUrl();
    if (this.originalImageFile) {
      this.setOriginalEpubPreviewUrl(this.originalImageFile);
    }
    if (this.workingImageFile) {
      this.setPreviewUrl(URL.createObjectURL(this.workingImageFile));
      await this.updatePreviewFromComposition().catch(() => undefined);
    }
    this.currentPreviewOrigin = this.cropState ? 'edited' : 'source-epub';
    this.lifecycle.log('ECC.recovery.restored', {
      workflowStep: this.workflowStep,
      hasCrop: !!this.cropState,
      selectedEpubName: this.selectedEpubName,
      sourceUri: this.sourceEpubUri,
      sourceUriPermissionPersisted: this.sourceEpubUriPermissionPersisted,
      output: this.lastSavedFilename,
    });
    return true;
  }

  private setBusy(
    kind: 'pick' | 'export' | 'epub' | 'none',
    messageKey?: string,
  ) {
    this.zone.run(() => {
      this.isPickingImage = kind === 'pick';
      this.isExporting = kind === 'export';
      this.isPickingEpub = kind === 'epub';
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

  private async loadKindleModelCatalog(): Promise<void> {
    try {
      const response = await fetch('assets/data/kindle-model-groups.json');
      if (!response.ok) return;
      const catalog = (await response.json()) as KindleGroup[];
      this.kindleModelCatalog = Array.isArray(catalog) ? catalog : [];
    } catch {
      this.kindleModelCatalog = [];
    }
  }

  private buildKindleToolsConfig(selected: CropFormatOption) {
    const preferredBrandId =
      this.persistedEReaderBrandId ?? (selected.id === 'kobo' ? 'kobo' : 'kindle');
    const groups = this.kindleModelCatalog.filter(
      (group) => (group.brandId ?? 'kindle') === preferredBrandId,
    );
    const match = groups
      .flatMap((group) =>
        (group.items ?? group.models ?? []).map((model) => ({ group, model })),
      )
      .find(
        ({ model }) =>
          model.id === this.persistedEReaderModelId ||
          (model.width === selected.target.width &&
            model.height === selected.target.height),
      );
    return {
      modelCatalog: this.kindleModelCatalog,
      selectedBrandId: match?.group.brandId ?? preferredBrandId,
      selectedGroupId: match?.group.id,
      selectedModel: match?.model,
    };
  }

  private async persistEditorEReaderSelection(sid: string): Promise<void> {
    const kindle = this.editorSession.getSession(sid)?.tools?.kindle;
    const brandId = kindle?.selectedBrandId?.trim();
    const modelId = kindle?.selectedModel?.id?.trim();
    if (!brandId && !modelId) return;
    this.persistedEReaderBrandId = brandId;
    this.persistedEReaderModelId = modelId;
    await this.settings.set({
      eReaderBrandId: brandId,
      eReaderModelId: modelId,
    });
  }

  private async persistEditorCropTargetSelection(sid: string): Promise<void> {
    const cropTargets = this.editorSession.getSession(sid)?.tools?.cropTargets;
    const category = cropTargets?.activeCategory;
    if (!category) return;
    const selection = cropTargets.selections?.[category];
    await this.settings.set({
      cropTargetCategory: category,
      cropTargetOrientation: selection?.orientation,
      cropTargetId: selection?.presetId ?? this.persistedCropTargetId,
    });
    this.persistedCropTargetCategory = category;
    this.persistedCropTargetOrientation = selection?.orientation;
    this.persistedCropTargetId = selection?.presetId ?? this.persistedCropTargetId;
  }

  private buildFormatOptions(): CropFormatOption[] {
    const fixedTarget = (formatId: string, width: number, height: number): CropTarget => ({
      formatId,
      width,
      height,
      output: 'target',
      unit: 'px',
      outputMode: 'fixed-size',
    });
    const aspectTarget = (
      formatId: string,
      width: number,
      height: number,
      unit: 'mm' | 'in' | 'ratio',
    ): CropTarget => ({
      formatId,
      width,
      height,
      output: 'source',
      unit,
      outputMode: 'aspect-only',
    });

    const epubTarget = fixedTarget('epub', this.baseTarget.width, this.baseTarget.height);

    return [
      { id: 'epub', label: 'Kindle', target: epubTarget },
      {
        id: 'kobo',
        label: 'Kobo',
        target: fixedTarget('kobo', 1072, 1448),
      },
      {
        id: 'ridi-1600x2560',
        label: '1600 × 2560 px',
        target: fixedTarget('ridi-1600x2560', 1600, 2560),
      },
      {
        id: 'ridi-1200x1800',
        label: '1200 × 1800 px',
        target: fixedTarget('ridi-1200x1800', 1200, 1800),
      },
      {
        id: 'a3',
        label: 'A3',
        target: aspectTarget('a3', 297, 420, 'mm'),
      },
      {
        id: 'a4',
        label: 'A4',
        target: aspectTarget('a4', 210, 297, 'mm'),
      },
      {
        id: 'a5',
        label: 'A5',
        target: aspectTarget('a5', 148, 210, 'mm'),
      },
      {
        id: 'a6',
        label: 'A6',
        target: aspectTarget('a6', 105, 148, 'mm'),
      },
      {
        id: 'letter',
        label: 'Letter',
        target: aspectTarget('letter', 8.5, 11, 'in'),
      },
      {
        id: 'legal',
        label: 'Legal',
        target: aspectTarget('legal', 8.5, 14, 'in'),
      },
      {
        id: 'tabloid',
        label: 'Tabloid',
        target: aspectTarget('tabloid', 11, 17, 'in'),
      },
      {
        id: 'one_one',
        label: '1:1',
        target: aspectTarget('one_one', 1, 1, 'ratio'),
      },
      {
        id: 'two_three',
        label: '2:3',
        target: aspectTarget('two_three', 2, 3, 'ratio'),
      },
      {
        id: 'three_four',
        label: '3:4',
        target: aspectTarget('three_four', 3, 4, 'ratio'),
      },
      {
        id: 'four_five',
        label: '4:5',
        target: aspectTarget('four_five', 4, 5, 'ratio'),
      },
      {
        id: 'five_seven',
        label: '5:7',
        target: aspectTarget('five_seven', 5, 7, 'ratio'),
      },
      {
        id: 'nine_sixteen',
        label: '9:16',
        target: aspectTarget('nine_sixteen', 9, 16, 'ratio'),
      },
      {
        id: 'sixteen_nine',
        label: '16:9',
        target: aspectTarget('sixteen_nine', 16, 9, 'ratio'),
      },
    ];
  }

  private buildCropTargetsConfig(): CropTargetsConfig {
    const selectedCategory =
      this.persistedCropTargetCategory ??
      this.resolveCropTargetCategory(this.persistedCropTargetId);

    return {
      activeCategory: selectedCategory,
      publishing: {
        catalog: [
          this.publishingGroup('amazon-kdp', 'AMAZON_KDP', 'store-cover', 'STORE_COVER', [
            this.publishingPreset('amazon-kdp-1600x2560', 'AMAZON_KDP_1600X2560', 1600, 2560, 'ideal', 'external', 'official', ['image/jpeg', 'image/tiff']),
            this.publishingPreset('amazon-kdp-625x1000', 'AMAZON_KDP_625X1000', 625, 1000, 'minimum', 'external', 'official', ['image/jpeg', 'image/tiff']),
          ]),
          this.publishingGroup('kobo-writing-life', 'KOBO_WRITING_LIFE', 'ebook-cover', 'EBOOK_COVER', [
            this.publishingPreset('kobo-writing-life-1800x2400', 'KOBO_WRITING_LIFE_1800X2400', 1800, 2400, 'recommended', 'both', 'derived-from-official', ['image/jpeg', 'image/png']),
          ]),
          this.publishingGroup('apple-books', 'APPLE_BOOKS', 'ebook-and-store-cover', 'EBOOK_AND_STORE_COVER', [
            this.publishingPreset('apple-books-1600x2400', 'APPLE_BOOKS_1600X2400', 1600, 2400, 'compatible', 'both', 'derived-from-official', ['image/jpeg', 'image/png']),
          ]),
          this.publishingGroup('google-play-books', 'GOOGLE_PLAY_BOOKS', 'ebook-and-store-cover', 'EBOOK_AND_STORE_COVER', [
            this.publishingPreset('google-play-books-1600x2400', 'GOOGLE_PLAY_BOOKS_1600X2400', 1600, 2400, 'compatible', 'both', 'derived-from-official', ['image/jpeg', 'image/png']),
          ]),
          this.publishingGroup('barnes-noble-press', 'BARNES_NOBLE_PRESS', 'ebook-cover', 'EBOOK_COVER', [
            this.publishingPreset('barnes-noble-press-1600x2400', 'BARNES_NOBLE_PRESS_1600X2400', 1600, 2400, 'compatible', 'embedded', 'derived-from-official', ['image/jpeg', 'image/png']),
          ]),
          this.publishingGroup('tolino-media', 'TOLINO_MEDIA', 'ebook-and-store-cover', 'EBOOK_AND_STORE_COVER', [
            this.publishingPreset('tolino-media-1600x2400', 'TOLINO_MEDIA_1600X2400', 1600, 2400, 'recommended', 'both', 'official', ['image/jpeg']),
          ]),
          this.publishingGroup('ridi', 'RIDI', 'ebook-cover', 'EBOOK_COVER', [
            this.publishingPreset('ridi-1600x2560', 'RIDI_1600X2560', 1600, 2560, 'recommended', 'embedded', 'user-reported', ['image/jpeg', 'image/png']),
            this.publishingPreset('ridi-1200x1800', 'RIDI_1200X1800', 1200, 1800, 'alternative', 'embedded', 'user-reported', ['image/jpeg', 'image/png']),
          ]),
          this.publishingGroup('draft2digital', 'DRAFT2DIGITAL', 'distribution-cover', 'DISTRIBUTION_COVER', [
            this.publishingPreset('draft2digital-1600x2400', 'DRAFT2DIGITAL_1600X2400', 1600, 2400, 'recommended', 'external', 'official', ['image/jpeg']),
          ]),
          this.publishingGroup('ingramspark', 'INGRAMSPARK', 'store-cover', 'STORE_COVER', [
            this.publishingPreset('ingramspark-1600x2560', 'INGRAMSPARK_1600X2560', 1600, 2560, 'recommended', 'external', 'official', ['image/jpeg']),
          ]),
          this.publishingGroup('publishdrive', 'PUBLISHDRIVE', 'embedded-cover', 'EMBEDDED_COVER', [
            this.publishingPreset('publishdrive-embedded-1600x2400', 'PUBLISHDRIVE_EMBEDDED_1600X2400', 1600, 2400, 'recommended', 'embedded', 'official', ['image/jpeg', 'image/png']),
          ]),
          this.publishingGroup('publishdrive', 'PUBLISHDRIVE', 'store-cover', 'STORE_COVER', [
            this.publishingPreset('publishdrive-store-1600x2560', 'PUBLISHDRIVE_STORE_1600X2560', 1600, 2560, 'recommended', 'external', 'official', ['image/jpeg', 'image/png']),
          ]),
          this.publishingGroup('streetlib', 'STREETLIB', 'embedded-cover', 'EMBEDDED_COVER', [
            this.publishingPreset('streetlib-embedded-1200x1600', 'STREETLIB_EMBEDDED_1200X1600', 1200, 1600, 'recommended', 'embedded', 'official', ['image/jpeg']),
          ]),
          this.publishingGroup('streetlib', 'STREETLIB', 'external-cover', 'EXTERNAL_COVER', [
            this.publishingPreset('streetlib-external-1875x2500', 'STREETLIB_EXTERNAL_1875X2500', 1875, 2500, 'recommended', 'external', 'official', ['image/jpeg']),
          ]),
          this.publishingGroup('lulu', 'LULU', 'ebook-cover', 'EBOOK_COVER', [
            this.publishingPreset('lulu-1600x2560', 'LULU_1600X2560', 1600, 2560, 'recommended', 'embedded', 'official', ['image/jpeg', 'image/png']),
            this.publishingPreset('lulu-625x1000', 'LULU_625X1000', 625, 1000, 'minimum', 'embedded', 'official', ['image/jpeg', 'image/png']),
          ]),
        ],
        selectedParentId: 'ridi',
        selectedGroupId: 'ridi-ebook-cover',
        supportsOrientation: false,
      },
      paper: {
        catalog: [
          {
            parentId: 'iso-216',
            parentI18nKey: 'PAPER_GROUPS.ISO_216',
            id: 'a-series',
            i18nKey: 'PAPER_GROUPS.ISO_A_SERIES',
            items: [
              this.paperPreset('a3', 'PAPER_PRESETS.A3', 297, 420, 'mm'),
              this.paperPreset('a4', 'PAPER_PRESETS.A4', 210, 297, 'mm'),
              this.paperPreset('a5', 'PAPER_PRESETS.A5', 148, 210, 'mm'),
              this.paperPreset('a6', 'PAPER_PRESETS.A6', 105, 148, 'mm'),
            ],
          },
          {
            parentId: 'north-american',
            parentI18nKey: 'PAPER_GROUPS.NORTH_AMERICAN',
            id: 'office',
            i18nKey: 'PAPER_GROUPS.NORTH_AMERICAN_OFFICE',
            items: [
              this.paperPreset('letter', 'PAPER_PRESETS.LETTER', 8.5, 11, 'in'),
              this.paperPreset('legal', 'PAPER_PRESETS.LEGAL', 8.5, 14, 'in'),
              this.paperPreset('tabloid', 'PAPER_PRESETS.TABLOID', 11, 17, 'in'),
            ],
          },
        ],
        selectedParentId: 'iso-216',
        selectedGroupId: 'a-series',
        supportsOrientation: true,
        defaultOrientation: this.persistedCropTargetOrientation ?? 'portrait',
      },
      ratio: {
        catalog: [
          {
            parentId: 'common',
            parentI18nKey: 'RATIO_GROUPS.COMMON',
            id: 'common-ratios',
            i18nKey: 'RATIO_GROUPS.COMMON',
            items: [
              this.ratioPreset('one_one', 'RATIO_PRESETS.1_1', 1, 1),
              this.ratioPreset('four_five', 'RATIO_PRESETS.4_5', 4, 5),
              this.ratioPreset('three_four', 'RATIO_PRESETS.3_4', 3, 4),
              this.ratioPreset('five_seven', 'RATIO_PRESETS.5_7', 5, 7),
              this.ratioPreset('two_three', 'RATIO_PRESETS.2_3', 2, 3),
              this.ratioPreset('five_eight', 'RATIO_PRESETS.5_8', 5, 8),
              this.ratioPreset('nine_sixteen', 'RATIO_PRESETS.9_16', 9, 16),
              this.ratioPreset('sixteen_nine', 'RATIO_PRESETS.16_9', 16, 9),
              this.ratioPreset('custom_ratio', 'RATIO_PRESETS.CUSTOM', 1, 1),
            ],
          },
        ],
        selectedParentId: 'common',
        selectedGroupId: 'common-ratios',
        supportsOrientation: true,
        defaultOrientation: this.persistedCropTargetOrientation ?? 'portrait',
      },
    };
  }

  private publishingGroup(
    parentId: string,
    platformKey: string,
    id: string,
    groupKey: string,
    items: PublishingCropPreset[],
  ): CropTargetGroup {
    return {
      parentId,
      parentI18nKey: `PUBLISHING_CATALOG.PLATFORMS.${platformKey}`,
      id: `${parentId}-${id}`,
      i18nKey: `PUBLISHING_CATALOG.GROUPS.${groupKey}`,
      items,
    };
  }

  private publishingPreset(
    id: string,
    presetKey: string,
    width: number,
    height: number,
    badge: PublishingCropPreset['badge'],
    coverUsage: PublishingCropPreset['coverUsage'],
    evidence: PublishingCropPreset['evidence'],
    acceptedMimeTypes: PublishingCropPreset['acceptedMimeTypes'],
  ): PublishingCropPreset {
    return {
      id,
      i18nKey: `PUBLISHING_CATALOG.PRESETS.${presetKey}`,
      width,
      height,
      unit: 'px',
      outputMode: 'fixed-size',
      badgeI18nKey: `PUBLISHING_CATALOG.BADGES.${badge.toUpperCase()}`,
      coverUsage,
      evidence,
      badge,
      acceptedMimeTypes,
    };
  }

  private paperPreset(
    id: string,
    i18nKey: string,
    width: number,
    height: number,
    unit: 'mm' | 'in',
  ): CropTargetPreset {
    return { id, i18nKey, width, height, unit, outputMode: 'aspect-only' };
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
      id &&
      ChangePage.PUBLISHING_PRESET_PREFIXES.some((prefix) => id.startsWith(prefix))
    ) {
      return 'publishing';
    }
    if (['a3', 'a4', 'a5', 'a6', 'letter', 'legal', 'tabloid'].includes(id ?? '')) {
      return 'paper';
    }
    if (['one_one', 'two_three', 'three_four', 'four_five', 'five_seven', 'five_eight', 'nine_sixteen', 'sixteen_nine', 'custom_ratio'].includes(id ?? '')) {
      return 'ratio';
    }
    return 'e-reader';
  }

  // EPUB handling methods
  openEpubPicker() {
    if (this.usesNativeRewrite()) {
      void this.pickNativeEpub();
      return;
    }
    this.epubInput.nativeElement.click();
  }

  async onEpubSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await this.runInZone(async () => {
      this.resetEpubLoadProgress();
      this.setBusy('epub', 'CHANGE.LOADING_EPUB');

      try {
        await this.resetWorkflowForNewEpub();

        const validation = this.fileService.validateEpub(
          file,
          this.maxEpubSizeMB,
        );
        if (!validation.valid) {
          this.failEpub(validation.errorKey!, file);
          return;
        }

        let cycle: Awaited<ReturnType<EpubWorkingCopyService['startCycle']>>;
        try {
          cycle = await this.workingCopy.startCycle(file);
        } catch (error) {
          this.failEpub('EPUB_ERROR_CORRUPT', file);
          return;
        }
        this.sourceEpubFile = file;
        this.sourceEpubUri = undefined;
        this.sourceEpubUriPermissionPersisted = false;
        this.sourceEpubMeta = cycle.sourceMeta;
        this.workingEpubFile = cycle.workingFile;
        this.workingEpubPath = cycle.workingPath;
        this.workingEpubName = cycle.workingName;
        this.outputBaseName = cycle.outputBaseName;
        this.selectedEpubName = file.name;

        const hasValidStructure = await this.fileService.validateEpubStructure(
          this.workingEpubFile,
        );
        if (!hasValidStructure) {
          this.failEpub('EPUB_ERROR_CORRUPT', file);
          await this.cleanupWorkingCopy();
          return;
        }

        const strictCover =
          await this.candidateImageService.resolveStrictCover({
            epubFile: this.workingEpubFile,
            epubName: this.selectedEpubName,
          });
        console.info('[ECC_BEST_CANDIDATE] strict cover found:', !!strictCover);
        this.clearEpubError();

        if (!strictCover) {
          console.info(
            '[ECC_BEST_CANDIDATE] valid cover not found, fallback to candidate picker',
          );
          await this.activateBestCandidateFallback();
          await this.homeTour.completeInteraction('epub-selected');
          return;
        }

        this.coverEntryPath = strictCover.sourcePath;
        const coverLoaded = await this.applyImageSource(strictCover.file, false);
        if (!coverLoaded) {
          await this.activateBestCandidateFallback();
          await this.homeTour.completeInteraction('epub-selected');
          return;
        }
        this.workflowStep = 1;
        await this.homeTour.completeInteraction('epub-selected');
      } finally {
        this.resetEpubLoadProgress();
        await this.clearBusyUi();
        input.value = '';
      }
    });
  }

  private async pickNativeEpub() {
    await this.runInZone(async () => {
      this.resetEpubLoadProgress();
      this.setBusy('epub', 'CHANGE.LOADING_EPUB');
      this.epubLoadStage = 'copy';
      this.epubLoadProgressPercent = 0;

      try {
        const prepared = await this.epubRewrite.pickAndPrepareEpub({
          maxBytes: this.maxEpubSizeMB * 1024 * 1024,
          requireCover: false,
          includeCoverPreview: true,
        });
        await this.applyPreparedNativeEpub(prepared);
      } catch (error) {
        if (
          error instanceof EpubRewriteError &&
          error.code === 'PICK_CANCELLED'
        ) {
          return;
        }

        if (
          error instanceof EpubRewriteError &&
          error.code === 'EXTRACT_READ_FAILED' &&
          !!error.details?.coverEntryPath
        ) {
          this.clearEpubError();
          await this.activateBestCandidateFallback();
          return;
        }

        this.maybeDisableNativeRewriteForSession(error, 'pick_epub');

        const mappedErrorKey = this.mapNativeEpubError(error);
        this.failEpub(
          mappedErrorKey,
          this.sourceEpubMeta,
          this.buildNativeStorageErrorParams(error),
        );
        await this.cleanupWorkingCopy();
      } finally {
        this.resetEpubLoadProgress();
        await this.clearBusyUi();
      }
    });
  }

  private async applyPreparedNativeEpub(
    prepared: Awaited<ReturnType<EpubRewriteService['pickAndPrepareEpub']>>,
  ): Promise<void> {
    await this.resetWorkflowForNewEpub();
    this.epubLoadStage = 'inspect';
    this.epubLoadProgressPercent = 92;

    this.sourceEpubFile = undefined;
    this.sourceEpubUri = prepared.sourceUri;
    this.sourceEpubUriPermissionPersisted =
      prepared.sourceUriPermissionPersisted === true;
    this.sourceEpubMeta = {
      name: prepared.selectedName,
      size: prepared.sourceSize,
      lastModified: prepared.sourceLastModified,
      type: prepared.sourceMimeType,
    };
    this.workingEpubFile = undefined;
    this.workingEpubPath = prepared.workingPath;
    this.workingEpubNativePath = prepared.workingNativePath;
    this.workingEpubName = prepared.workingName;
    this.outputBaseName = prepared.outputBaseName;
    this.selectedEpubName = prepared.selectedName;
    this.coverEntryPath = undefined;
    this.clearEpubError();

    const strictCover = prepared.file && prepared.coverEntryPath
      ? {
          file: prepared.file,
          sourcePath: prepared.coverEntryPath,
        }
      : await this.candidateImageService.resolveStrictCover({
          epubNativePath: this.workingEpubNativePath,
          epubName: this.selectedEpubName,
        });
    console.info('[ECC_BEST_CANDIDATE] strict cover found:', !!strictCover);

    if (!strictCover) {
      console.info(
        '[ECC_BEST_CANDIDATE] valid cover not found, fallback to candidate picker',
      );
      await this.activateBestCandidateFallback();
      this.epubLoadProgressPercent = 100;
      await this.homeTour.completeInteraction('epub-selected');
      void this.persistRecoveryState('native-epub-selected-no-cover');
      return;
    }

    try {
      this.coverEntryPath = strictCover.sourcePath;
      const coverLoaded = await this.applyImageSource(strictCover.file, false);
      if (!coverLoaded) {
        await this.activateBestCandidateFallback();
        await this.homeTour.completeInteraction('epub-selected');
        return;
      }
      this.workflowStep = 1;
      this.epubLoadProgressPercent = 100;
      await this.homeTour.completeInteraction('epub-selected');
    } catch {
      await this.activateBestCandidateFallback();
      await this.homeTour.completeInteraction('epub-selected');
    }
    void this.persistRecoveryState('native-epub-selected');
  }

  private failEpub(
    errorKey: string,
    file?: { name?: string },
    extraParams: Record<string, unknown> = {},
  ) {
    this.zone.run(() => {
      this.epubErrorKey = `CHANGE.${errorKey}`;
      this.epubErrorParams = {
        maxSize: String(this.maxEpubSizeMB),
        name: file?.name || '',
        ...extraParams,
      };
      this.sourceEpubFile = undefined;
      this.sourceEpubUri = undefined;
      this.sourceEpubUriPermissionPersisted = false;
      this.sourceEpubMeta = undefined;
      this.workingEpubFile = undefined;
      this.workingEpubPath = undefined;
      this.workingEpubNativePath = undefined;
      this.workingEpubName = undefined;
      this.coverEntryPath = undefined;
      this.outputBaseName = undefined;
      this.selectedEpubName = undefined;
    });
  }

  private clearEpubError() {
    this.zone.run(() => {
      this.epubErrorKey = undefined;
      this.epubErrorParams = {};
    });
  }

  hasValidEpub(): boolean {
    return (
      !!(this.workingEpubFile || this.workingEpubNativePath) &&
      !this.epubErrorKey
    );
  }

  private resetEpubLoadProgress() {
    this.epubLoadProgressPercent = 0;
    this.epubLoadStage = null;
  }

  private resetWorkflow() {
    this.workflowStep = 0;
    this.selectedFormatId = this.persistedCropTargetId;
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
    this.revokeOriginalEpubPreviewUrl();
    this.currentPreviewOrigin = null;
    this.clearImageError();
    this.clearImageWarn();
    this.resetBestCandidateState(true);

    // Clear generation state
    this.generatedEpubBytes = undefined;
    this.generatedEpubPath = undefined;
    this.generatedEpubNativePath = undefined;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;
    this.rewriteProgressPercent = 0;
    this.isNativeRewriteInProgress = false;
    this.isCancellingNativeRewrite = false;

    this.clearEpubError();
  }

  private async resetWorkflowForNewEpub(waitForCleanup = true) {
    this.lifecycle.log('ChangePage.resetWorkflowForNewEpub', {
      waitForCleanup,
      route: this.router.url,
    });
    const cleanupPromise = this.cleanupWorkingCopy();
    this.resetWorkflow();
    this.lastEditorSessionId = undefined;
    this.editorSession.clearSessions();
    this.projectSaveState.clear();
    this.sourceEpubFile = undefined;
    this.sourceEpubMeta = undefined;
    this.workingEpubFile = undefined;
    this.workingEpubPath = undefined;
    this.workingEpubNativePath = undefined;
    this.workingEpubName = undefined;
    this.coverEntryPath = undefined;
    this.outputBaseName = undefined;
    this.selectedEpubName = undefined;
    this.sourceEpubUri = undefined;
    this.sourceEpubUriPermissionPersisted = false;
    this.workingMaxSideApplied = null;
    if (waitForCleanup) {
      await cleanupPromise;
      await this.recovery.clear();
      return;
    }

    void cleanupPromise.catch(() => undefined);
    void this.recovery.clear().catch(() => undefined);
  }

  private async cleanupWorkingCopy() {
    const paths = [this.generatedEpubPath, this.workingEpubPath].filter(
      (path): path is string => !!path,
    );
    this.lifecycle.log('ChangePage.cleanupWorkingCopy', { paths });

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
    if (!this.hasValidEpub() || this.bestCandidateLoading) return;

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
          epubFile: this.workingEpubFile,
          epubNativePath: this.workingEpubNativePath,
          epubName: this.selectedEpubName,
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
    } catch (error) {
      console.warn('[ECC_BEST_CANDIDATE] detection failed', error);
      this.bestCandidates = [];
    } finally {
      this.bestCandidateLoading = false;
    }
  }

  async onBestCandidateSelected(candidate: BestCandidateImage): Promise<void> {
    if (this.bestCandidateLoading || !this.hasValidEpub()) return;
    const file = this.candidateFileFromMetadata(candidate);
    if (!file) return;

    const loaded = await this.applyImageSource(file, true);
    if (!loaded) return;

    // A best-candidate image is only the source selected by the user. It is
    // not an EPUB cover entry unless strict cover resolution found it through
    // the OPF. Keeping this unset makes the native rewrite insert a new
    // cover-image manifest entry instead of replacing an unrelated image.
    this.coverEntryPath = undefined;
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
      this.setOriginalEpubPreviewUrl(source);
      this.currentPreviewOrigin = 'source-epub';
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
    void this.persistRecoveryState('image-source-applied');

    return true;
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
      this.hasValidEpub() &&
      !!(this.editorSourceFile ?? this.workingImageFile) &&
      !this.imageErrorKey
    );
  }

  hasCurrentEpubCover(): boolean {
    return (
      !!this.originalEpubPreviewUrl &&
      this.canCrop()
    );
  }

  async onCurrentCoverSelected(): Promise<void> {
    if (!this.hasCurrentEpubCover()) return;
    this.editorOpenedFromCurrentCover = true;
    await this.homeTour.completeInteraction('cover-image-selected');
    await this.openEditor('image');
  }

  canStartScratch(): boolean {
    return this.hasValidEpub() && !this.isPickingImage && !this.isExporting;
  }

  async onStartScratch(): Promise<void> {
    if (!this.canStartScratch()) return;
    this.editorOpenedFromCurrentCover = false;
    this.clearImageError();
    this.clearImageWarn();
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

    if (sourceMode === 'scratch') {
      this.editorOpenedFromCurrentCover = false;
    }

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
          options: this.formatOptions,
          selectedId: selected.id,
        },
        cropTargets: this.buildCropTargetsConfig(),
        kindle: this.buildKindleToolsConfig(selected),
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
        await this.persistEditorEReaderSelection(sid);
        await this.persistEditorCropTargetSelection(sid);
        await this.applyCropResult(result);
        const appliedSessionId = this.lastEditorSessionId;
        if (appliedSessionId) this.editorSession.consumeResult(appliedSessionId);
        this.lastEditorSessionId = undefined;
      },
    });

    this.lastEditorSourceMode = sourceMode;
    this.lastEditorSessionId = sid;
    this.workflowStep = 2;
    void this.persistRecoveryState('editor-opened');
    await this.homeTour.completeInteraction('editor-apply');

    const entryPath = sourceMode === 'scratch' ? '/editor/tools' : '/editor';
    this.router.navigate([entryPath], {
      queryParams: {
        sid,
      },
    });
  }

  private getSelectedFormatOption(): CropFormatOption | null {
    if (!this.formatOptions.length) return null;
    const selected =
      this.formatOptions.find((opt) => opt.id === this.selectedFormatId) ??
      this.formatOptions[0];
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
    this.editorOpenedFromCurrentCover = false;
    this.workflowStep = 3;
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
      this.selectedFormatId = result.formatId;
    }
    const selected = this.getSelectedFormatOption();
    if (selected?.id && selected.id !== this.persistedCropTargetId) {
      await this.persistCropTargetId(selected.id);
    }
    const outW =
      selected?.target.output === 'source'
        ? result.renderedWidth ?? selected.target.width
        : selected?.target.width;
    const outH =
      selected?.target.output === 'source'
        ? result.renderedHeight ?? selected.target.height
        : selected?.target.height;
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
    this.resetBestCandidateState(true);

    this.workingImageFile = newFile;
    this.exportImageFile = undefined;
    this.renderedImageFile = undefined;
    this.renderedImageBlob = undefined;
    this.renderedImageInfo = undefined;

    this.cleanupGeneratedTempOutput();
    this.generatedEpubBytes = undefined;
    this.generatedEpubPath = undefined;
    this.generatedEpubNativePath = undefined;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;

    this.selectedImageName = newFile.name;
    const dims = await this.imagePipe.getDimensions(newFile);
    if (!dims) return this.failImage('CORRUPT', newFile);
    this.workingImageDims = dims;

    try {
      if (!renderedBlob) {
        console.warn('[ECC] editor result missing renderedBlob; skipping preview fallback');
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
      void this.persistRecoveryState('editor-result-applied');
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
      '.epub',
      this.lastSavedFilename,
      this.generatedEpubFilename,
      'epub_cover',
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
      const newFilename = this.ensureEpubExtension(data);
      await this.performSave(newFilename);
    }
  }

  private ensureEpubExtension(name: string): string {
    return /\.epub$/i.test(name) ? name : `${name}.epub`;
  }

  private async performSave(filename: string) {
    this.setBusy('export', 'CHANGE.SAVING');
    try {
      const requestedFilename = this.ensureEpubExtension(filename);
      const isRename = !!this.lastSavedFilename;

      const isProjectEditSave =
        this.projectSaveState.isCurrentFilename(requestedFilename);

      if (isProjectEditSave) {
        const exportFile = await this.ensureExportImageFile();
        if (!exportFile) return;

        const saved = this.usesNativeRewrite()
          ? this.generatedEpubPath
            ? await this.fileService.saveGeneratedEpubFromPath({
                sourcePath: this.generatedEpubPath,
                sourceDir: 'Data',
                filename: this.projectSaveState.getCurrentFilename()!,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
                overwriteExisting: true,
              })
            : await this.fileService.saveGeneratedEpubFromExistingDocument({
                sourceFilename: this.projectSaveState.getCurrentFilename()!,
                filename: this.projectSaveState.getCurrentFilename()!,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
                overwriteExisting: true,
              })
              : await this.fileService.saveGeneratedEpub({
                bytes: this.generatedEpubBytes!,
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

        this.generatedEpubFilename = saved.filename;
        this.lastSavedFilename = saved.filename;
        this.projectSaveState.setCurrentFilename(saved.filename);
        this.wasAutoSaved = false;

        try {
          await this.saveLocalProjectSnapshot(saved.filename, exportFile);
        } catch (error) {
          console.warn('[ECC:change] project snapshot save failed', error);
        }

        this.coversEvents.emit({
          type: 'saved',
          filename: saved.filename,
        });
        this.activateSavedProject(saved.filename);
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

          this.generatedEpubFilename = requestedFilename;
          this.lastSavedFilename = requestedFilename;
          this.projectSaveState.setCurrentFilename(requestedFilename);
          this.wasAutoSaved = true;

          try {
            await this.saveLocalProjectSnapshot(
              requestedFilename,
              exportFile,
            );
          } catch (error) {
            console.warn('[ECC:change] project snapshot save failed', error);
          }

          this.coversEvents.emit({
            type: 'saved',
            filename: requestedFilename,
          });
          this.activateSavedProject(requestedFilename);
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
          const renamed = await this.fileService.renameGeneratedEpub({
            from: staleFilename,
            to: requestedFilename,
          });
          this.generatedEpubFilename = renamed.filename;
          this.lastSavedFilename = renamed.filename;
          this.projectSaveState.setCurrentFilename(renamed.filename);
          this.wasAutoSaved = false;
          try {
            await this.saveLocalProjectSnapshot(renamed.filename, exportFile);
          } catch (error) {
            console.warn('[ECC:change] project snapshot save failed', error);
          }
          this.activateSavedProject(renamed.filename);
        } catch {
          const saved = this.usesNativeRewrite()
            ? this.generatedEpubPath
              ? await this.fileService.saveGeneratedEpubFromPath({
                  sourcePath: this.generatedEpubPath,
                  sourceDir: 'Data',
                  filename: requestedFilename,
                  coverFileForThumb: exportFile,
                  coverMetadata: this.buildCoverProcessingMetadata(),
                })
              : await this.fileService.saveGeneratedEpubFromExistingDocument({
                  sourceFilename: staleFilename,
                  filename: requestedFilename,
                  coverFileForThumb: exportFile,
                  coverMetadata: this.buildCoverProcessingMetadata(),
                })
            : await this.fileService.saveGeneratedEpub({
                bytes: this.generatedEpubBytes!,
                filename: requestedFilename,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
              });
          if (
            staleFilename &&
            staleFilename.toLowerCase() !== saved.filename.toLowerCase()
          ) {
            try {
              await this.fileService.deleteGeneratedEpub(staleFilename);
            } catch {
              // ignore missing stale filename
            }
          }
          this.logSaveFlow('finalWriteComplete', {
            flow: 'performSave',
            filename: saved.filename,
            writeCompletedAt: new Date().toISOString(),
          });
          this.generatedEpubFilename = saved.filename;
          this.lastSavedFilename = saved.filename;
          this.projectSaveState.setCurrentFilename(saved.filename);
          this.activateSavedProject(saved.filename);
        }
      } else {
        const uniqueFilename =
          await this.resolveUniqueEpubFilename(requestedFilename);
        const saved =
          this.usesNativeRewrite() && this.generatedEpubPath
            ? await this.fileService.saveGeneratedEpubFromPath({
                sourcePath: this.generatedEpubPath,
                sourceDir: 'Data',
                filename: uniqueFilename,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
              })
            : await this.fileService.saveGeneratedEpub({
                bytes: this.generatedEpubBytes!,
                filename: uniqueFilename,
                coverFileForThumb: exportFile,
                coverMetadata: this.buildCoverProcessingMetadata(),
              });
        this.logSaveFlow('finalWriteComplete', {
          flow: 'performSave',
          filename: saved.filename,
          writeCompletedAt: new Date().toISOString(),
        });
        this.generatedEpubFilename = saved.filename;
        this.lastSavedFilename = saved.filename;
        this.projectSaveState.setCurrentFilename(saved.filename);
        this.activateSavedProject(saved.filename);
      }

      this.coversEvents.emit({
        type: 'saved',
        filename: this.generatedEpubFilename,
      });
      this.activateSavedProject(this.generatedEpubFilename);
      this.logSaveFlow('savedEventEmitted', {
        flow: 'performSave',
        filename: this.generatedEpubFilename,
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
    } else if (this.usesNativeRewrite() && this.generatedEpubPath) {
      await this.fileService.shareGeneratedEpubFromPath({
        sourcePath: this.generatedEpubPath,
        sourceDir: 'Data',
        filename: this.generatedEpubFilename!,
        title: 'EPUB Cover',
      });
    } else {
      await this.fileService.shareGeneratedEpub({
        bytes: this.generatedEpubBytes!,
        filename: this.generatedEpubFilename!,
        title: 'EPUB Cover',
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
    this.generatedEpubBytes = undefined;
    this.generatedEpubPath = undefined;
    this.generatedEpubNativePath = undefined;
    this.wasAutoSaved = false;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;

    this.revokePreviewUrl();
    this.previewThumbUrl = undefined;
    this.workingMaxSideApplied = null;
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

  private setOriginalEpubPreviewUrl(file: File): void {
    const url = URL.createObjectURL(file);
    this.revokeOriginalEpubPreviewUrl();
    this.originalEpubPreviewUrl = url;
  }

  private revokeOriginalEpubPreviewUrl(): void {
    if (!this.originalEpubPreviewUrl) {
      return;
    }
    URL.revokeObjectURL(this.originalEpubPreviewUrl);
    this.originalEpubPreviewUrl = null;
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
    return this.coverEntryExtension();
  }

  private nativeRewriteTargetMimeType(): string | null {
    const ext = this.nativeRewriteTargetExtension();
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'jpg') return 'image/jpeg';
    return null;
  }

  private nativeRewriteTargetCoverEntryPath(): string | null {
    if (!this.coverEntryPath) return null;
    const targetExt = this.nativeRewriteTargetExtension();
    if (!targetExt) return this.coverEntryPath;
    return this.renameFileExtension(this.coverEntryPath, targetExt);
  }

  private coverEntryExtension(): 'jpg' | 'png' | 'webp' | null {
    const ext = (this.coverEntryPath?.split('.').pop() || '').toLowerCase();
    if (ext === 'png') return 'png';
    if (ext === 'webp') return 'webp';
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
    return null;
  }

  private coverEntryMimeType(): string | null {
    const ext = this.coverEntryExtension();
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
    const path = this.generatedEpubPath;
    if (!path || path === this.workingEpubPath) return;
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
    this.clearImageError();
    this.imageWarnKey = this.invalidCoverWarnKey;
    this.imageWarnParams = {};
    this.homeTour.requestSync();
    this.resetBestCandidateState(true);
  }

  private async activateBestCandidateFallback(): Promise<void> {
    this.activateInvalidCoverFallback();
    await this.detectCoverAutomatically();
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
      app: 'ecc',
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
      return false;
    }

    try {
      await this.dismissActiveTourForBlockingModal();
      const remaining = this.resolveAdFallbackRemaining();
      const decision = await adFallback.handleAdFailure(
        {
          app: this.adFallbackApp,
          reason: this.normalizeFailureReason(result.failureReason),
          confidence: this.normalizeFailureConfidence(result.failureConfidence),
          remaining,
          total: this.adFallbackTotal,
          countdownSeconds: 5,
        },
        this.modalCtrl,
      );

      if (decision === 'accepted') {
        this.adFallbackTrialActive = true;
        await this.persistAdFallbackState();
        return true;
      }

      return false;
    } catch {
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
      const decision = await adFallback.handleAdFailure(
        {
          app: this.adFallbackApp,
          reason: 'unknown',
          confidence: 'low',
          remaining,
          total: this.adFallbackTotal,
          countdownSeconds: 5,
        },
        this.modalCtrl,
      );

      return decision === 'accepted';
    } catch {
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
      `[ECC:ad-fallback] consumed on ${source} ${JSON.stringify({
        remaining: this.adFallbackRemaining,
        total: this.adFallbackTotal,
      })}`,
    );
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

  async openPurchaseModal(): Promise<void> {
    this.logPurchaseUiState('open-before-guard');
    if (!this.canShowRemoveAdsEntryPoint() || this.purchaseBusy) {
      return;
    }

    this.trackRemoveAdsEvent('remove_ads_cta_click', {
      price: this.removeAdsPriceFormatted,
    });

    this.removeAdsPurchasePage.open({
      variant: 'ECC',
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
      ? !!(this.generatedEpubPath || this.lastSavedFilename)
      : !!(this.generatedEpubBytes || this.lastSavedFilename);

    return (
      this.canExport() &&
      hasGeneratedOutput &&
      !!this.generatedEpubFilename &&
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
      void this.persistRecoveryState('export-quality-changed');
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
    void this.persistRecoveryState(`export-quality-normalized:${reason}`);
  }

  shouldShowDitheringHint(): boolean {
    return this.isPreviewDithered();
  }

  async onGenerate() {
    if (!this.canGenerate()) return;
    this.lifecycle.log('ChangePage.onGenerate', {
      workflowStep: this.workflowStep,
      hasEpub: this.hasValidEpub(),
      hasCrop: !!this.cropState,
    });
    this.setBusy('export', 'CHANGE.GENERATING');
    try {
      if (!this.adsRemoved) {
        if (this.adFallbackTrialActive && this.resolveAdFallbackRemaining() > 0) {
          const accepted = await this.confirmActiveAdFallbackTrial();
          if (!accepted) {
            await this.showToast(
              'CHANGE.ADS_REQUIRED',
              { duration: 1800 },
              'error',
            );
            return;
          }
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
          }

          if (adsService) {
            this.lifecycle.log('AdMob.rewarded.requested');
            const result: RewardedAdResult = await adsService.showRewarded();
            this.lifecycle.log('AdMob.rewarded.resolved', result);
            const shouldFallback =
              result.failed || (!result.rewardEarned && !result.adClosed);

            if (shouldFallback) {
              const accepted = await this.openAdFallbackFromFailure(
                result.failed
                  ? result
                  : {
                      rewardEarned: false,
                      adClosed: false,
                      failed: true,
                      failureReason: 'unknown',
                      failureConfidence: 'low',
                    },
              );
              if (!accepted) {
                await this.showToast(
                  'CHANGE.ADS_REQUIRED',
                  { duration: 1800 },
                  'error',
                );
                return;
              }
            } else if (result.adClosed && !result.rewardEarned) {
              await this.showToast(
                'CHANGE.ADS_REQUIRED',
                { duration: 1800 },
                'error',
              );
              return;
            } else if (result.rewardEarned && result.adClosed) {
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
            }
          }
        }
      }

      await this.generateChangedCover();
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

  private async generateChangedCover(): Promise<void> {
    const exportFile = await this.ensureExportImageFile();
    if (!exportFile) return;

    const preferredFilename = this.projectSaveState.getSuggestedBaseName(
      '.epub',
      this.lastSavedFilename,
      this.outputBaseName,
      this.selectedEpubName,
      'epub_cover',
    );

    if (this.usesNativeRewrite()) {
      await this.generateWithNativeRewrite(exportFile, preferredFilename);
      await this.homeTour.completeInteraction('cover-created');
      return;
    }

    const sourceEpub = this.workingEpubFile;
    let res: { bytes: Uint8Array; filename: string };
    if (sourceEpub) {
      try {
        res = await this.fileService.generateEpubBytesFromSource({
          sourceEpubFile: sourceEpub,
          coverFile: exportFile,
          filename: preferredFilename,
        });
      } catch {
        res = await this.fileService.generateEpubBytes({
          modelId: this.baseModelId,
          coverFile: exportFile,
          title: 'EPUB Cover',
        });
      }
    } else {
      res = await this.fileService.generateEpubBytes({
        modelId: this.baseModelId,
        coverFile: exportFile,
        title: 'EPUB Cover',
      });
    }

    this.generatedEpubBytes = res.bytes;
    const overwriteFilename = this.projectSaveState.getOverwriteFilename();
    const overwriteExisting = !!overwriteFilename;
    this.generatedEpubFilename = overwriteFilename
      ? overwriteFilename
      : await this.resolveUniqueEpubFilename(res.filename);
    this.projectSaveState.setCurrentFilename(this.generatedEpubFilename);

    this.setBusy('export', 'CHANGE.SAVING');

    const saved = await this.fileService.saveGeneratedEpub({
      bytes: this.generatedEpubBytes,
      filename: this.generatedEpubFilename,
      coverFileForThumb: exportFile,
      coverMetadata: this.buildCoverProcessingMetadata(),
      overwriteExisting,
    });
    this.logSaveFlow('finalWriteComplete', {
      flow: 'onGenerate',
      filename: saved.filename,
      writeCompletedAt: new Date().toISOString(),
    });

    this.generatedEpubFilename = saved.filename;
    try {
      await this.saveLocalProjectSnapshot(saved.filename, exportFile);
    } catch (error) {
      console.warn('[ECC:change] project snapshot save failed', error);
    }

    this.coversEvents.emit({
      type: 'saved',
      filename: saved.filename,
    });
    this.activateSavedProject(saved.filename);
    this.logSaveFlow('savedEventEmitted', {
      flow: 'onGenerate',
      filename: saved.filename,
      emittedAt: new Date().toISOString(),
    });

    this.wasAutoSaved = true;
    this.lastSavedFilename = saved.filename;
    void this.persistRecoveryState('web-output-saved');

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

  private activateSavedProject(filename: string): void {
    this.activeProjectFilename = filename;
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
    const loaded = await this.fileService.loadProjectByFilename(filename);
    if (!loaded) {
      return false;
    }

    const sourceEpubFile = await this.fileService.loadGeneratedEpubByFilename(
      loaded.snapshot.coverFilename,
    );
    if (!sourceEpubFile) {
      return false;
    }

    await this.resetWorkflowForNewEpub();
    await this.hydrateProjectEpubContext(
      loaded.snapshot.coverFilename,
      sourceEpubFile,
    );
    await this.resolveProjectCoverEntryPath();

    const snapshot = loaded.snapshot;
    const dims =
      this.sourceInfoToDims(snapshot.sourceInfo) ??
      (await this.imagePipe.getDimensions(loaded.sourceFile)) ??
      snapshot.target;
    const matchedFormat = this.formatOptions.find(
      (option) =>
        option.target.width === snapshot.target.width &&
        option.target.height === snapshot.target.height,
    );

    if (matchedFormat) {
      this.selectedFormatId = matchedFormat.id;
    }

    this.originalImageFile = loaded.sourceFile;
    this.selectedImageFile = loaded.sourceFile;
    this.selectedImageName = loaded.sourceFile.name;
    this.originalImageDims = dims;
    this.workingImageDims = dims;
    this.workingImageFile = loaded.sourceFile;
    this.editorSourceFile = loaded.sourceFile;
    this.cropState = snapshot.cropState;
    this.exportImageFile = undefined;
    this.activeProjectFilename =
      editMode === 'overwrite' ? snapshot.coverFilename : undefined;
    this.projectSaveState.setProject(snapshot.coverFilename, editMode);
    this.generatedEpubFilename =
      editMode === 'overwrite' ? snapshot.coverFilename : undefined;
    this.lastSavedFilename =
      editMode === 'overwrite' ? snapshot.coverFilename : undefined;
    this.setPreviewUrl(URL.createObjectURL(loaded.sourceFile));

    this.projectEditReturnUrl = '/tabs/change';
    try {
      await this.openEditor('image');
      return true;
    } finally {
      this.projectEditReturnUrl = null;
    }
  }

  private async hydrateProjectEpubContext(
    filename: string,
    sourceEpubFile: File,
  ): Promise<void> {
    const outputBaseName =
      filename.replace(/\.epub$/i, '').trim() || 'epub_cover';

    if (this.usesNativeRewrite()) {
      const cycle = await this.workingCopy.startStreamingCycle(sourceEpubFile);
      this.sourceEpubFile = sourceEpubFile;
      this.sourceEpubMeta = cycle.sourceMeta;
      this.workingEpubFile = sourceEpubFile;
      this.workingEpubPath = cycle.workingPath;
      this.workingEpubNativePath = cycle.workingNativePath;
      this.workingEpubName = cycle.workingName;
      this.outputBaseName = outputBaseName;
    } else {
      const cycle = await this.workingCopy.startCycle(sourceEpubFile);
      this.sourceEpubFile = sourceEpubFile;
      this.sourceEpubMeta = cycle.sourceMeta;
      this.workingEpubFile = cycle.workingFile;
      this.workingEpubPath = cycle.workingPath;
      this.workingEpubNativePath = undefined;
      this.workingEpubName = cycle.workingName;
      this.outputBaseName = outputBaseName;
    }

    this.selectedEpubName = filename;
    this.coverEntryPath = undefined;
    this.clearEpubError();
  }

  private async resolveProjectCoverEntryPath(): Promise<void> {
    if (!this.selectedEpubName) {
      this.coverEntryPath = undefined;
      return;
    }

    const strictCover = this.workingEpubNativePath
      ? await this.candidateImageService.resolveStrictCover({
          epubNativePath: this.workingEpubNativePath,
          epubName: this.selectedEpubName,
        })
      : this.workingEpubFile
        ? await this.candidateImageService.resolveStrictCover({
            epubFile: this.workingEpubFile,
            epubName: this.selectedEpubName,
          })
        : null;

    this.coverEntryPath = strictCover?.sourcePath;
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

  private async resolveUniqueEpubFilename(
    requestedFilename: string,
  ): Promise<string> {
    const normalized = this.ensureEpubExtension(requestedFilename);
    const base = normalized.replace(/\.epub$/i, '').trim() || 'epub';
    let candidate = `${base}.epub`;
    let index = 1;

    while (await this.fileService.hasCoverByFilename(candidate)) {
      candidate = `${base} (${index}).epub`;
      index += 1;
    }

    return candidate;
  }

  private invalidateGeneratedOutputState(): void {
    this.cleanupGeneratedTempOutput();
    this.generatedEpubBytes = undefined;
    this.generatedEpubPath = undefined;
    this.generatedEpubNativePath = undefined;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;
  }

  async cancelNativeRewrite() {
    if (!this.isNativeRewriteInProgress || this.isCancellingNativeRewrite) {
      return;
    }

    this.isCancellingNativeRewrite = true;
    await this.epubRewrite.cancelRewrite();
  }

  private async generateWithNativeRewrite(
    exportFile: File,
    preferredFilename?: string,
  ) {
    const rewriteStartedAt = Date.now();
    let tempCover:
      | Awaited<ReturnType<EpubWorkingCopyService['writeTempCoverFile']>>
      | undefined;
    let outputTarget:
      | Awaited<ReturnType<FileService['reserveNativeDocumentOutput']>>
      | undefined;

    this.logSaveFlow('nativeRewrite:start', {
      inputPath: this.workingEpubNativePath,
      workingPath: this.workingEpubPath,
      inputFilename: this.workingEpubName,
      inputBytes: exportFile.size,
      requestedFilename: preferredFilename,
      coverEntryPath: this.coverEntryPath,
      startedAt: new Date(rewriteStartedAt).toISOString(),
    });

    try {
      if (!this.workingEpubNativePath || !this.workingEpubPath) {
        throw new EpubRewriteError('REWRITE_UNAVAILABLE', {
          stage: 'preflight',
        });
      }

      const outputBaseName = this.outputBaseName || 'epub';
      const rewriteCoverFile =
        await this.ensureNativeRewriteCoverFile(exportFile);
      this.logSaveFlow('nativeRewrite:coverPrepared', {
        filename: rewriteCoverFile.name,
        mimeType: rewriteCoverFile.type,
        bytes: rewriteCoverFile.size,
      });

      tempCover = await this.workingCopy.writeTempCoverFile(
        rewriteCoverFile,
        outputBaseName,
      );
      this.logSaveFlow('nativeRewrite:tempCoverWritten', {
        path: tempCover.nativePath,
        relativePath: tempCover.path,
        bytes: rewriteCoverFile.size,
      });

      const requestedFilename = this.ensureEpubExtension(
        preferredFilename || `${outputBaseName}.epub`,
      );
      const overwriteExisting = !!this.projectSaveState.getOverwriteFilename();
      outputTarget =
        await this.fileService.reserveNativeDocumentOutput(requestedFilename, {
          overwriteExisting,
        });
      this.logSaveFlow('nativeRewrite:outputReserved', {
        filename: outputTarget.filename,
        relativePath: outputTarget.relativePath,
        publicPath: outputTarget.relativePath,
        rewritePath: outputTarget.rewritePath,
        rewriteNativePath: outputTarget.rewriteNativePath,
        overwriteExisting,
      });

      this.isNativeRewriteInProgress = true;
      this.isCancellingNativeRewrite = false;
      this.rewriteProgressPercent = 0;

      const result = await this.epubRewrite.rewriteCover({
        inputPath: this.workingEpubNativePath,
        outputPath: outputTarget.rewriteNativePath,
        coverEntryPath: this.coverEntryPath,
        newCoverPath: tempCover.nativePath,
        replacementCoverEntryPath:
          this.nativeRewriteTargetCoverEntryPath() ?? undefined,
      });

      this.logSaveFlow('nativeRewrite:pluginResult', {
        success: result.success,
        error: result.error,
        stage: result.stage,
        message: result.message,
        outputPath: result.outputPath,
        coverEntryPath: result.coverEntryPath,
        coverInserted: result.coverInserted,
        requiredBytes: result.requiredBytes,
        availableBytes: result.availableBytes,
        elapsedMs: Date.now() - rewriteStartedAt,
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

        throw new EpubRewriteError(result.error ?? 'REWRITE_FAILED', {
          message: result.message,
          stage: result.stage,
          requiredBytes: result.requiredBytes,
          availableBytes: result.availableBytes,
        });
      }

      if (result.coverEntryPath) {
        this.coverEntryPath = result.coverEntryPath;
      }

      const committedOutput =
        await this.fileService.commitNativeDocumentOutput(outputTarget);

      this.generatedEpubBytes = undefined;
      this.generatedEpubPath = undefined;
      this.generatedEpubNativePath = committedOutput.uri;
      this.generatedEpubFilename = outputTarget.filename;
      this.rewriteProgressPercent = 100;
      this.logSaveFlow('nativeRewrite:commitComplete', {
        filename: outputTarget.filename,
        outputPath: committedOutput.uri,
        rewriteOutputPath: outputTarget.rewriteNativePath,
        bytes: committedOutput.size,
        elapsedMs: Date.now() - rewriteStartedAt,
      });
      this.logSaveFlow('finalWriteComplete', {
        flow: 'nativeRewrite',
        filename: outputTarget.filename,
        outputPath: committedOutput.uri,
        writeCompletedAt: new Date().toISOString(),
        bytes: committedOutput.size,
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
        console.warn('[ECC:change] project snapshot save failed', error);
      }

      this.coversEvents.emit({
        type: 'saved',
        filename: outputTarget.filename,
      });
      this.activateSavedProject(outputTarget.filename);
      this.logSaveFlow('savedEventEmitted', {
        flow: 'nativeRewrite',
        filename: outputTarget.filename,
        emittedAt: new Date().toISOString(),
      });

      this.wasAutoSaved = true;
      this.lastSavedFilename = outputTarget.filename;
      this.projectSaveState.setCurrentFilename(outputTarget.filename);
      void this.persistRecoveryState('native-output-saved');

      await this.showToast(
        'CHANGE.COVER_CHANGED',
        { duration: 2200 },
        'success',
      );
      await this.maybeAskForRatingAfterSuccessfulSave('native');
      await this.consumeAdFallbackAttemptAfterSuccess('generate-native');
    } catch (error) {
      this.logSaveFlow('nativeRewrite:error', {
        ...this.describeNativeRewriteError(error),
        elapsedMs: Date.now() - rewriteStartedAt,
        outputPath: outputTarget?.relativePath,
        outputFilename: outputTarget?.filename,
        rewritePath: outputTarget?.rewritePath,
        rewriteNativePath: outputTarget?.rewriteNativePath,
        tempCoverPath: tempCover?.nativePath,
      });
      this.maybeDisableNativeRewriteForSession(error, 'rewrite_cover');
      if (!(error instanceof EpubRewriteError) || error.code !== 'CANCELLED') {
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
      if (tempCover) {
        try {
          await this.workingCopy.cleanupWorkingCopy(tempCover.path);
          this.logSaveFlow('nativeRewrite:cleanupComplete', {
            tempCoverPath: tempCover.path,
            elapsedMs: Date.now() - rewriteStartedAt,
          });
        } catch (error) {
          this.logSaveFlow('nativeRewrite:cleanupError', {
            ...this.describeNativeRewriteError(error),
            tempCoverPath: tempCover.path,
            elapsedMs: Date.now() - rewriteStartedAt,
          });
        }
      } else {
        this.logSaveFlow('nativeRewrite:cleanupSkipped', {
          reason: 'temp_cover_not_created',
          elapsedMs: Date.now() - rewriteStartedAt,
        });
      }
      if (outputTarget) {
        try {
          await this.fileService.cleanupNativeDocumentOutput(outputTarget);
          this.logSaveFlow('nativeRewrite:outputCleanupComplete', {
            rewritePath: outputTarget.rewritePath,
            elapsedMs: Date.now() - rewriteStartedAt,
          });
        } catch (error) {
          this.logSaveFlow('nativeRewrite:outputCleanupError', {
            ...this.describeNativeRewriteError(error),
            rewritePath: outputTarget.rewritePath,
            elapsedMs: Date.now() - rewriteStartedAt,
          });
        }
      }
    }
  }

  private describeNativeRewriteError(error: unknown): Record<string, unknown> {
    if (error instanceof EpubRewriteError) {
      return {
        errorCode: error.code,
        stage: error.details?.stage,
        message: error.details?.message,
        coverEntryPath: error.details?.coverEntryPath,
        requiredBytes: error.details?.requiredBytes,
        availableBytes: error.details?.availableBytes,
      };
    }

    if (error instanceof Error) {
      return {
        errorName: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return { error: String(error) };
  }

  private usesNativeRewrite(): boolean {
    return (
      Capacitor.getPlatform() === 'android' &&
      this.epubRewrite.isSupported() &&
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
      // The native EPUB plugin uses Java APIs that are riskier on API 24/25.
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
    _stage: 'pick_epub' | 'rewrite_cover',
  ): void {
    if (error instanceof EpubRewriteError) {
      // User/content/storage errors should not permanently disable native in-session.
      if (
        error.code === 'PICK_CANCELLED' ||
        error.code === 'CANCELLED' ||
        error.code === 'EPUB_TOO_LARGE' ||
        error.code === 'NO_SPACE' ||
        error.code === 'NO_COVER' ||
        error.code === 'COVER_NOT_FOUND'
      ) {
        return;
      }
    }

    this.nativeRewriteSessionDisabled = true;
  }

  private mapNativeEpubError(error: unknown): string {
    if (error instanceof EpubRewriteError && error.code === 'EPUB_TOO_LARGE') {
      return 'EPUB_ERROR_SIZE';
    }
    if (error instanceof EpubRewriteError && error.code === 'NO_SPACE') {
      return 'EPUB_ERROR_STORAGE';
    }
    if (error instanceof EpubRewriteError && error.code === 'NO_COVER') {
      return 'EPUB_ERROR_NO_COVER';
    }
    return 'EPUB_ERROR_CORRUPT';
  }

  private mapNativeRewriteToast(error: unknown): {
    key: string;
    params?: Record<string, unknown>;
  } {
    if (
      error instanceof EpubRewriteError &&
      (error.code === 'NO_COVER' || error.code === 'COVER_NOT_FOUND')
    ) {
      return { key: 'CHANGE.EPUB_ERROR_NO_COVER' };
    }

    if (error instanceof EpubRewriteError && error.code === 'NO_SPACE') {
      return {
        key: 'CHANGE.EPUB_ERROR_STORAGE',
        params: this.buildNativeStorageErrorParams(error),
      };
    }

    return { key: 'CHANGE.EPUB_ERROR_REWRITE' };
  }

  private buildNativeStorageErrorParams(
    error: unknown,
  ): Record<string, unknown> {
    if (!(error instanceof EpubRewriteError)) {
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
    return !!this.previewUrl && this.currentPreviewOrigin !== 'source-epub';
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
    this.lifecycle.log('ChangePage.ionViewWillLeave', {
      workflowStep: this.workflowStep,
      route: this.router.url,
    });
    this.closeInfo();
    void this.persistRecoveryState('ionViewWillLeave');
  }

  async ionViewWillEnter() {
    this.lifecycle.log('ChangePage.ionViewWillEnter.before', {
      workflowStep: this.workflowStep,
      hasEpub: this.hasValidEpub(),
      route: this.router.url,
    });
    const openedProject = await this.tryOpenProjectFromRoute();
    const restoredRecovery =
      !openedProject && !this.hasValidEpub()
        ? await this.restoreRecoveryState()
        : false;
    if (!openedProject && !restoredRecovery) {
      await this.consumeEditorResult();
    }
    await this.tryOpenPurchaseFromRoute();
    void this.refreshHeaderItems();
    this.lifecycle.log('ChangePage.ionViewWillEnter.after', {
      openedProject,
      restoredRecovery,
      workflowStep: this.workflowStep,
      hasEpub: this.hasValidEpub(),
      route: this.router.url,
    });
  }

  ionViewDidEnter() {
    this.lifecycle.log('ChangePage.ionViewDidEnter', {
      workflowStep: this.workflowStep,
      hasEpub: this.hasValidEpub(),
      route: this.router.url,
    });
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
          await this.cancelNativeRewrite().catch(() => undefined);
        }
        await this.resetWorkflowForNewEpub(false);
        if (this.epubInput?.nativeElement) {
          this.epubInput.nativeElement.value = '';
        }
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
        this.currentPreviewOrigin = this.originalEpubPreviewUrl
          ? 'source-epub'
          : null;
      }
      this.workflowStep = 1;
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
    if (
      formatId &&
      this.formatOptions.some((option) => option.id === formatId)
    ) {
      return formatId;
    }

    return this.formatOptions[0]?.id ?? 'epub';
  }

  private async persistCropTargetId(formatId: string): Promise<void> {
    const resolved = this.resolveFormatId(formatId);
    this.persistedCropTargetId = resolved;
    await this.settings.set({ cropTargetId: resolved });
  }

  private async maybeAskForRatingAfterSuccessfulSave(
    flow: 'native' | 'web',
  ): Promise<void> {
    await this.ratingService.trackSuccessEvent('epub_saved');
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
