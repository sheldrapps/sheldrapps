import {
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ElementRef,
  NgZone,
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
  CoverCropState,
  ImagePipelineService,
  ImageValidationError,
  buildCompositionInput,
  renderCompositionToCanvas,
  renderCompositionToFile,
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
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

import { FileService } from '../../services/file.service';
import { KindleCatalogService } from '../../services/kindle-catalog.service';
import { AdsService, type RewardedAdResult } from '../../services/ads.service';
import { playCircleOutline } from 'ionicons/icons';
import { CoversEventsService } from '../../services/covers-events.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastOptions } from '@ionic/angular';
import { SaveCoverModalComponent } from '@sheldrapps/ui-theme';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { CcfkSettings } from '../../settings/ccfk-settings.schema';

type EditorResult = {
  file: File;
  state?: CoverCropState;
  formatId?: string;
  renderedWidth?: number;
  renderedHeight?: number;
};

@Component({
  selector: 'app-create',
  templateUrl: './create.page.html',
  styleUrls: ['./create.page.scss'],
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
    IonCol,
    IonRow,
    IonGrid,
    IonPopover,
    IonSelect,
    IonSelectOption,
    IonModal,
  ],
})
export class CreatePage implements OnInit, OnDestroy {
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  constructor(
    private modalCtrl: ModalController,
    private fileService: FileService,
    private catalog: KindleCatalogService,
    private imagePipe: ImagePipelineService,
    private ads: AdsService,
    private toastCtrl: ToastController,
    private popoverCtrl: PopoverController,
    private coversEvents: CoversEventsService,
    private translate: TranslateService,
    private zone: NgZone,
    private settings: SettingsStore<CcfkSettings>,
    private router: Router,
    private editorSession: EditorSessionService,
  ) {
    addIcons({
      chevronDown,
      checkmarkCircle,
      closeCircleOutline,
      alertCircleOutline,
      playCircleOutline,
      saveOutline,
      shareSocialOutline,
      helpCircleOutline,
      imageOutline,
    });
  }

  groups: KindleGroup[] = [];
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
  selectedImageDims?: { width: number; height: number };

  previewUrl?: string;
  cropState?: CoverCropState;
  private lastEditorSessionId?: string;
  private routerSub?: Subscription;

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
  private readonly warnDebugKey = 'cc_warn_debug';

