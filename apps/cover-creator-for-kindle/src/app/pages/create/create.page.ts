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
  IonSelect,
  IonSelectOption,
  ToastController,
  PopoverController,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

import {
  KindleGroup,
  KindleModel,
} from '../../components/kindle-model-picker/kindle-model-picker.component';

import {
  buildDefaultCoverCropState,
  CoverSourceActionsComponent,
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
import {
  EditorSessionService,
  type KindleDeviceModel,
} from '@sheldrapps/image-workflow/editor';

import {
  chevronDown,
  imageOutline,
  alertCircleOutline,
  checkmarkCircle,
  saveOutline,
  shareSocialOutline,
  closeCircleOutline,
  helpCircleOutline,
  appsOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

import {
  FileService,
  type CoverProcessingMetadataInput,
} from '../../services/file.service';
import {
  KindleBrand,
  KindleCatalogService,
  type ResolvedKindleSelection,
} from '../../services/kindle-catalog.service';
import {
  AdsService,
  BillingService,
  type RewardedAdResult,
} from '../../services/ads.service';
import { playCircleOutline } from 'ionicons/icons';
import { CoversEventsService } from '../../services/covers-events.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastOptions } from '@ionic/angular';
import {
  LoadingStateComponent,
  SaveCoverModalComponent,
  ScrollableBarItem,
  ScrollableButtonBarComponent,
} from '@sheldrapps/ui-theme';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { detectSupportedLocale } from '@sheldrapps/i18n-kit';
import { RatingService } from '@sheldrapps/rating-kit';
import {
  RecommendedApp,
  RecommendedAppsService,
  buildHomeHeaderItems,
  handleHomeHeaderAction,
} from '@sheldrapps/recommended-apps';
import { CcfkSettings } from '../../settings/ccfk-settings.schema';
import {
  DEFAULT_EXPORT_QUALITY_MODE,
  ExportQualitySelectorComponent,
  getCoverExportOptions,
  normalizeExportQualityMode,
  type ExportQualityMode,
} from '@sheldrapps/export-quality-kit';
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
  renderedWidth?: number;
  renderedHeight?: number;
};

type EditorSourceMode = 'image' | 'scratch';

@Component({
  selector: 'app-create',
  templateUrl: './create.page.html',
  styleUrls: ['./create.page.scss'],
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
    IonCol,
    IonRow,
    IonGrid,
    IonPopover,
    IonSelect,
    IonSelectOption,
    IonModal,
    LoadingStateComponent,
    EReaderPreviewFrameComponent,
    CoverSourceActionsComponent,
    ScrollableButtonBarComponent,
    ExportQualitySelectorComponent,
    TourOverlayComponent,
  ],
})
export class CreatePage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content?: IonContent;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;
  private modalCtrl = inject(ModalController);
  private fileService = inject(FileService);
  private catalog = inject(KindleCatalogService);
  private imagePipe = inject(ImagePipelineService);
  private ads = inject(AdsService);
  private billing = inject(BillingService);
  private toastCtrl = inject(ToastController);
  private popoverCtrl = inject(PopoverController);
  private coversEvents = inject(CoversEventsService);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);
  private settings = inject(SettingsStore<CcfkSettings>);
  private router = inject(Router);
  private editorSession = inject(EditorSessionService);
  private recommendedAppsService = inject(RecommendedAppsService);
  private homeTour = inject(TourService);
  private ratingService = inject(RatingService);

  constructor() {
    addIcons({
      chevronDown,
      checkmarkCircle,
      closeCircleOutline,
      alertCircleOutline,
      playCircleOutline,
      saveOutline,
      shareSocialOutline,
      helpCircleOutline,
      appsOutline,
      informationCircleOutline,
      imageOutline,
    });
  }

  headerItems: ScrollableBarItem[] = [];
  recommendedApps: RecommendedApp[] = [];
  showRecommended = false;
  adsRemoved = false;
  exportQualityMode: ExportQualityMode = DEFAULT_EXPORT_QUALITY_MODE;
  removeAdsPriceFormatted: string | null = null;
  removeAdsPulseActive = false;
  purchaseModalOpen = false;
  purchaseBusy = false;
  isOnline = true;

  brands: KindleBrand[] = [];
  groups: KindleGroup[] = [];
  selectedBrandId?: string;
  selectedGroupId?: string;
  selectedModel?: KindleModel;

  get currentGroupModels(): KindleModel[] {
    if (!this.selectedGroupId) return [];
    const group = this.groups.find((g) => g.id === this.selectedGroupId);
    return group?.items ?? [];
  }

  originalImageFile?: File;
  selectedImageFile?: File;
  selectedImageName?: string;
  originalImageDims?: { width: number; height: number };
  workingImageDims?: { width: number; height: number };

  previewUrl?: string;
  cropState?: CoverCropState;
  private lastEditorSessionId?: string;
  private routerSub?: Subscription;
  private coversEventsSub?: Subscription;
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
  private readonly editorEReaderOptimizationFeatureEnabled = true;

  imageErrorKey?: string;
  imageErrorParams: Record<string, any> = {};

  imageWarnKey?: string;
  imageWarnParams: Record<string, any> = {};

  isPickingImage = false;
  isExporting = false;
  loadingMessageKey?: string;

  workingImageFile?: File;
  exportImageFile?: File;

  generatedEpubBytes?: Uint8Array;
  generatedEpubFilename?: string;
  lastSavedFilename?: string;
  wasAutoSaved = false;

  infoOpen = false;
  infoEvent: Event | null = null;
  previewOpen = false;
  private previewLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressNextImagePick = false;
  private brandSelectCanceled = false;
  private groupSelectCanceled = false;
  private modelSelectCanceled = false;
  private readonly warnDebugKey = 'cc_warn_debug';
  private readonly editorTourSeenVersionKey = 'cc_editor_tour_seen_version';
  private readonly artifactReductionInfoSeenKey =
    'cc_editor_artifact_reduction_info_seen';
  private readonly currentEditorTourVersion = 5;
  private forceEditorTourOnNextEditorOpen = false;
  private forceIncludeRemoveAdsStepOnNextHomeTour = false;
  private forceShowRemoveAdsEntryPointForTour = false;

  async ngOnInit() {
    await this.refreshHeaderItems();
    this.isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
    await this.billing.hydrateCachedState();
    this.adsRemoved = this.billing.isAdsRemoved();
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe((value) => {
      const tierChanged = this.adsRemoved !== value;
      this.adsRemoved = value;
      if (tierChanged) {
        this.exportImageFile = undefined;
        this.syncAuthorizedExportQualityMode('billing-state-change');
      }
      this.syncRemoveAdsPulse();
    });
    this.removeAdsPriceFormatted = this.billing.getRemoveAdsPriceFormatted();
    this.removeAdsPriceSub = this.billing.removeAdsPrice$.subscribe((value) => {
      this.removeAdsPriceFormatted = value;
    });
    this.syncRemoveAdsPulse();

    this.brands = await this.catalog.getBrands();
    const settings = await this.settings.load();
    this.applyResolvedSelection(
      this.catalog.resolveSelection(this.brands, {
        brandId: settings.brandId,
        modelId: settings.modelId,
      }),
    );
    this.exportQualityMode = normalizeExportQualityMode(
      settings.exportQualityMode,
      this.adsRemoved,
    );
    this.syncAuthorizedExportQualityMode('settings-load');

    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        if (url.startsWith('/tabs/create') || url === '/create') {
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
    this.revokePreviewUrl();
    this.routerSub?.unsubscribe();
    this.coversEventsSub?.unsubscribe();
    this.adsRemovedSub?.unsubscribe();
    this.removeAdsPriceSub?.unsubscribe();
    this.clearRemoveAdsPulse();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
  }

  private setBusy(kind: 'pick' | 'export' | 'none', messageKey?: string) {
    this.zone.run(() => {
      this.isPickingImage = kind === 'pick';
      this.isExporting = kind === 'export';
      this.loadingMessageKey = kind === 'none' ? undefined : messageKey;
    });
  }

  compareModels(m1: KindleModel, m2: KindleModel): boolean {
    return m1 && m2 ? m1.id === m2.id : m1 === m2;
  }

  async onAdjustWithEditor() {
    if (!this.canEdit()) return;
    await this.openEditor('image');
  }

  canStartScratch(): boolean {
    return !!this.selectedModel && !this.isPickingImage && !this.isExporting;
  }

  async onStartScratch(): Promise<void> {
    if (!this.canStartScratch()) return;
    this.resetSelectedImage();
    this.clearImageError();
    this.clearImageWarn();
    await this.homeTour.completeInteraction('cover-image-selected');
    await this.openEditor('scratch');
  }

  private async openEditor(sourceMode: EditorSourceMode): Promise<void> {
    const selection = this.resolveCurrentSelection();
    if (!selection) return;
    if (sourceMode === 'image' && !this.workingImageFile) return;

    this.applyResolvedSelection(selection);
    const initialState =
      sourceMode === 'scratch' ? buildDefaultCoverCropState() : this.cropState;
    const sid = this.editorSession.createSession({
      file: sourceMode === 'image' ? this.workingImageFile : undefined,
      sourceMode,
      target: {
        width: selection.model.width,
        height: selection.model.height,
      },
      initialState,
      tools: {
        kindle: {
          modelCatalog: this.groups,
          selectedBrandId: selection.brandId,
          selectedGroupId: this.selectedGroupId,
          selectedModel: selection.model,
          onKindleModelChange: (model: KindleDeviceModel) => {
            void this.applyExternalModelChange(model);
          },
        },
        eReaderOptimization: {
          enabled: this.editorEReaderOptimizationFeatureEnabled,
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
    });

    this.lastEditorSessionId = sid;
    const shouldShowEditorTour = await this.shouldShowEditorTour();
    await this.homeTour.completeInteraction('editor-apply');

    const entryPath = sourceMode === 'scratch' ? '/editor/tools' : '/editor';
    this.router.navigate([entryPath], {
      queryParams: {
        sid,
        ...(shouldShowEditorTour ? { tour: '1' } : {}),
      },
    });
  }

  async onBrandChange() {
    const selection =
      this.catalog.resolveFirstSelectionInBrand(
        this.brands,
        this.selectedBrandId,
      ) ?? this.catalog.getDefaultSelection(this.brands);
    this.applyResolvedSelection(selection);
    await this.onModelChange();
  }

  async onGroupChange() {
    // When group changes, reset the model selection
    // and select the first model in the new group
    if (this.selectedGroupId) {
      const group = this.groups.find((g) => g.id === this.selectedGroupId);
      if (group && group.items.length > 0) {
        this.selectedModel = group.items[0];
        await this.onModelChange();
      }
    }
  }

  async onModelChange() {
    await this.persistModelSelection({ applyWarn: true });
  }

  onBrandSelectOpen(): void {
    this.brandSelectCanceled = false;
  }

  onBrandSelectCancel(): void {
    this.brandSelectCanceled = true;
  }

  async onBrandSelectDismiss(): Promise<void> {
    if (this.brandSelectCanceled || !this.selectedBrandId) {
      this.brandSelectCanceled = false;
      return;
    }
    this.brandSelectCanceled = false;
    await this.homeTour.completeInteraction('brand-select');
  }

  onGroupSelectOpen(): void {
    this.groupSelectCanceled = false;
  }

  onGroupSelectCancel(): void {
    this.groupSelectCanceled = true;
  }

  async onGroupSelectDismiss(): Promise<void> {
    if (this.groupSelectCanceled || !this.selectedGroupId) {
      this.groupSelectCanceled = false;
      return;
    }
    this.groupSelectCanceled = false;
    await this.homeTour.completeInteraction('group-select');
  }

  onModelSelectOpen(): void {
    this.modelSelectCanceled = false;
  }

  onModelSelectCancel(): void {
    this.modelSelectCanceled = true;
  }

  async onModelSelectDismiss(): Promise<void> {
    if (this.modelSelectCanceled || !this.selectedModel) {
      this.modelSelectCanceled = false;
      return;
    }
    this.modelSelectCanceled = false;
    await this.homeTour.completeInteraction('model-select');
  }

  onTourInteraction(interactionId: string): void {
    void this.homeTour.completeInteraction(interactionId);
  }

  private async applyExternalModelChange(
    model: KindleDeviceModel,
  ): Promise<void> {
    const resolvedModel =
      this.catalog.findModelById(this.groups, model.id) ??
      (model.i18nKey ? (model as KindleModel) : undefined);
    if (!resolvedModel) return;

    this.selectedModel = resolvedModel;

    const group = this.groups.find((g) =>
      g.items.some((item) => item.id === resolvedModel.id),
    );
    this.selectedGroupId = group?.id;

    await this.persistModelSelection({ applyWarn: false });
  }

  private async persistModelSelection(opts: { applyWarn: boolean }) {
    // Clear generated files when model changes
    this.generatedEpubBytes = undefined;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;
    this.exportImageFile = undefined;

    const selection = this.resolveCurrentSelection();
    if (selection) {
      await this.settings.set({
        brandId: selection.brandId,
        modelId: selection.modelId,
      });
    }

    if (opts.applyWarn && this.workingImageFile && this.workingImageDims) {
      await this.applySmallWarn('model-change');
    }
  }

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

    this.setBusy('pick', 'CREATE.LOADING_IMAGE');

    try {
      this.cropState = undefined;
      let source = file;

      const basicErr = this.imagePipe.validateBasic(source);
      if (basicErr) return this.failImage(basicErr, source);

      source = await this.imagePipe.materializeFile(source);

      let originalDims = await this.imagePipe.getDimensions(source);

      if (!originalDims) {
        const normalized = await this.imagePipe.normalizeFile(source);
        if (normalized) {
          source = normalized;
          originalDims = await this.imagePipe.getDimensions(source);
        }
      }

      if (!originalDims) return this.failImage('CORRUPT', source);

      this.clearImageError();
      this.clearImageWarn();

      this.originalImageFile = source;

      const working = await this.imagePipe.prepareWorkingImage(source);
      this.workingImageFile = working;
      this.exportImageFile = undefined;
      this.cropState = undefined;

      const workingDims = await this.imagePipe.getDimensions(working);
      this.originalImageDims = originalDims;
      this.workingImageDims = workingDims ?? originalDims;
      this.selectedImageName = working.name;

      await this.applySmallWarn('image-selected', originalDims);

      this.revokePreviewUrl();
      this.previewUrl = URL.createObjectURL(working);
      await this.homeTour.completeInteraction('cover-image-selected');
    } finally {
      this.setBusy('none');
      input.value = '';
    }
  }

  private async applySmallWarn(
    reason: 'image-selected' | 'editor-apply' | 'model-change',
    legacyDimsHint?: { width: number; height: number },
    exportDimsHint?: { width: number; height: number },
  ): Promise<void> {
    this.clearImageWarn();
    if (!this.selectedModel) return;

    const target = {
      width: this.selectedModel.width,
      height: this.selectedModel.height,
    };
    const legacyDims = legacyDimsHint ?? this.workingImageDims ?? null;
    const exportDims =
      (await this.resolveExportDimsForSmallWarn()) ?? exportDimsHint ?? null;

    // Enforce export-based validation only.
    if (!exportDims) {
      this.debugSmallWarn({
        reason,
        modelId: this.selectedModel.id,
        target,
        exportDims,
        legacyDims,
        usedDims: null,
        willWarn: false,
      });
      return;
    }

    const params = this.imagePipe.getSmallWarnParams(exportDims, target);
    this.debugSmallWarn({
      reason,
      modelId: this.selectedModel.id,
      target,
      exportDims,
      legacyDims,
      usedDims: exportDims,
      willWarn: !!params,
    });
    if (!params) return;

    this.imageWarnKey = 'CREATE.IMAGE_WARN_SMALL';
    this.imageWarnParams = params;
    this.homeTour.requestSync();
  }

  canEdit(): boolean {
    return (
      !!this.selectedModel && !!this.workingImageFile && !this.imageErrorKey
    );
  }
  canExport(): boolean {
    return (
      !!this.selectedModel && !!this.workingImageFile && !this.imageErrorKey
    );
  }

  async onSave() {
    if (!this.canSaveShare()) return;

    const currentFilename = this.generatedEpubFilename || 'kindle_cover';
    const nameWithoutExt = currentFilename.replace(/\.epub$/i, '');

    const modal = await this.modalCtrl.create({
      component: SaveCoverModalComponent,
      componentProps: {
        initialFilename: nameWithoutExt,
        title: this.translate.instant('CREATE.SAVE_RENAME_TITLE'),
        message: this.translate.instant('CREATE.SAVE_RENAME_MESSAGE'),
        placeholder: this.translate.instant('CREATE.SAVE_RENAME_PLACEHOLDER'),
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
    this.setBusy('export', 'CREATE.SAVING');
    try {
      const exportFile = await this.ensureExportImageFile();
      if (!exportFile) return;
      const requestedFilename = this.ensureEpubExtension(filename);

      if (
        this.lastSavedFilename &&
        requestedFilename.toLowerCase() === this.lastSavedFilename.toLowerCase()
      ) {
        const alreadySaved =
          await this.fileService.hasCoverByFilename(requestedFilename);
        if (alreadySaved) {
          await this.showToast(
            'CREATE.SAVED_OK',
            { duration: 1600 },
            'success',
          );
          return;
        }
        this.lastSavedFilename = undefined;
        this.wasAutoSaved = false;
      }

      if (this.lastSavedFilename) {
        const staleFilename = this.lastSavedFilename;
        try {
          await this.fileService.renameGeneratedEpub({
            from: staleFilename,
            to: requestedFilename,
          });
        } catch {
          await this.fileService.saveGeneratedEpub({
            bytes: this.generatedEpubBytes!,
            filename: requestedFilename,
            coverFileForThumb: exportFile,
            coverMetadata: this.buildCoverProcessingMetadata(),
          });
          this.logSaveFlow('finalWriteComplete', {
            flow: 'performSave',
            filename: requestedFilename,
            writeCompletedAt: new Date().toISOString(),
          });
          if (
            staleFilename &&
            staleFilename.toLowerCase() !== requestedFilename.toLowerCase()
          ) {
            try {
              await this.fileService.deleteGeneratedEpub(staleFilename);
            } catch {
              // ignore missing stale filename
            }
          }
        }

        this.generatedEpubFilename = requestedFilename;
        this.lastSavedFilename = requestedFilename;
      } else {
        const uniqueFilename =
          await this.resolveUniqueEpubFilename(requestedFilename);
        await this.fileService.saveGeneratedEpub({
          bytes: this.generatedEpubBytes!,
          filename: uniqueFilename,
          coverFileForThumb: exportFile,
          coverMetadata: this.buildCoverProcessingMetadata(),
        });
        this.logSaveFlow('finalWriteComplete', {
          flow: 'performSave',
          filename: uniqueFilename,
          writeCompletedAt: new Date().toISOString(),
        });
        this.generatedEpubFilename = uniqueFilename;
        this.lastSavedFilename = uniqueFilename;
      }

      this.coversEvents.emit({
        type: 'saved',
        filename: this.generatedEpubFilename,
      });
      this.logSaveFlow('savedEventEmitted', {
        flow: 'performSave',
        filename: this.generatedEpubFilename,
        emittedAt: new Date().toISOString(),
      });

      await this.showToast('CREATE.SAVED_OK', { duration: 1600 }, 'success');
    } finally {
      this.zone.run(() => this.setBusy('none'));
    }
  }

  async onShare() {
    if (!this.canSaveShare()) {
      if (this.canGenerate()) {
        await this.showHintOnce(
          'cc_hint_save_share_explain_shown',
          'CREATE.HINT_SAVE_SHARE_EXPLAIN',
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

    await this.fileService.shareGeneratedEpub({
      bytes: this.generatedEpubBytes!,
      filename: this.generatedEpubFilename!,
      title: 'Kindle Cover',
    });
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
    this.generatedEpubBytes = undefined;
    this.wasAutoSaved = false;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;

    this.revokePreviewUrl();
  }

  private revokePreviewUrl() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = undefined;
    }
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
        ? 'CREATE.IMAGE_ERROR_TYPE'
        : err === 'TOO_LARGE'
          ? 'CREATE.IMAGE_ERROR_SIZE'
          : 'CREATE.IMAGE_ERROR_CORRUPT';

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

  getGenerateActionKey(): string {
    return this.adsRemoved
      ? 'CREATE.CREATE_ACTION'
      : 'CREATE.CREATE_ACTION_REWARDED';
  }

  canShowRemoveAdsEntryPoint(): boolean {
    return (
      !this.adsRemoved &&
      (this.forceShowRemoveAdsEntryPointForTour ||
        this.billing.canShowRemoveAdsEntryPoint())
    );
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
    console.info(`[CCFK:remove-ads] ${eventName}${suffix}`);
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
    await this.homeTour.completeInteraction('remove-ads-open');
  }

  closePurchaseModal(): void {
    this.purchaseModalOpen = false;
  }

  onPurchaseModalCloseClick(): void {
    void this.homeTour.completeInteraction('remove-ads-close');
    this.closePurchaseModal();
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
    return (
      this.canExport() &&
      !!this.generatedEpubBytes &&
      !!this.generatedEpubFilename &&
      !this.isExporting
    );
  }

  shouldShowExportOptions(): boolean {
    return this.canExport();
  }

  getEffectiveExportQualityMode(): ExportQualityMode {
    return normalizeExportQualityMode(this.exportQualityMode, this.adsRemoved);
  }

  async onExportQualityModeSelect(mode: ExportQualityMode): Promise<void> {
    await this.homeTour.completeInteraction('export-quality-select');
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
    await this.settings.setForScope('exportQuality', {
      exportQualityMode: mode,
    });
  }

  async onGenerate() {
    if (!this.canGenerate() || !this.selectedModel) return;

    this.setBusy('export', 'CREATE.GENERATING');

    try {
      if (!this.billing.isAdsRemoved()) {
        const result: RewardedAdResult = await this.ads.showRewarded();

        if (result.failed) {
          await this.showToast(
            'CREATE.ADS_REQUIRED',
            { duration: 1800 },
            'error',
          );
          return;
        }

        if (result.adClosed && !result.rewardEarned) {
          await this.showToast(
            'CREATE.ADS_REQUIRED',
            { duration: 1800 },
            'error',
          );
          return;
        }

        if (!result.rewardEarned || !result.adClosed) {
          return;
        }

        this.trackRemoveAdsEvent('rewarded_generate_completed');
      }

      await this.generateCoverWithCurrentSelection();
    } finally {
      this.zone.run(() => this.setBusy('none'));
    }
  }

  private async generateCoverWithCurrentSelection(): Promise<void> {
    if (!this.selectedModel) {
      return;
    }

    const exportFile = await this.ensureExportImageFile();
    if (!exportFile) return;

    const res = await this.fileService.generateEpubBytes({
      modelId: this.selectedModel.id,
      coverFile: exportFile,
      title: 'Kindle Cover',
    });

    this.generatedEpubBytes = res.bytes;
    this.generatedEpubFilename = await this.resolveUniqueEpubFilename(
      res.filename,
    );

    this.setBusy('export', 'CREATE.SAVING');

    await this.fileService.saveGeneratedEpub({
      bytes: this.generatedEpubBytes,
      filename: this.generatedEpubFilename,
      coverFileForThumb: exportFile,
      coverMetadata: this.buildCoverProcessingMetadata(),
    });
    this.logSaveFlow('finalWriteComplete', {
      flow: 'onGenerate',
      filename: this.generatedEpubFilename,
      writeCompletedAt: new Date().toISOString(),
    });

    this.coversEvents.emit({
      type: 'saved',
      filename: this.generatedEpubFilename,
    });
    this.logSaveFlow('savedEventEmitted', {
      flow: 'onGenerate',
      filename: this.generatedEpubFilename,
      emittedAt: new Date().toISOString(),
    });

    this.wasAutoSaved = true;
    this.lastSavedFilename = this.generatedEpubFilename;

    await this.zone.run(async () => {
      await this.showToast(
        'CREATE.COVER_CREATED',
        { duration: 2200 },
        'success',
      );
    });
    await this.ratingService.trackSuccessEvent('cover_created');
    await this.ratingService.maybeAskForRating({
      source: 'save-success',
      metadata: { flow: 'generate' },
    });
    await this.homeTour.completeInteraction('cover-created');
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
    this.previewOpen = true;
  }

  closePreview() {
    this.previewOpen = false;
    this.suppressNextImagePick = false;
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
    const manualStartRequested =
      this.homeTour.consumePendingManualStart(HOME_TOUR_ID);
    if (manualStartRequested) {
      this.forceEditorTourOnNextEditorOpen = true;
      this.forceIncludeRemoveAdsStepOnNextHomeTour = true;
    }
    await this.maybeStartHomeTour(manualStartRequested);
  }

  onTourContentScroll() {
    this.homeTour.requestSync();
  }

  private async refreshHeaderItems(): Promise<void> {
    this.recommendedApps =
      await this.recommendedAppsService.getRecommendedApps();
    this.showRecommended = this.recommendedApps.length > 0;
    console.info('[recommended-apps][host:ccfk] header state', {
      showRecommended: this.showRecommended,
      recommendedAppsLength: this.recommendedApps.length,
      recommendedPackageNames: this.recommendedApps.map(
        (app) => app.packageName,
      ),
    });
    this.headerItems = buildHomeHeaderItems(this.showRecommended, {
      appsLabel: this.translate.instant('ARR.TOOLS.APPS'),
      guideLabel: this.translate.instant('ARR.TOOLS.GUIDE'),
    });
  }

  async onHeaderItemClick(id: string): Promise<void> {
    if (id === 'guide' || id === 'info') {
      await this.startManualHomeTour();
      return;
    }

    await handleHomeHeaderAction(id, {
      closeInfo: () => this.closeInfo(),
      toggleInfo: () => this.toggleInfo(),
      navigateToRecommended: async () => {
        await this.router.navigateByUrl('/recommended-apps');
      },
    });
  }

  private async showToast(
    messageKey: string,
    opts: Partial<ToastOptions> = {},
    variant: 'success' | 'error' | 'info' = 'success',
  ) {
    const extra = opts.cssClass
      ? Array.isArray(opts.cssClass)
        ? opts.cssClass
        : [opts.cssClass]
      : [];

    const toast = await this.toastCtrl.create({
      ...opts,
      message: this.translate.instant(messageKey),
      position: 'middle',
      duration: opts.duration ?? 1800,
      animated: true,
      translucent: true,
      cssClass: ['cc-toast', `cc-toast--${variant}`, ...extra],
    });

    await toast.present();
  }

  private async applyCropResult(result: EditorResult): Promise<void> {
    const newFile = result.file;
    if (!newFile) return;

    this.cropState = result.state ?? this.cropState;

    this.clearImageError();
    this.clearImageWarn();

    this.workingImageFile = newFile;
    this.exportImageFile = undefined;

    this.generatedEpubBytes = undefined;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;

    this.selectedImageName = newFile.name;
    const dims = await this.imagePipe.getDimensions(newFile);
    if (!dims) return this.failImage('CORRUPT', newFile);
    this.workingImageDims = dims;

    const exportDimsFromEditor = this.extractEditorExportDims(result);
    await this.applySmallWarn('editor-apply', undefined, exportDimsFromEditor);

    await this.updatePreviewFromComposition();
    await this.markEditorTourSeen();
    await this.homeTour.completeInteraction('editor-apply');
  }

  private extractEditorExportDims(
    result: EditorResult,
  ): { width: number; height: number } | undefined {
    if (
      Number.isFinite(result.renderedWidth) &&
      Number.isFinite(result.renderedHeight)
    ) {
      return {
        width: Math.max(1, Math.round(result.renderedWidth as number)),
        height: Math.max(1, Math.round(result.renderedHeight as number)),
      };
    }
    return undefined;
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
    modelId?: string;
    target: { width: number; height: number };
    exportDims: { width: number; height: number } | null;
    legacyDims: { width: number; height: number } | null;
    usedDims: { width: number; height: number } | null;
    willWarn: boolean;
  }): void {
    if (!this.isSmallWarnDebugEnabled()) return;
    console.info('[CCFK][SMALL_WARN_DEBUG]', data);
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

  private buildCompositionInput(purpose: 'preview' | 'export' = 'preview') {
    if (
      !this.workingImageFile ||
      !this.selectedModel ||
      !this.workingImageDims
    ) {
      return null;
    }

    return buildCompositionInputForPurpose({
      purpose,
      sources: {
        working: {
          file: this.workingImageFile,
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
        width: this.selectedModel.width,
        height: this.selectedModel.height,
      },
      state: this.cropState ?? buildDefaultCoverCropState(),
      frameFallback: {
        width: this.selectedModel.width,
        height: this.selectedModel.height,
      },
    });
  }

  private async updatePreviewFromComposition(): Promise<void> {
    const input = this.buildCompositionInput('preview');
    if (!input) return;

    const fullCanvas = await renderCompositionToCanvas(input, {
      mode: 'preview',
      outputScale: 1,
    });
    if (!fullCanvas) return;

    const isDithered = this.isPreviewDithered();
    const modalCanvas = isDithered
      ? fullCanvas
      : this.downscaleCanvas(fullCanvas, 1280, false);

    const blob: Blob | null = await new Promise((resolve) =>
      modalCanvas.toBlob(
        (bb) => resolve(bb),
        isDithered ? 'image/png' : 'image/jpeg',
        isDithered ? undefined : 0.9,
      ),
    );
    if (!blob) return;

    this.revokePreviewUrl();
    this.previewUrl = URL.createObjectURL(blob);
  }

  private async ensureExportImageFile(): Promise<File | null> {
    if (this.exportImageFile) return this.exportImageFile;

    const input = this.buildCompositionInput('export');
    if (!input) return null;

    const file = await renderCompositionToFile(input, {
      mode: 'export',
      mimeType: this.resolveExportMimeType(),
      quality: this.resolveExportQuality(),
      maxDimension: this.resolveExportMaxDimension(),
    });
    if (!file) return null;

    this.exportImageFile = file;
    return file;
  }

  private resolveExportMimeType(): string | undefined {
    return this.getSelectedExportQualityOptions().mimeType;
  }

  private resolveExportQuality(): number | undefined {
    return this.getSelectedExportQualityOptions().quality;
  }

  private resolveExportMaxDimension(): number | undefined {
    return this.getSelectedExportQualityOptions().maxDimension;
  }

  private getSelectedExportQualityOptions(): ReturnType<
    typeof getCoverExportOptions
  > {
    return getCoverExportOptions(this.getEffectiveExportQualityMode());
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
    void this.settings.setForScope('exportQuality', {
      exportQualityMode: normalized,
    });
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
    if (sMax <= maxSide) return src;

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

  private async startManualHomeTour(): Promise<void> {
    this.forceEditorTourOnNextEditorOpen = true;
    this.forceIncludeRemoveAdsStepOnNextHomeTour = true;
    this.closeInfo();
    await this.maybeStartHomeTour(true);
  }

  private async resolveUniqueEpubFilename(
    requestedFilename: string,
  ): Promise<string> {
    const normalized = this.ensureEpubExtension(requestedFilename);
    const base = normalized.replace(/\.epub$/i, '').trim() || 'kindle_cover';
    let candidate = `${base}.epub`;
    let index = 1;

    while (await this.fileService.hasCoverByFilename(candidate)) {
      candidate = `${base} (${index}).epub`;
      index += 1;
    }

    return candidate;
  }

  private logSaveFlow(event: string, payload?: Record<string, unknown>): void {
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.info(`[CCFK:create:save-flow] ${event}${suffix}`);
  }

  private resolveCurrentSelection(): ResolvedKindleSelection | null {
    if (!this.brands.length) {
      return null;
    }

    return this.catalog.resolveSelection(this.brands, {
      brandId: this.selectedBrandId,
      modelId: this.selectedModel?.id,
    });
  }

  private applyResolvedSelection(selection: ResolvedKindleSelection): void {
    this.selectedBrandId = selection.brandId;
    this.groups = this.catalog.getGroupsForBrand(
      this.brands,
      selection.brandId,
    );
    this.selectedGroupId = selection.groupId;
    this.selectedModel = selection.model;
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
    const includeRemoveAdsStep =
      (!this.adsRemoved && this.billing.canShowRemoveAdsEntryPoint()) ||
      (!this.adsRemoved && this.forceIncludeRemoveAdsStepOnNextHomeTour);
    this.forceShowRemoveAdsEntryPointForTour =
      !this.adsRemoved && this.forceIncludeRemoveAdsStepOnNextHomeTour;

    await this.homeTour.start(
      buildHomeTourDefinition(this.translate, {
        includeRemoveAdsStep,
      }),
      {
        onComplete: async (reason: TourCompletionReason) => {
          this.forceIncludeRemoveAdsStepOnNextHomeTour = false;
          this.forceShowRemoveAdsEntryPointForTour = false;
          await this.markHomeTourSeen(reason);
        },
      },
    );
  }

  private async ensureTourLocaleReady(settings: CcfkSettings): Promise<void> {
    const expectedLanguage =
      settings.language ?? (await detectSupportedLocale());
    if (this.translate.currentLang === expectedLanguage) {
      return;
    }

    await firstValueFrom(this.translate.use(expectedLanguage));
  }

  private shouldAutoStartHomeTour(settings: CcfkSettings): boolean {
    return settings.homeTourSeen !== true;
  }

  private async markHomeTourSeen(_reason: TourCompletionReason): Promise<void> {
    await this.settings.set((prev) => ({
      ...prev,
      homeTourSeen: true,
      homeTourVersion: CURRENT_HOME_TOUR_VERSION,
      homeTourSeenAt: new Date().toISOString(),
    }));
  }

  private async markEditorTourSeen(): Promise<void> {
    await this.settings.set((prev) => ({
      ...prev,
      preferences: {
        ...(prev.preferences ?? {}),
        [this.editorTourSeenVersionKey]: this.currentEditorTourVersion,
      },
    }));
  }

  private async shouldShowEditorTour(): Promise<boolean> {
    if (this.forceEditorTourOnNextEditorOpen) {
      this.forceEditorTourOnNextEditorOpen = false;
      return true;
    }

    const settings = await this.settings.load();
    const seenVersion = settings.preferences?.[this.editorTourSeenVersionKey];
    return (
      typeof seenVersion !== 'number' ||
      seenVersion < this.currentEditorTourVersion
    );
  }
}
