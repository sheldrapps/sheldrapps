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
import { Subscription, filter } from 'rxjs';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
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
  IonLoading,
  IonSpinner,
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
  CoverCropState,
  ImagePipelineService,
  ImageValidationError,
  buildCompositionInput,
  renderCompositionToCanvas,
  renderCompositionToFile,
} from '@sheldrapps/image-workflow';
import type {
  CropTarget,
  CropFormatOption,
} from '@sheldrapps/image-workflow';
import { EditorSessionService } from '@sheldrapps/image-workflow/editor';

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
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

import { FileService } from '../../services/file.service';
import { EpubWorkingCopyService } from '../../services/epub-working-copy.service';
import { AdsService, type RewardedAdResult } from '../../services/ads.service';
import { CoversEventsService } from '../../services/covers-events.service';
import {
  EpubRewriteError,
  EpubRewriteService,
} from '../../services/epub-rewrite.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastOptions } from '@ionic/angular';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { SaveCoverModalComponent } from '@sheldrapps/ui-theme';
import { EccSettings } from '../../settings/ecc-settings.schema';

type EditorResult = {
  file: File;
  state?: CoverCropState;
  formatId?: string;
  renderedBlob?: Blob;
  renderedWidth?: number;
  renderedHeight?: number;
  renderedMimeType?: string;
};

