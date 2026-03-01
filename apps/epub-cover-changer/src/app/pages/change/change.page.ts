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
import { TranslateService } from '@ngx-translate/core';
import { ToastOptions } from '@ionic/angular';
import { SaveCoverModalComponent } from './save-cover-modal.component';

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
  private imagePipe = inject(ImagePipelineService);
  private ads = inject(AdsService);
  private toastCtrl = inject(ToastController);
  private popoverCtrl = inject(PopoverController);
  private coversEvents = inject(CoversEventsService);
  private translate = inject(TranslateService);
  private zone = inject(NgZone);
  private router = inject(Router);
  private editorSession = inject(EditorSessionService);
  private readonly baseTarget = { width: 1236, height: 1648 };
  private readonly baseModelId = 'epub';
  private readonly formatOptions = this.buildFormatOptions();
  private routerSub?: Subscription;
  private lastEditorSessionId?: string;
  private previewLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressNextImagePick = false;
  private workingMaxSideApplied: boolean | null = null;

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
  workingEpubName?: string;
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
  generatedEpubFilename?: string;
  lastSavedFilename?: string;
  wasAutoSaved = false;

  infoOpen = false;
  infoEvent: Event | null = null;
  previewOpen = false;
  private isApplyingFromEditor = false;
  private previewGenerationToken = 0;

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

  ngOnInit() {
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

    this.setBusy('epub', 'CHANGE.LOADING_EPUB');

    try {
      await this.resetWorkflowForNewEpub();

      // Validate EPUB file
      const validation = this.fileService.validateEpub(file, 50);
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
      if (!extractedCover) {
        this.failEpub('EPUB_ERROR_CORRUPT', file);
        await this.cleanupWorkingCopy();
        return;
      }

      // Clear any previous errors
      this.clearEpubError();

      const coverLoaded = await this.applyImageSource(extractedCover, false);
      if (!coverLoaded) {
        this.failEpub('EPUB_ERROR_CORRUPT', file);
        await this.cleanupWorkingCopy();
        return;
      }

    } finally {
      this.setBusy('none');
      input.value = '';
    }
  }

  private failEpub(errorKey: string, file?: File) {
    this.zone.run(() => {
      this.epubErrorKey = `CHANGE.${errorKey}`;
      this.epubErrorParams = {
        maxSize: '50',
        name: file?.name || '',
      };
      this.sourceEpubFile = undefined;
      this.sourceEpubMeta = undefined;
      this.workingEpubFile = undefined;
      this.workingEpubPath = undefined;
      this.workingEpubName = undefined;
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
    return !!this.workingEpubFile && !this.epubErrorKey;
  }

  private resetWorkflow() {
    this.selectedFormatId = 'epub';
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
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;

    this.clearEpubError();
  }

  private async resetWorkflowForNewEpub() {
    await this.cleanupWorkingCopy();
    this.resetWorkflow();
    this.lastEditorSessionId = undefined;
    this.editorSession.consumeLatestResult();
    this.sourceEpubFile = undefined;
    this.sourceEpubMeta = undefined;
    this.workingEpubFile = undefined;
    this.workingEpubPath = undefined;
    this.workingEpubName = undefined;
    this.outputBaseName = undefined;
    this.selectedEpubName = undefined;
    this.workingMaxSideApplied = null;
  }

  private async cleanupWorkingCopy() {
    const path = this.workingEpubPath;
    if (!path) return;
    try {
      await this.workingCopy.cleanupWorkingCopy(path);
    } catch {
      // best effort
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

    this.applySmallWarn(originalDims);
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

  private applySmallWarn(originalDims?: { width: number; height: number }) {
    this.clearImageWarn();
    const baseDims = originalDims ?? this.selectedImageDims;
    if (!baseDims) return;

    const params = this.imagePipe.getSmallWarnParams(baseDims, {
      width: this.baseTarget.width,
      height: this.baseTarget.height,
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

    this.generatedEpubBytes = undefined;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;

    this.selectedImageName = newFile.name;
    if (!this.selectedImageDims) {
      const dims = await this.imagePipe.getDimensions(newFile);
      if (!dims) return this.failImage('CORRUPT', newFile);
      this.selectedImageDims = dims;
    }

    this.applySmallWarn();

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
        this.isApplyingFromEditor = false;
        this.zone.run(() => {
          this.previewNonce += 1;
        });
        return;
      } else {
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
          const saved = await this.fileService.saveGeneratedEpub({
            bytes: this.generatedEpubBytes!,
            filename: filename,
            coverFileForThumb: exportFile,
          });
          await this.fileService.deleteGeneratedEpub(this.lastSavedFilename);
          this.generatedEpubFilename = saved.filename;
          this.lastSavedFilename = saved.filename;
        }
      } else {
        const saved = await this.fileService.saveGeneratedEpub({
          bytes: this.generatedEpubBytes!,
          filename: filename,
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
      await this.fileService.shareGeneratedEpub({
        bytes: this.generatedEpubBytes!,
        filename: this.generatedEpubFilename!,
        title: 'EPUB Cover',
      });
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
    this.generatedEpubBytes = undefined;
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
    return (
      this.canExport() &&
      !!this.generatedEpubBytes &&
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

      const sourceEpub = this.workingEpubFile;
      const preferredFilename =
        this.outputBaseName ? `${this.outputBaseName}.epub` : this.selectedEpubName;

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

      // Show success toast ONLY when reward earned AND ad closed
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

  private async showHintOnce(
    storageKey: string,
    i18nKey: string,
    duration = 2200,
  ) {
    const shown = localStorage.getItem(storageKey);
    if (shown === 'true') return;

    await this.showToast(i18nKey, { duration }, 'success');

    localStorage.setItem(storageKey, 'true');
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
}
