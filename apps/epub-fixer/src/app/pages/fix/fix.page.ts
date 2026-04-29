import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonButtons,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  appsOutline,
  checkmarkCircle,
  documentOutline,
  helpCircleOutline,
  informationCircleOutline,
} from 'ionicons/icons';
import {
  EpubReadService,
  EpubRewriteError,
  EpubRewriteService,
  EpubWorkingCopyService,
} from '@sheldrapps/file-kit';
import {
  LoadingStateComponent,
  ScrollableBarItem,
  ScrollableButtonBarComponent,
} from '@sheldrapps/ui-theme';
import {
  RecommendedApp,
  RecommendedAppsService,
  buildHomeHeaderItems,
  handleHomeHeaderAction,
} from '@sheldrapps/recommended-apps';

@Component({
  selector: 'app-fix-page',
  standalone: true,
  templateUrl: './fix.page.html',
  styleUrls: ['./fix.page.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    IonContent,
    IonHeader,
    IonButtons,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonTitle,
    IonToolbar,
    LoadingStateComponent,
    ScrollableButtonBarComponent,
  ],
})
export class FixPage implements OnInit, OnDestroy {
  private readonly epubRead = inject(EpubReadService);
  private readonly epubRewrite = inject(EpubRewriteService);
  private readonly workingCopy = inject(EpubWorkingCopyService);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly maxEpubSizeMB = 1024;

  @ViewChild('epubInput') epubInput!: ElementRef<HTMLInputElement>;

  constructor() {
    addIcons({
      alertCircleOutline,
      appsOutline,
      checkmarkCircle,
      documentOutline,
      helpCircleOutline,
      informationCircleOutline,
    });
  }

  headerItems: ScrollableBarItem[] = [];
  recommendedApps: RecommendedApp[] = [];
  showRecommended = false;

  sourceEpubFile?: File;
  workingEpubFile?: File;
  workingEpubPath?: string;
  workingEpubNativePath?: string;
  workingEpubName?: string;
  coverEntryPath?: string;
  outputBaseName?: string;
  selectedEpubName?: string;
  coverPreviewUrl?: string;