@Component({
  selector: 'app-change',
  templateUrl: './change.page.html',
  styleUrls: ['./change.page.scss'],
  standalone: true,
  imports: [
    IonCol,
    IonLoading,
    IonSpinner,
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
  ],
})
export class ChangePage implements OnInit, OnDestroy {
  private static readonly PREVIEW_MAX_SIDE = 1280;
  private static readonly THUMB_SIZE = 96;
  private modalCtrl = inject(ModalController);
  private fileService = inject(FileService);
  private workingCopy = inject(EpubWorkingCopyService);
  private epubRewrite = inject(EpubRewriteService);
  private imagePipe = inject(ImagePipelineService);
  private ads = inject(AdsService);
  private toastCtrl = inject(ToastController);
  private popoverCtrl = inject(PopoverController);
  private coversEvents = inject(CoversEventsService);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);
  private router = inject(Router);
  private editorSession = inject(EditorSessionService);
  private settings = inject(SettingsStore<EccSettings>);
  private readonly baseTarget = { width: 1236, height: 1648 };
  private readonly baseModelId = 'epub';
  private readonly maxEpubSizeMB = 500;
  private readonly formatOptions = this.buildFormatOptions();
  private routerSub?: Subscription;
  private rewriteProgressSub?: PluginListenerHandle;
  private lastEditorSessionId?: string;
  private previewLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressNextImagePick = false;
  private workingMaxSideApplied: boolean | null = null;
  private persistedCropTargetId = 'epub';
  private readonly warnDebugKey = 'cc_warn_debug';

  @ViewChild('epubInput') epubInput!: ElementRef<HTMLInputElement>;
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
  });
  }

  // EPUB state
  sourceEpubFile?: File;
  workingEpubFile?: File;
  workingEpubPath?: string;
  workingEpubNativePath?: string;
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
  isPickingEpub = false;

  // Image state
  originalImageFile?: File;
  selectedImageFile?: File;
  selectedImageName?: string;
  selectedImageDims?: { width: number; height: number };

  previewUrl?: string;
  previewThumbUrl?: string;
  previewNonce = 0;
  cropState?: CoverCropState;
  selectedFormatId = 'epub';
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

  generatedEpubBytes?: Uint8Array;
  generatedEpubPath?: string;
  generatedEpubNativePath?: string;
  generatedEpubFilename?: string;
  lastSavedFilename?: string;
  wasAutoSaved = false;
  rewriteProgressPercent = 0;
  isNativeRewriteInProgress = false;
  isCancellingNativeRewrite = false;
  epubLoadProgressPercent = 0;
  epubLoadStage: 'copy' | 'inspect' | null = null;

  infoOpen = false;
  infoEvent: Event | null = null;
  previewOpen = false;
  private isApplyingFromEditor = false;
  private previewGenerationToken = 0;
  private readonly invalidCoverWarnKey = 'CHANGE.IMAGE_WARN_INVALID_EPUB_COVER';

  get previewUrlWithNonce(): string | null {
    return this.previewUrl ? `${this.previewUrl}#v=${this.previewNonce}` : null;
  }

  get targetAspect(): number {
    const width = this.targetWidth;
    const height = this.targetHeight;
    if (Number.isFinite(width) && Number.isFinite(height) && height) {
      return (width as number) / (height as number);
    }
    const selected = this.getSelectedFormatOption();
    if (selected?.target.width && selected?.target.height) {
      return selected.target.width / selected.target.height;
    }
    return this.baseTarget.width / this.baseTarget.height;
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

  async ngOnInit() {
    const settings = await this.settings.load();
    this.selectedFormatId = this.resolveFormatId(settings.cropTargetId);
    this.persistedCropTargetId = this.selectedFormatId;

    if (this.usesNativeRewrite()) {
      this.rewriteProgressSub = await this.epubRewrite.addProgressListener(
        ({ percent }) => {
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
  }

  ngOnDestroy() {
    this.closeInfo();
    this.clearPreviewLongPress();
    this.revokePreviewUrl();
    this.routerSub?.unsubscribe();
    void this.rewriteProgressSub?.remove();
  }

  private setBusy(kind: 'pick' | 'export' | 'epub' | 'none', messageKey?: string) {
    this.zone.run(() => {
      this.isPickingImage = kind === 'pick';
      this.isExporting = kind === 'export';
      this.isPickingEpub = kind === 'epub';
      this.loadingMessageKey = kind === 'none' ? undefined : messageKey;
    });
  }

  private buildFormatOptions(): CropFormatOption[] {
    const epubTarget: CropTarget = {
      width: this.baseTarget.width,
      height: this.baseTarget.height,
      output: 'source',
    };

    return [
      { id: 'epub', label: 'Kindle', target: epubTarget },
      {
        id: 'kobo',
        label: 'Kobo',
        target: { width: 1072, height: 1448, output: 'source' },
      },
      {
        id: 'three_four',
        label: '3:4',
        target: { width: 3, height: 4, output: 'source' },
      },
      {
        id: 'nine_sixteen',
        label: '9:16',
        target: { width: 9, height: 16, output: 'source' },
      },
    ];
  }

  // EPUB handling methods
  openEpubPicker() {
    this.epubInput.nativeElement.click();
  }

  async onEpubSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.resetEpubLoadProgress();
    this.setBusy('epub', 'CHANGE.LOADING_EPUB');

    try {
      if (this.usesNativeRewrite()) {
        await this.onNativeEpubSelected(file);
        return;
      }

      await this.resetWorkflowForNewEpub();

      // Validate EPUB file
      const validation = this.fileService.validateEpub(file, this.maxEpubSizeMB);
      if (!validation.valid) {
        this.failEpub(validation.errorKey!, file);
        return;
      }

      // Create working copy immediately
      let cycle: Awaited<ReturnType<EpubWorkingCopyService['startCycle']>>;
      try {
        cycle = await this.workingCopy.startCycle(file);
      } catch {
        this.failEpub('EPUB_ERROR_CORRUPT', file);
        return;
      }
      this.sourceEpubFile = file;
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

      const extractedCover = await this.fileService.extractCoverFromEpubFile(
        this.workingEpubFile,
      );
      this.clearEpubError();

      if (!extractedCover) {
        this.activateInvalidCoverFallback();
        return;
      }

      const coverLoaded = await this.applyImageSource(extractedCover, false);
      if (!coverLoaded) {
        this.activateInvalidCoverFallback();
        return;
      }
    } finally {
      this.resetEpubLoadProgress();
      this.setBusy('none');
      input.value = '';
    }
  }

  private async onNativeEpubSelected(file: File) {
    await this.resetWorkflowForNewEpub();
    this.epubLoadStage = 'copy';
    this.epubLoadProgressPercent = 0;

    const validation = this.fileService.validateEpub(file, this.maxEpubSizeMB);
    if (!validation.valid) {
      this.failEpub(validation.errorKey!, file);
      return;
    }

    let cycle: Awaited<ReturnType<EpubWorkingCopyService['startStreamingCycle']>>;
    try {
      cycle = await this.workingCopy.startStreamingCycle(file, (percent) => {
        const scaled = Math.max(0, Math.min(90, Math.round(percent * 0.9)));
        this.zone.run(() => {
          this.epubLoadProgressPercent = scaled;
        });
      });
    } catch (error) {
      console.error(
        `[ECC] Native EPUB load failed during streaming copy ${JSON.stringify({
          name: file.name,
          size: file.size,
          error: this.serializeError(error),
        })}`,
      );
      this.failEpub('EPUB_ERROR_CORRUPT', file);
      return;
    }

    this.epubLoadStage = 'inspect';
    this.epubLoadProgressPercent = Math.max(92, this.epubLoadProgressPercent);

    this.sourceEpubFile = file;
    this.sourceEpubMeta = cycle.sourceMeta;
    this.workingEpubPath = cycle.workingPath;
    this.workingEpubNativePath = cycle.workingNativePath;
    this.workingEpubName = cycle.workingName;
    this.outputBaseName = cycle.outputBaseName;
    this.selectedEpubName = file.name;

    let extracted: Awaited<ReturnType<EpubRewriteService['extractCoverFile']>>;
    try {
      console.info(
        `[ECC] Native EPUB inspect started ${JSON.stringify({
          name: file.name,
          size: file.size,
          path: cycle.workingNativePath,
        })}`,
      );
      extracted = await this.epubRewrite.extractCoverFile(
        cycle.workingNativePath,
        file.name,
      );
    } catch (error) {
      console.error(
        `[ECC] Native EPUB load failed during cover extraction ${JSON.stringify(
          {
            name: file.name,
            size: file.size,
            stage: this.epubLoadStage,
            error: this.serializeError(error),
          },
        )}`,
      );

      if (
        error instanceof EpubRewriteError &&
        error.code === 'EXTRACT_READ_FAILED' &&
        !!error.details?.coverEntryPath
      ) {
        this.coverEntryPath = error.details?.coverEntryPath;
        this.clearEpubError();
        this.activateInvalidCoverFallback();
        return;
      }

      this.failEpub(this.mapNativeEpubError(error), file);
      await this.cleanupWorkingCopy();
      return;
    }

    this.coverEntryPath = extracted.coverEntryPath;
    this.clearEpubError();

    try {
      const coverLoaded = await this.applyImageSource(extracted.file, false);
      if (!coverLoaded) {
        this.activateInvalidCoverFallback();
        return;
      }
      this.epubLoadProgressPercent = 100;
    } catch (error) {
      console.warn(
        `[ECC] Native EPUB cover preview preload skipped ${JSON.stringify({
          name: file.name,
          size: file.size,
          error: this.serializeError(error),
        })}`,
      );
      this.activateInvalidCoverFallback();
    }
  }

  private failEpub(errorKey: string, file?: File) {
    this.zone.run(() => {
      this.epubErrorKey = `CHANGE.${errorKey}`;
      this.epubErrorParams = {
        maxSize: String(this.maxEpubSizeMB),
        name: file?.name || '',
      };
      this.sourceEpubFile = undefined;
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
    return !!(this.workingEpubFile || this.workingEpubNativePath) && !this.epubErrorKey;
  }

  private resetEpubLoadProgress() {
    this.epubLoadProgressPercent = 0;
    this.epubLoadStage = null;
  }

  private resetWorkflow() {
    this.selectedFormatId = this.persistedCropTargetId;
    this.closeInfo();
    this.closePreview();
    this.clearPreviewLongPress();

    // Clear image state
    this.originalImageFile = undefined;
    this.selectedImageFile = undefined;
    this.selectedImageName = undefined;
    this.selectedImageDims = undefined;
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
    this.clearImageError();
    this.clearImageWarn();

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

  private async resetWorkflowForNewEpub() {
    await this.cleanupWorkingCopy();
    this.resetWorkflow();
    this.lastEditorSessionId = undefined;
    this.editorSession.clearSessions();
    this.sourceEpubFile = undefined;
    this.sourceEpubMeta = undefined;
    this.workingEpubFile = undefined;
    this.workingEpubPath = undefined;
    this.workingEpubNativePath = undefined;
    this.workingEpubName = undefined;
    this.coverEntryPath = undefined;
    this.outputBaseName = undefined;
    this.selectedEpubName = undefined;
    this.workingMaxSideApplied = null;
  }

  private async cleanupWorkingCopy() {
    const paths = [this.generatedEpubPath, this.workingEpubPath].filter(
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
      await this.applyImageSource(file, true);
    } finally {
      this.setBusy('none');
      input.value = '';
    }
  }

  private async applyImageSource(file: File, setImageError: boolean): Promise<boolean> {
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
    this.selectedImageDims = workingDims ?? originalDims;
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

    return true;
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
    const legacyDims = legacyDimsHint ?? this.selectedImageDims ?? null;
    const exportDims =
      exportDimsHint ??
      (await this.resolveExportDimsForSmallWarn());

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

    const params = this.imagePipe.getSmallWarnParams(exportDims, target);
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

    this.imageWarnKey = 'CHANGE.IMAGE_WARN_SMALL';
    this.imageWarnParams = params;
  }

  canCrop(): boolean {
    return (
      this.hasValidEpub() &&
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

    const sid = this.editorSession.createSession({
      file: sourceFile,
      target: {
        width: selected.target.width,
        height: selected.target.height,
      },
      initialState: this.cropState,
      tools: {
        formats: {
          options: this.formatOptions,
          selectedId: selected.id,
        },
      },
      returnUrl: this.getEditorReturnUrl(),
    });

    this.lastEditorSessionId = sid;
    this.router.navigate(['/editor'], { queryParams: { sid } });
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
    const current = this.router.url;
    if (current.startsWith('/tabs/')) return current;
    return '/tabs/change';
  }

  canExport(): boolean {
    return !!this.workingImageFile && !!this.cropState && !this.imageErrorKey;
  }

  private async applyCropResult(result: EditorResult): Promise<void> {
    const newFile = result.file;
    if (!newFile) return;
    const renderedBlob = result.renderedBlob;
    this.isApplyingFromEditor = true;
    this.previewGenerationToken += 1;

    const editorSource = this.editorSourceFile ?? this.workingImageFile ?? newFile;
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
    this.targetHeight = outH ?? selected?.target.height ?? this.baseTarget.height;

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
    this.generatedEpubBytes = undefined;
    this.generatedEpubPath = undefined;
    this.generatedEpubNativePath = undefined;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;

    this.selectedImageName = newFile.name;
    if (!this.selectedImageDims) {
      const dims = await this.imagePipe.getDimensions(newFile);
      if (!dims) return this.failImage('CORRUPT', newFile);
      this.selectedImageDims = dims;
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
        this.workingImageFile = renderedFile;
        this.exportImageFile = renderedFile;
        this.selectedImageName = renderedFile.name;

        const url = URL.createObjectURL(renderedBlob);
        this.setPreviewUrl(url);
        const thumb = await this.buildThumbFromBlob(renderedBlob, ChangePage.THUMB_SIZE);
        this.setPreviewThumbUrl(thumb ?? url);
        await this.applySmallWarn('editor-apply', undefined, renderedInfo ?? undefined);
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
    }
  }

  private buildCompositionInput() {
    const sourceFile = this.editorSourceFile ?? this.workingImageFile;
    if (!sourceFile || !this.selectedImageDims) {
      return null;
    }

    const selected = this.getSelectedFormatOption();
    if (!selected) return null;

    const state = this.cropState ?? this.buildDefaultCropState();
    const rawTarget = selected.target;
    const layoutState = this.applyLayoutBase(state, rawTarget);

    return buildCompositionInput({
      file: sourceFile,
      target: { width: rawTarget.width, height: rawTarget.height },
      state: layoutState,
      naturalWidth: this.selectedImageDims.width,
      naturalHeight: this.selectedImageDims.height,
      frameFallback: { width: rawTarget.width, height: rawTarget.height },
    });
  }

  private async updatePreviewFromComposition(): Promise<void> {
    if (this.isApplyingFromEditor) return;
    if (this.renderedImageBlob) return;
    const token = ++this.previewGenerationToken;
    const input = this.buildCompositionInput();
    if (!input) return;

    const baseCanvas = await renderCompositionToCanvas(input, {
      mode: 'preview',
      outputScale: 1,
      debugLabel: 'ECC_PREVIEW',
    });
    if (!baseCanvas) return;

    const modalCanvas = this.downscaleCanvas(
      baseCanvas,
      ChangePage.PREVIEW_MAX_SIDE,
      'preview',
    );

    const blob: Blob | null = await new Promise((resolve) =>
      modalCanvas.toBlob((bb) => resolve(bb), 'image/jpeg', 0.9),
    );
    if (!blob) return;

    if (token !== this.previewGenerationToken) return;
    const url = URL.createObjectURL(blob);
    this.setPreviewUrl(url);

    const thumb = this.buildThumbFromCanvas(
      baseCanvas,
      ChangePage.THUMB_SIZE,
    );
    if (token !== this.previewGenerationToken) return;
    this.setPreviewThumbUrl(thumb ?? url);
  }

  private async ensureExportImageFile(): Promise<File | null> {
    const selected = this.getSelectedFormatOption();
    if (this.exportImageFile) {
      if (
        !this.renderedImageFile ||
        !this.renderedImageInfo ||
        this.exportImageFile !== this.renderedImageFile
      ) {
        return this.exportImageFile;
      }
      if (
        !selected ||
        (this.renderedImageInfo.formatId === selected.id &&
          this.renderedImageInfo.width === selected.target.width &&
          this.renderedImageInfo.height === selected.target.height)
      ) {
        return this.exportImageFile;
      }
      this.exportImageFile = undefined;
    }

    if (
      this.renderedImageFile &&
      this.renderedImageInfo &&
      (!selected ||
        (this.renderedImageInfo.formatId === selected.id &&
          this.renderedImageInfo.width === selected.target.width &&
          this.renderedImageInfo.height === selected.target.height))
    ) {
      this.exportImageFile = this.renderedImageFile;
      return this.renderedImageFile;
    }

    const input = this.buildCompositionInput();
    if (!input) return null;

    const file = await renderCompositionToFile(input, { mode: 'export' });
    if (!file) return null;

    this.exportImageFile = file;
    return file;
  }

  async onSave() {
    if (!this.canSaveShare()) return;

    const exportFile = await this.ensureExportImageFile();
    if (!exportFile) return;

    const currentFilename = this.generatedEpubFilename || 'epub_cover';
    const nameWithoutExt = currentFilename.replace(/\.epub$/i, '');

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
      if (filename === this.lastSavedFilename) {
        await this.showToast('CHANGE.SAVED_OK', { duration: 1600 }, 'success');
        return;
      }

      const exportFile = await this.ensureExportImageFile();
      if (!exportFile) return;

      if (this.lastSavedFilename) {
        try {
          const renamed = await this.fileService.renameGeneratedEpub({
            from: this.lastSavedFilename,
            to: filename,
          });
          this.generatedEpubFilename = renamed.filename;
          this.lastSavedFilename = renamed.filename;
        } catch {
          const saved = this.usesNativeRewrite() && this.generatedEpubPath
            ? await this.fileService.saveGeneratedEpubFromPath({
                sourcePath: this.generatedEpubPath,
                sourceDir: 'Data',
                filename,
                coverFileForThumb: exportFile,
              })
            : await this.fileService.saveGeneratedEpub({
                bytes: this.generatedEpubBytes!,
                filename,
                coverFileForThumb: exportFile,
              });
          await this.fileService.deleteGeneratedEpub(this.lastSavedFilename);
          this.generatedEpubFilename = saved.filename;
          this.lastSavedFilename = saved.filename;
        }
      } else {
        const saved = this.usesNativeRewrite() && this.generatedEpubPath
          ? await this.fileService.saveGeneratedEpubFromPath({
              sourcePath: this.generatedEpubPath,
              sourceDir: 'Data',
              filename,
              coverFileForThumb: exportFile,
            })
          : await this.fileService.saveGeneratedEpub({
              bytes: this.generatedEpubBytes!,
              filename,
              coverFileForThumb: exportFile,
            });
        this.generatedEpubFilename = saved.filename;
        this.lastSavedFilename = saved.filename;
      }

      this.coversEvents.emit({
        type: 'saved',
        filename: this.generatedEpubFilename,
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

    await this.showHintOnce(
      'cc_hint_share_kindle_shown',
      'COMMON.SHARE_KINDLE_HINT',
      2200,
    );

    this.setBusy('export', 'CHANGE.SAVING');
    try {
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
    } finally {
      this.zone.run(() => this.setBusy('none'));
    }
  }

  private failImage(err: ImageValidationError | 'CORRUPT', file: File) {
    this.resetSelectedImage();
    this.setImageError(err === 'CORRUPT' ? 'CORRUPT' : err, file);
  }

  private resetSelectedImage() {
    this.selectedImageFile = undefined;
    this.selectedImageName = undefined;
    this.selectedImageDims = undefined;
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
      this.previewNonce += 1;
    });
  }

  private setPreviewThumbUrl(url?: string) {
    this.zone.run(() => {
      this.previewThumbUrl = url;
    });
  }

  private buildDefaultCropState(): CoverCropState {
    return {
      scale: 1,
      tx: 0,
      ty: 0,
      rot: 0,
      flipX: false,
      flipY: false,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      bw: false,
      dither: false,
      backgroundMode: 'transparent',
      backgroundColor: '#000000',
      backgroundBlur: 80,
      textLayers: [],
    };
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
    label?: string,
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
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = 'high';
    dctx.drawImage(src, 0, 0, dw, dh);
    return dst;
  }

  private async loadImageFromBlob(
    blob: Blob,
  ): Promise<{
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
    const targetMime = this.coverEntryMimeType();
    if (!targetMime || !file.type || file.type === targetMime) {
      return file;
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
      this.renameFileExtension(file.name, this.coverEntryExtension() || 'jpg'),
      { type: targetMime },
    );
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
    if (!path) return;
    void this.workingCopy.cleanupWorkingCopy(path);
  }

  private activateInvalidCoverFallback() {
    this.revokePreviewUrl();
    this.setPreviewThumbUrl(undefined);
    this.originalImageFile = undefined;
    this.selectedImageFile = undefined;
    this.selectedImageName = undefined;
    this.selectedImageDims = undefined;
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

  canSaveShare(): boolean {
    const hasGeneratedOutput = this.usesNativeRewrite()
      ? !!this.generatedEpubPath
      : !!this.generatedEpubBytes;

    return (
      this.canExport() &&
      hasGeneratedOutput &&
      !!this.generatedEpubFilename &&
      !this.isExporting
    );
  }

  getChangeActionKey(): string {
    return 'CHANGE.CHANGE_ACTION_REWARDED';
  }

  async onGenerate() {
    if (!this.canGenerate()) return;

    this.setBusy('export', 'CHANGE.GENERATING');

    try {
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

      const exportFile = await this.ensureExportImageFile();
      if (!exportFile) return;

      const preferredFilename =
        this.outputBaseName ? `${this.outputBaseName}.epub` : this.selectedEpubName;

      if (this.usesNativeRewrite()) {
        await this.generateWithNativeRewrite(exportFile, preferredFilename);
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
      this.generatedEpubFilename = res.filename;

      this.setBusy('export', 'CHANGE.SAVING');

      const saved = await this.fileService.saveGeneratedEpub({
        bytes: this.generatedEpubBytes,
        filename: this.generatedEpubFilename,
        coverFileForThumb: exportFile,
      });

      this.generatedEpubFilename = saved.filename;

      this.coversEvents.emit({
        type: 'saved',
        filename: saved.filename,
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
    } finally {
      this.zone.run(() => this.setBusy('none'));
    }
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
    if (!this.workingEpubNativePath || !this.coverEntryPath) {
      throw new EpubRewriteError('REWRITE_UNAVAILABLE');
    }

    const outputBaseName = this.outputBaseName || 'epub';
    const rewriteCoverFile = await this.ensureNativeRewriteCoverFile(exportFile);
    const tempCover = await this.workingCopy.writeTempCoverFile(
      rewriteCoverFile,
      outputBaseName,
    );
    const output = await this.workingCopy.buildOutputFile(outputBaseName);

    this.isNativeRewriteInProgress = true;
    this.isCancellingNativeRewrite = false;
    this.rewriteProgressPercent = 0;

    try {
      const result = await this.epubRewrite.rewriteCover({
        inputPath: this.workingEpubNativePath,
        outputPath: output.nativePath,
        coverEntryPath: this.coverEntryPath,
        newCoverPath: tempCover.nativePath,
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
        });
      }

      const nextFilename = this.ensureEpubExtension(
        preferredFilename || `${outputBaseName}.epub`,
      );

      this.generatedEpubBytes = undefined;
      this.generatedEpubPath = output.path;
      this.generatedEpubNativePath = output.nativePath;
      this.generatedEpubFilename = nextFilename;
      this.rewriteProgressPercent = 100;

      this.setBusy('export', 'CHANGE.SAVING');

      const saved = await this.fileService.saveGeneratedEpubFromPath({
        sourcePath: this.generatedEpubPath,
        sourceDir: 'Data',
        filename: nextFilename,
        coverFileForThumb: rewriteCoverFile,
      });

      this.generatedEpubFilename = saved.filename;
      this.coversEvents.emit({
        type: 'saved',
        filename: saved.filename,
      });

      this.wasAutoSaved = true;
      this.lastSavedFilename = saved.filename;

      await this.showToast(
        'CHANGE.COVER_CHANGED',
        { duration: 2200 },
        'success',
      );
    } catch (error) {
      if (!(error instanceof EpubRewriteError) || error.code !== 'CANCELLED') {
        await this.showToast(
          this.mapNativeRewriteToastKey(error),
          { duration: 2200 },
          'error',
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
      Capacitor.getPlatform() === 'android' && this.epubRewrite.isSupported()
    );
  }

  private mapNativeEpubError(error: unknown): string {
    if (error instanceof EpubRewriteError && error.code === 'NO_COVER') {
      return 'EPUB_ERROR_NO_COVER';
    }
    return 'EPUB_ERROR_CORRUPT';
  }

  private mapNativeRewriteToastKey(error: unknown): string {
    if (
      error instanceof EpubRewriteError &&
      (error.code === 'NO_COVER' || error.code === 'COVER_NOT_FOUND')
    ) {
      return 'CHANGE.EPUB_ERROR_NO_COVER';
    }

    return 'CHANGE.EPUB_ERROR_REWRITE';
  }

  private serializeError(error: unknown): Record<string, unknown> | string {
    if (error instanceof EpubRewriteError) {
      return {
        type: 'EpubRewriteError',
        code: error.code,
        details: error.details ?? null,
        message: error.message,
      };
    }
    if (error instanceof Error) {
      return {
        type: error.name || 'Error',
        message: error.message,
        stack: error.stack ?? null,
      };
    }
    return String(error);
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

  openInfo(ev: Event) {
    ev.stopPropagation();
    this.infoEvent = ev;
    this.infoOpen = true;
  }

  toggleInfo(ev: Event) {
    ev.stopPropagation();
    if (this.infoOpen) {
      this.closeInfo();
    } else {
      this.infoEvent = ev;
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

  getPreviewRatio(): string {
    if (this.cropState?.frameWidth && this.cropState?.frameHeight) {
      return `${this.cropState.frameWidth} / ${this.cropState.frameHeight}`;
    }
    const selected = this.getSelectedFormatOption();
    if (selected) {
      return `${selected.target.width} / ${selected.target.height}`;
    }
    return '3 / 4';
  }

  ionViewWillLeave() {
    this.closeInfo();
  }

  ionViewWillEnter() {
    this.consumeEditorResult();
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

  private normalizeRenderedInfo(
    result: EditorResult,
  ): { width: number; height: number; mimeType: string; formatId?: string } | null {
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
      (this.selectedImageName ||
        this.originalImageFile?.name ||
        'cover')?.replace(/\.(png|jpg|jpeg|webp)$/i, '') || 'cover';
    return new File([blob], `${baseName}_rendered.${ext}`, { type });
  }

  private resolveFormatId(formatId?: string): string {
    if (formatId && this.formatOptions.some((option) => option.id === formatId)) {
      return formatId;
    }

    return this.formatOptions[0]?.id ?? 'epub';
  }

  private async resolveExportDimsForSmallWarn(): Promise<{
    width: number;
    height: number;
  } | null> {
    const exportFile = this.exportImageFile ?? (await this.ensureExportImageFile());
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
}
