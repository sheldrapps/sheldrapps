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
import { AdsService, type RewardedAdResult } from '../../services/ads.service';
import { CoversEventsService } from '../../services/covers-events.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastOptions } from '@ionic/angular';
import { SaveCoverModalComponent } from './save-cover-modal.component';

type EditorResult = {
  file: File;
  state?: CoverCropState;
  formatId?: string;
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
  private modalCtrl = inject(ModalController);
  private fileService = inject(FileService);
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
  selectedEpubFile?: File;
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
  cropState?: CoverCropState;
  selectedFormatId = 'epub';

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
      // Validate EPUB file
      const validation = this.fileService.validateEpub(file, 50);
      if (!validation.valid) {
        this.failEpub(validation.errorKey!, file);
        return;
      }

      const hasValidStructure = await this.fileService.validateEpubStructure(file);
      if (!hasValidStructure) {
        this.failEpub('EPUB_ERROR_CORRUPT', file);
        return;
      }

      const extractedCover = await this.fileService.extractCoverFromEpubFile(file);
      if (!extractedCover) {
        this.failEpub('EPUB_ERROR_CORRUPT', file);
        return;
      }

      // Clear any previous errors
      this.clearEpubError();

      // Reset the entire workflow when EPUB changes
      this.resetWorkflow();

      // Store EPUB file
      this.selectedEpubFile = file;
      this.selectedEpubName = file.name;

      const coverLoaded = await this.applyImageSource(extractedCover, false);
      if (!coverLoaded) {
        this.failEpub('EPUB_ERROR_CORRUPT', file);
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
      this.selectedEpubFile = undefined;
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
    return !!this.selectedEpubFile && !this.epubErrorKey;
  }

  private resetWorkflow() {
    // Clear image state
    this.originalImageFile = undefined;
    this.selectedImageFile = undefined;
    this.selectedImageName = undefined;
    this.selectedImageDims = undefined;
    this.workingImageFile = undefined;
    this.exportImageFile = undefined;
    this.cropState = undefined;
    this.revokePreviewUrl();
    this.clearImageError();
    this.clearImageWarn();

    // Clear generation state
    this.generatedEpubBytes = undefined;
    this.generatedEpubFilename = undefined;
    this.lastSavedFilename = undefined;
    this.wasAutoSaved = false;
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

    const workingDims = await this.imagePipe.getDimensions(working);
    this.selectedImageDims = workingDims ?? originalDims;
    this.selectedImageName = working.name;

    this.applySmallWarn(originalDims);

    this.revokePreviewUrl();
    this.previewUrl = URL.createObjectURL(working);

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
    return this.hasValidEpub() && !!this.workingImageFile && !this.imageErrorKey;
  }
  async startCrop() {
    if (!this.canCrop()) return;

    const sourceFile = this.workingImageFile;
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

    if (result.formatId) {
      this.selectedFormatId = result.formatId;
    }

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
    if (!this.selectedImageDims) {
      const dims = await this.imagePipe.getDimensions(newFile);
      if (!dims) return this.failImage('CORRUPT', newFile);
      this.selectedImageDims = dims;
    }

    this.applySmallWarn();

    await this.updatePreviewFromComposition();
  }

  private computeBaseScale(
    frameW: number,
    frameH: number,
    naturalW: number,
    naturalH: number,
    rot: number,
  ): number {
    const rr = (((rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    const rnW = rr === 90 || rr === 270 ? naturalH : naturalW;
    const rnH = rr === 90 || rr === 270 ? naturalW : naturalH;
    const needW = frameW / rnW;
    const needH = frameH / rnH;
    return Math.max(needW, needH);
  }

  private resolveOutputTarget(
    target: CropTarget,
    frameW: number,
    frameH: number,
    baseScale: number,
    naturalW: number,
    naturalH: number,
    state: CoverCropState,
  ): CropTarget {
    if (target.output !== 'source') return target;

    const dispScale = baseScale * state.scale;
    if (!Number.isFinite(dispScale) || dispScale <= 0) return target;

    const rr = (((state.rot % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    const rotW = rr === 90 || rr === 270 ? naturalH : naturalW;
    const rotH = rr === 90 || rr === 270 ? naturalW : naturalH;

    let sWidthR = Math.floor(frameW / dispScale);
    let sHeightR = Math.floor(frameH / dispScale);

    sWidthR = Math.min(sWidthR, rotW);
    sHeightR = Math.min(sHeightR, rotH);

    return {
      ...target,
      width: Math.max(1, Math.round(sWidthR)),
      height: Math.max(1, Math.round(sHeightR)),
    };
  }

  private buildCompositionInput() {
    if (!this.cropState || !this.workingImageFile || !this.selectedImageDims) {
      return null;
    }

    const selected = this.getSelectedFormatOption();
    if (!selected) return null;

    const rawTarget = selected.target;
    const frameW = this.cropState.frameWidth ?? rawTarget.width;
    const frameH = this.cropState.frameHeight ?? rawTarget.height;
    if (!frameW || !frameH) return null;

    const baseScale = this.computeBaseScale(
      frameW,
      frameH,
      this.selectedImageDims.width,
      this.selectedImageDims.height,
      this.cropState.rot,
    );

    const target = this.resolveOutputTarget(
      rawTarget,
      frameW,
      frameH,
      baseScale,
      this.selectedImageDims.width,
      this.selectedImageDims.height,
      this.cropState,
    );

    return {
      file: this.workingImageFile,
      target,
      frameWidth: frameW,
      frameHeight: frameH,
      baseScale,
      naturalWidth: this.selectedImageDims.width,
      naturalHeight: this.selectedImageDims.height,
      state: this.cropState,
    };
  }

  private async updatePreviewFromComposition(): Promise<void> {
    const input = this.buildCompositionInput();
    if (!input) return;

    const maxSide = 640;
    const scale =
      maxSide > 0
        ? Math.min(
            1,
            maxSide / Math.max(input.target.width, input.target.height),
          )
        : 1;

    const canvas = await renderCompositionToCanvas(input, {
      mode: 'preview',
      outputScale: scale,
    });
    if (!canvas) return;

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((bb) => resolve(bb), 'image/jpeg', 0.9),
    );
    if (!blob) return;

    this.revokePreviewUrl();
    this.previewUrl = URL.createObjectURL(blob);
  }

  private async ensureExportImageFile(): Promise<File | null> {
    if (this.exportImageFile) return this.exportImageFile;

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
          await this.fileService.renameGeneratedEpub({
            from: this.lastSavedFilename,
            to: filename,
          });
        } catch {
          await this.fileService.saveGeneratedEpub({
            bytes: this.generatedEpubBytes!,
            filename: filename,
            coverFileForThumb: exportFile,
          });
          await this.fileService.deleteGeneratedEpub(this.lastSavedFilename);
        }
      } else {
        await this.fileService.saveGeneratedEpub({
          bytes: this.generatedEpubBytes!,
          filename: filename,
          coverFileForThumb: exportFile,
        });
      }

      this.generatedEpubFilename = filename;
      this.lastSavedFilename = filename;

      this.coversEvents.emit({
        type: 'saved',
        filename: filename,
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

      const sourceEpub = this.selectedEpubFile;
      const preferredFilename = this.selectedEpubName;

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

      await this.fileService.saveGeneratedEpub({
        bytes: this.generatedEpubBytes,
        filename: this.generatedEpubFilename,
        coverFileForThumb: exportFile,
      });

      this.coversEvents.emit({
        type: 'saved',
        filename: this.generatedEpubFilename,
      });

      this.wasAutoSaved = true;
      this.lastSavedFilename = this.generatedEpubFilename;

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
}
