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
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonLoading,
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
  KindleGroup,
  KindleModel,
  KindleModelPickerComponent,
} from '../../components/kindle-model-picker/kindle-model-picker.component';

import {
  CoverCropperModalComponent,
  CoverCropState,
  CropperResult,
  ImagePipelineService,
  ImageValidationError,
} from '@sheldrapps/image-workflow';
import type { CropTarget } from '@sheldrapps/image-workflow';

import {
  chevronDown,
  imageOutline,
  alertCircleOutline,
  checkmarkCircle,
  saveOutline,
  shareSocialOutline,
  closeCircleOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

import { FileService } from '../../services/file.service';
import { KindleCatalogService } from '../../services/kindle-catalog.service';
import { AdsService } from '../../services/ads.service';
import { playCircleOutline } from 'ionicons/icons';
import { CoversEventsService } from '../../services/covers-events.service';
import { TranslateService } from '@ngx-translate/core';
import { ToastOptions } from '@ionic/angular';
import { SaveCoverModalComponent } from './save-cover-modal.component';

/**
 * Wrapper component that adds i18n labels to CoverCropperModalComponent
 */
@Component({
  selector: 'app-cover-cropper-modal-i18n',
  standalone: true,
  imports: [TranslateModule, CoverCropperModalComponent],
  template: `
    <app-cover-cropper-modal
      [file]="file!"
      [model]="model!"
      [initialState]="initialState"
      [onReady]="onReady"
      [title]="'CROPPER.TITLE' | translate"
      [cancelLabel]="'COMMON.CANCEL' | translate"
      [doneLabel]="'COMMON.DONE' | translate"
      [loadingLabel]="'COMMON.LOADING' | translate"
      [hintLabel]="'CROPPER.HINT' | translate"
      [adjustmentsLabel]="'CROPPER.ADJUSTMENTS' | translate"
      [rotateLabel]="'CROPPER.ROTATE' | translate"
      [brightnessLabel]="'CROPPER.BRIGHTNESS' | translate"
      [saturationLabel]="'CROPPER.SATURATION' | translate"
      [contrastLabel]="'CROPPER.CONTRAST' | translate"
      [bwLabel]="'CROPPER.BW' | translate"
      [ditherLabel]="'CROPPER.DITHER' | translate"
      [frameAriaLabel]="'CROPPER.FRAME_ARIA' | translate"
      [controlsAriaLabel]="'CROPPER.CONTROLS_ARIA' | translate"
      [resetAriaLabel]="'CROPPER.RESET_ARIA' | translate"
      [zoomOutAriaLabel]="'CROPPER.ZOOM_OUT_ARIA' | translate"
      [zoomInAriaLabel]="'CROPPER.ZOOM_IN_ARIA' | translate"
      [adjustmentsAriaLabel]="'CROPPER.ADJUSTMENTS_ARIA' | translate"
    ></app-cover-cropper-modal>
  `,
})
class CoverCropperModalI18nComponent {
  file: File | undefined;
  model: CropTarget | undefined;
  initialState: CoverCropState | undefined;
  onReady: (() => void) | undefined;
}

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
    IonItem,
    IonLabel,
    IonIcon,
    IonButton,
    IonCol,
    IonRow,
    IonGrid,
    IonPopover,
  ],
  providers: [ModalController],
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
    private zone: NgZone
  ) {
    addIcons({
      chevronDown,
      checkmarkCircle,
      closeCircleOutline,
      alertCircleOutline,
      playCircleOutline,
      saveOutline,
      shareSocialOutline,
      informationCircleOutline,
      imageOutline,
    });
  }

  groups: KindleGroup[] = [];
  selectedModel?: KindleModel;

  originalImageFile?: File;
  selectedImageFile?: File;
  selectedImageName?: string;
  selectedImageDims?: { width: number; height: number };

  previewUrl?: string;
  cropState?: CoverCropState;

  imageErrorKey?: string;
  imageErrorParams: Record<string, any> = {};

  imageWarnKey?: string;
  imageWarnParams: Record<string, any> = {};

  isPickingImage = false;
  isOpeningCropper = false;
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

  async ngOnInit() {
    this.groups = await this.catalog.getGroups();
    this.selectedModel =
      this.catalog.findModelById(this.groups, 'paperwhite_2021') ??
      this.groups?.[0]?.items?.[0];
  }

  ngOnDestroy() {
    this.closeInfo();
    this.revokePreviewUrl();
  }

  private setBusy(
    kind: 'pick' | 'crop' | 'export' | 'none',
    messageKey?: string
  ) {
    this.zone.run(() => {
      this.isPickingImage = kind === 'pick';
      this.isOpeningCropper = kind === 'crop';
      this.isExporting = kind === 'export';
      this.loadingMessageKey = kind === 'none' ? undefined : messageKey;
    });
  }

  async openModelPicker() {
    const modal = await this.modalCtrl.create({
      component: KindleModelPickerComponent,
      componentProps: {
        groups: this.groups,
        selectedId: this.selectedModel?.id,
      },
      cssClass: 'kindle-modal',
      handle: true,
    });

    await modal.present();

    const res = await modal.onWillDismiss<KindleModel>();
    if (res.role === 'selected' && res.data) {
      this.selectedModel = res.data;
      this.generatedEpubBytes = undefined;
      this.generatedEpubFilename = undefined;
      this.lastSavedFilename = undefined;
      this.wasAutoSaved = false;

      if (this.selectedImageFile && this.selectedImageDims)
        this.applySmallWarn();
    }
  }

  openImagePicker() {
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

      this.applySmallWarn(originalDims);

      this.revokePreviewUrl();
      this.previewUrl = URL.createObjectURL(working);
    } finally {
      this.setBusy('none');
      input.value = '';
    }
  }

  private applySmallWarn(originalDims?: { width: number; height: number }) {
    this.clearImageWarn();
    if (!this.selectedModel) return;

    const baseDims = originalDims ?? this.selectedImageDims;
    if (!baseDims) return;

    const params = this.imagePipe.getSmallWarnParams(
      baseDims,
      { width: this.selectedModel.width, height: this.selectedModel.height }
    );
    if (!params) return;

    this.imageWarnKey = 'CREATE.IMAGE_WARN_SMALL';
    this.imageWarnParams = params;
  }

  canCrop(): boolean {
    return (
      !!this.selectedModel && !!this.workingImageFile && !this.imageErrorKey
    );
  }
  async startCrop() {
    if (!this.canCrop() || !this.selectedModel) return;

    const sourceFile = this.workingImageFile;
    if (!sourceFile) return;

    this.setBusy('crop', 'CREATE.OPENING_EDITOR');

    let markReady!: () => void;
    const readyPromise = new Promise<void>((resolve) => (markReady = resolve));

    try {
      const modal = await this.modalCtrl.create({
        component: CoverCropperModalI18nComponent,
        componentProps: {
          file: sourceFile,
          model: { width: this.selectedModel.width, height: this.selectedModel.height } as CropTarget,
          initialState: this.cropState,
          onReady: () => markReady(),
        },
        cssClass: 'cropper-modal',
        handle: true,
      });

      await modal.present();

      const dismissPromise = modal.onWillDismiss<CropperResult>();

      await Promise.race([readyPromise, dismissPromise.then(() => {})]);
      this.setBusy('none');

      const res = await dismissPromise;
      if (res.role !== 'done' || !res.data?.file) return;

      const newFile = res.data.file;
      this.cropState = res.data.state ?? this.cropState;

      const dims = await this.imagePipe.getDimensions(newFile);
      if (!dims) return this.failImage('CORRUPT', newFile);

      this.clearImageError();
      this.clearImageWarn();

      this.exportImageFile = newFile;

      this.generatedEpubBytes = undefined;
      this.generatedEpubFilename = undefined;
      this.lastSavedFilename = undefined;
      this.wasAutoSaved = false;

      this.selectedImageName = newFile.name;
      this.selectedImageDims = dims;

      this.applySmallWarn();

      this.revokePreviewUrl();
      this.previewUrl = URL.createObjectURL(newFile);
    } finally {
      this.setBusy('none');
    }
  }

  canExport(): boolean {
    return (
      !!this.selectedModel &&
      !!this.exportImageFile &&
      !this.imageErrorKey &&
      !!this.cropState
    );
  }

  async onSave() {
    if (!this.canSaveShare() || !this.exportImageFile) return;

    const currentFilename = this.generatedEpubFilename || 'kindle_cover';
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
    this.setBusy('export', 'CREATE.SAVING');
    try {
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
            coverFileForThumb: this.exportImageFile!,
          });
          await this.fileService.deleteGeneratedEpub(this.lastSavedFilename);
        }
      } else {
        await this.fileService.saveGeneratedEpub({
          bytes: this.generatedEpubBytes!,
          filename: filename,
          coverFileForThumb: this.exportImageFile!,
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
          2200
        );
      }
      return;
    }

    await this.showHintOnce(
      'cc_hint_share_kindle_shown',
      'COMMON.SHARE_KINDLE_HINT',
      2200
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
    if (!this.canGenerate() || !this.selectedModel || !this.exportImageFile)
      return;

    this.setBusy('export', 'CREATE.GENERATING');

    try {
      const ok = await this.ads.showRewarded();

      if (!ok) {
        await this.showToast(
          'CREATE.ADS_REQUIRED',
          { duration: 1800 },
          'error'
        );
        return;
      }

      const res = await this.fileService.generateEpubBytes({
        modelId: this.selectedModel.id,
        coverFile: this.exportImageFile,
        title: 'Kindle Cover',
      });

      this.generatedEpubBytes = res.bytes;
      this.generatedEpubFilename = res.filename;

      this.setBusy('export', 'CREATE.SAVING');

      await this.fileService.saveGeneratedEpub({
        bytes: this.generatedEpubBytes,
        filename: this.generatedEpubFilename,
        coverFileForThumb: this.exportImageFile,
      });

      this.coversEvents.emit({
        type: 'saved',
        filename: this.generatedEpubFilename,
      });

      this.wasAutoSaved = true;
      this.lastSavedFilename = this.generatedEpubFilename;

      await this.showToast(
        'CREATE.COVER_CREATED',
        { duration: 2200 },
        'success'
      );
    } finally {
      this.zone.run(() => this.setBusy('none'));
    }
  }

  private async showHintOnce(
    storageKey: string,
    i18nKey: string,
    duration = 2200
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

  ionViewWillLeave() {
    this.closeInfo();
  }

  private async showToast(
    messageKey: string,
    opts: Partial<ToastOptions> = {},
    variant: 'success' | 'error' | 'info' = 'success'
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