  async ngOnInit() {
    this.groups = await this.catalog.getGroups();

    // Load persisted settings and get the saved Kindle model ID
    const settings = await this.settings.load();
    const modelId = settings.kindleModelId || 'paperwhite_2021';

    this.selectedModel =
      this.catalog.findModelById(this.groups, modelId) ??
      this.groups?.[0]?.items?.[0];

    // Set the group based on the selected model
    if (this.selectedModel) {
      const group = this.groups.find((g) =>
        g.items.some((item) => item.id === this.selectedModel!.id),
      );
      this.selectedGroupId = group?.id;
    }

    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        if (url.startsWith('/tabs/create') || url === '/create') {
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

    if (!this.workingImageFile) return;

    // Reload selected model from persisted settings before opening editor
    const settings = await this.settings.load();
    const modelId = settings.kindleModelId || 'paperwhite_2021';
    this.selectedModel =
      this.catalog.findModelById(this.groups, modelId) ??
      this.groups?.[0]?.items?.[0];

    if (this.selectedModel) {
      const group = this.groups.find((g) =>
        g.items.some((item) => item.id === this.selectedModel!.id),
      );
      this.selectedGroupId = group?.id;
    }

    if (!this.selectedModel) return;

    const sid = this.editorSession.createSession({
      file: this.workingImageFile,
      target: {
        width: this.selectedModel.width,
        height: this.selectedModel.height,
      },
      initialState: this.cropState,
      tools: {
        kindle: {
          modelCatalog: this.groups,
          selectedGroupId: this.selectedGroupId,
          selectedModel: this.selectedModel,
          onKindleModelChange: (model: KindleDeviceModel) => {
            void this.applyExternalModelChange(model);
          },
        },
      },
    });

    this.lastEditorSessionId = sid;
    this.router.navigate(['/editor'], { queryParams: { sid } });
  }

  onGroupChange() {
    // When group changes, reset the model selection
    // and select the first model in the new group
    if (this.selectedGroupId) {
      const group = this.groups.find((g) => g.id === this.selectedGroupId);
      if (group && group.items.length > 0) {
        this.selectedModel = group.items[0];
        this.onModelChange();
      }
    }
  }

  async onModelChange() {
    await this.persistModelSelection({ applyWarn: true });
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

    // Save the selected model ID
    if (this.selectedModel?.id) {
      await this.settings.set({ kindleModelId: this.selectedModel.id });
    }

    if (opts.applyWarn && this.workingImageFile && this.selectedImageDims) {
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
      this.selectedImageDims = workingDims ?? originalDims;
      this.selectedImageName = working.name;

      await this.applySmallWarn('image-selected', originalDims);

      this.revokePreviewUrl();
      this.previewUrl = URL.createObjectURL(working);
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
    const legacyDims = legacyDimsHint ?? this.selectedImageDims ?? null;
    const exportDims =
      exportDimsHint ??
      (await this.resolveExportDimsForSmallWarn());

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
  }

  canEdit(): boolean {
    return (
      !!this.selectedModel && !!this.workingImageFile && !this.imageErrorKey
    );
  }
  canExport(): boolean {
    return (
      !!this.selectedModel &&
      !!this.workingImageFile &&
      !this.imageErrorKey &&
      !!this.cropState
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

      if (filename === this.lastSavedFilename) {
        await this.showToast('CREATE.SAVED_OK', { duration: 1600 }, 'success');
        return;
      }

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

    await this.showHintOnce(
      'cc_hint_share_kindle_shown',
      'COMMON.SHARE_KINDLE_HINT',
      2200,
    );

    this.setBusy('export', 'CREATE.SAVING');
    try {
      await this.fileService.shareGeneratedEpub({
        bytes: this.generatedEpubBytes!,
        filename: this.generatedEpubFilename!,
        title: 'Kindle Cover',
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

  canSaveShare(): boolean {
    return (
      this.canExport() &&
      !!this.generatedEpubBytes &&
      !!this.generatedEpubFilename &&
      !this.isExporting
    );
  }

  async onGenerate() {
    if (!this.canGenerate() || !this.selectedModel) return;

    this.setBusy('export', 'CREATE.GENERATING');

    try {
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

      const exportFile = await this.ensureExportImageFile();
      if (!exportFile) return;

      const res = await this.fileService.generateEpubBytes({
        modelId: this.selectedModel.id,
        coverFile: exportFile,
        title: 'Kindle Cover',
      });

      this.generatedEpubBytes = res.bytes;
      this.generatedEpubFilename = res.filename;

      this.setBusy('export', 'CREATE.SAVING');

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

      await this.zone.run(async () => {
        await this.showToast(
          'CREATE.COVER_CREATED',
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
    if (this.selectedModel) {
      return `${this.selectedModel.width} / ${this.selectedModel.height}`;
    }
    return '3 / 4';
  }

  ionViewWillLeave() {
    this.closeInfo();
  }

  ionViewWillEnter() {
    this.consumeEditorResult();
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
    if (!this.selectedImageDims) {
      const dims = await this.imagePipe.getDimensions(newFile);
      if (!dims) return this.failImage('CORRUPT', newFile);
      this.selectedImageDims = dims;
    }

    const exportDimsFromEditor = this.extractEditorExportDims(result);
    await this.applySmallWarn('editor-apply', undefined, exportDimsFromEditor);

    await this.updatePreviewFromComposition();
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
    const exportFile = this.exportImageFile ?? (await this.ensureExportImageFile());
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

  private buildCompositionInput() {
    if (
      !this.cropState ||
      !this.workingImageFile ||
      !this.selectedModel ||
      !this.selectedImageDims
    ) {
      return null;
    }

    return buildCompositionInput({
      file: this.workingImageFile,
      target: { width: this.selectedModel.width, height: this.selectedModel.height },
      state: this.cropState,
      naturalWidth: this.selectedImageDims.width,
      naturalHeight: this.selectedImageDims.height,
      frameFallback: { width: this.selectedModel.width, height: this.selectedModel.height },
    });
  }

  private async updatePreviewFromComposition(): Promise<void> {
    const input = this.buildCompositionInput();
    if (!input) return;

    const fullCanvas = await renderCompositionToCanvas(input, {
      mode: 'preview',
      outputScale: 1,
    });
    if (!fullCanvas) return;

    const modalCanvas = this.downscaleCanvas(fullCanvas, 1280);

    const blob: Blob | null = await new Promise((resolve) =>
      modalCanvas.toBlob((bb) => resolve(bb), 'image/jpeg', 0.9),
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

  private downscaleCanvas(
    src: HTMLCanvasElement,
    maxSide: number,
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
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = 'high';
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
}