  sourceEpubMeta?: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  };

  epubErrorKey?: string;
  epubErrorParams: Record<string, unknown> = {};
  isPickingEpub = false;
  epubLoadProgressPercent = 0;

  infoOpen = false;
  infoEvent: Event | null = null;

  get showNativeLoadOverlay(): boolean {
    return this.isPickingEpub && this.usesNativeRewrite();
  }

  get nativeLoadPercentLabel(): string {
    const percent = Math.max(
      0,
      Math.min(100, Math.round(this.epubLoadProgressPercent)),
    );
    return `${percent}%`;
  }

  async ngOnInit(): Promise<void> {
    await this.refreshHeaderItems();
  }

  ngOnDestroy(): void {
    this.closeInfo();
    this.revokeCoverPreview();
    void this.cleanupWorkingCopy();
  }

  ionViewWillEnter(): void {
    void this.refreshHeaderItems();
  }

  ionViewWillLeave(): void {
    this.closeInfo();
  }

  openEpubPicker(): void {
    if (this.usesNativeRewrite()) {
      void this.pickNativeEpub();
      return;
    }
    this.epubInput.nativeElement.click();
  }

  async onEpubSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isPickingEpub = true;
    try {
      await this.resetWorkflowForNewEpub();

      const validation = this.epubRead.validateEpub(file, this.maxEpubSizeMB);
      if (!validation.valid) {
        this.failEpub(validation.errorKey!, file);
        return;
      }

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

      const hasValidStructure = await this.epubRead.validateEpubStructure(
        this.workingEpubFile,
      );
      if (!hasValidStructure) {
        this.failEpub('EPUB_ERROR_CORRUPT', file);
        await this.cleanupWorkingCopy();
        return;
      }

      this.clearEpubError();

      const extractedCover = await this.epubRead.extractCoverFromEpubFile(
        this.workingEpubFile,
      );
      if (extractedCover) {
        this.applyCoverPreview(extractedCover);
      }
    } finally {
      this.isPickingEpub = false;
      input.value = '';
    }
  }

  hasValidEpub(): boolean {
    return !!(this.workingEpubFile || this.workingEpubNativePath) && !this.epubErrorKey;
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

  openInfo(): void {
    this.infoEvent = null;
    this.infoOpen = true;
  }

  toggleInfo(): void {
    if (this.infoOpen) {
      this.closeInfo();
      return;
    }
    this.openInfo();
  }

  closeInfo(): void {
    this.infoOpen = false;
    this.infoEvent = null;
  }

  private async refreshHeaderItems(): Promise<void> {
    this.recommendedApps = await this.recommendedAppsService.getRecommendedApps();
    this.showRecommended = this.recommendedApps.length > 0;
    this.headerItems = buildHomeHeaderItems(this.showRecommended, {
      appsLabel: this.translate.instant('ARR.TOOLS.APPS'),
      guideLabel: this.translate.instant('ARR.TOOLS.GUIDE'),
    });
  }

  private async pickNativeEpub(): Promise<void> {
    this.isPickingEpub = true;
    this.epubLoadProgressPercent = 0;

    try {
      const prepared = await this.epubRewrite.pickAndPrepareEpub({
        maxBytes: this.maxEpubSizeMB * 1024 * 1024,
      });
      await this.resetWorkflowForNewEpub();

      this.epubLoadProgressPercent = 92;
      this.sourceEpubFile = undefined;
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
      this.coverEntryPath = prepared.coverEntryPath;
      this.clearEpubError();

      if (prepared.file) {
        this.applyCoverPreview(prepared.file);
      }

      this.epubLoadProgressPercent = 100;
    } catch (error) {
      if (error instanceof EpubRewriteError && error.code === 'PICK_CANCELLED') {
        return;
      }

      this.failEpub(
        this.mapNativeEpubError(error),
        this.sourceEpubMeta,
        this.buildNativeStorageErrorParams(error),
      );
      await this.cleanupWorkingCopy();
    } finally {
      this.epubLoadProgressPercent = 0;
      this.isPickingEpub = false;
    }
  }

  private async resetWorkflowForNewEpub(): Promise<void> {
    await this.cleanupWorkingCopy();
    this.revokeCoverPreview();
    this.clearEpubError();

    this.sourceEpubFile = undefined;
    this.workingEpubFile = undefined;
    this.workingEpubPath = undefined;
    this.workingEpubNativePath = undefined;
    this.workingEpubName = undefined;
    this.coverEntryPath = undefined;
    this.outputBaseName = undefined;
    this.selectedEpubName = undefined;
    this.sourceEpubMeta = undefined;
  }

  private async cleanupWorkingCopy(): Promise<void> {
    const path = this.workingEpubPath;
    this.workingEpubPath = undefined;
    this.workingEpubNativePath = undefined;
    this.workingEpubFile = undefined;
    if (!path) return;
    await this.workingCopy.cleanupWorkingCopy(path);
  }

  private applyCoverPreview(file: File): void {
    this.revokeCoverPreview();
    this.coverPreviewUrl = URL.createObjectURL(file);
  }

  private revokeCoverPreview(): void {
    if (!this.coverPreviewUrl) return;
    URL.revokeObjectURL(this.coverPreviewUrl);
    this.coverPreviewUrl = undefined;
  }

  private failEpub(
    errorKey: string,
    file?: { name?: string },
    extraParams: Record<string, unknown> = {},
  ): void {
    this.revokeCoverPreview();
    this.epubErrorKey = `FIX.${errorKey}`;
    this.epubErrorParams = {
      maxSize: String(this.maxEpubSizeMB),
      name: file?.name || '',
      ...extraParams,
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
  }

  private clearEpubError(): void {
    this.epubErrorKey = undefined;
    this.epubErrorParams = {};
  }

  private usesNativeRewrite(): boolean {
    return this.epubRewrite.isSupported();
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
}
