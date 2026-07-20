import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonButton,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { AdsService, BillingService } from '@sheldrapps/ads-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import {
  getCoverExportOptions,
  normalizeExportQualityMode,
  type ExportQualityMode,
} from '@sheldrapps/export-quality-kit';
import {
  BestCandidatePickerComponent,
  BestCandidateService,
  type BestCandidateImage,
  type BestCandidateResult,
} from '@sheldrapps/best-candidate-kit';
import {
  CoverImageStateComponent,
  CoverSourceActionsComponent,
  ImagePipelineService,
  PreviewEditingPageService,
  buildDefaultCoverCropState,
  type CoverCropState,
  type CropFormatOption,
  type CropTarget,
  type CropperResult,
} from '@sheldrapps/image-workflow';
import {
  EditorSessionService,
  consumeEditorResultSnapshot,
} from '@sheldrapps/image-workflow/editor';
import {
  ActionCardComponent,
  FilePickerPanelComponent,
  TripleButtonComponent,
  type FilePickerPanelItem,
  type FilePickerPanelRemoveEvent,
  type FilePickerPanelReorderEvent,
} from '@sheldrapps/ui-theme';
import { addIcons } from 'ionicons';
import { optionsOutline, sparklesOutline } from 'ionicons/icons';
import {
  EpubRewriteError,
  EpubRewriteService,
  EpubWorkingCopyService,
  FileKitService,
} from '@sheldrapps/file-kit';
import { filter, Subscription } from 'rxjs';
import { MergeCoverCandidateService } from '../../services/merge-cover-candidate.service';
import { EpubLibraryService } from '../../services/epub-library.service';
import { EpubMergerAndSplitterSettings } from '../../settings/epub-merger-and-splitter-settings.schema';

type HomeMode = 'merge' | 'split';
type CoverSourceMode = 'candidate' | 'image' | 'scratch';
type EditorSourceMode = 'image' | 'scratch';
type TocMode = 'books-and-chapters' | 'books-only' | 'full-index';

type SelectedEpubInput = {
  id: string;
  sessionId: string | null;
  selectedName: string;
  sourceSize: number;
  sourceLastModified: number;
  sourceMimeType: string;
  workingPath: string;
  workingName: string;
  workingFile: File | null;
  workingNativePath: string | null;
  outputBaseName: string;
  sourceKind: 'native' | 'web';
};

const EPUB_ACCEPT = '.epub,application/epub+zip';
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const MAX_EPUB_SIZE_MB = 1024;
const EPUB_COVER_TARGET = { width: 1236, height: 1648 };
const COVER_THUMB_SIZE = 96;

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    TranslateModule,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonButton,
    IonIcon,
    IonTitle,
    IonToolbar,
    ActionCardComponent,
    BestCandidatePickerComponent,
    CoverImageStateComponent,
    CoverSourceActionsComponent,
    TripleButtonComponent,
    FilePickerPanelComponent,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly fileKit = inject(FileKitService);
  private readonly epubRewrite = inject(EpubRewriteService);
  private readonly epubWorkingCopy = inject(EpubWorkingCopyService);
  private readonly epubLibrary = inject(EpubLibraryService);
  private readonly imagePipeline = inject(ImagePipelineService);
  private readonly previewEditingPage = inject(PreviewEditingPageService);
  private readonly editorSession = inject(EditorSessionService);
  private readonly bestCandidate = inject(BestCandidateService);
  private readonly mergeCoverCandidate = inject(MergeCoverCandidateService);
  private readonly settings = inject(
    SettingsStore<EpubMergerAndSplitterSettings>,
  );
  private readonly ads = inject(AdsService);
  private readonly billing = inject(BillingService);
  private readonly candidateBlobUrls = new Set<string>();

  @ViewChild('mergeInput') private mergeInput?: ElementRef<HTMLInputElement>;
  @ViewChild('splitInput') private splitInput?: ElementRef<HTMLInputElement>;
  @ViewChild('coverImageInput')
  private coverImageInput?: ElementRef<HTMLInputElement>;

  readonly selectedMode = signal<HomeMode | null>(null);
  readonly mergeIconSvg = signal<string | null>(null);
  readonly splitIconSvg = signal<string | null>(null);
  readonly mergeSelections = signal<readonly SelectedEpubInput[]>([]);
  readonly splitSelection = signal<SelectedEpubInput | null>(null);
  readonly coverCandidates = signal<BestCandidateResult[]>([]);
  readonly selectedCoverCandidateId = signal<string | undefined>(undefined);
  readonly coverSourceMode = signal<CoverSourceMode | null>(null);
  readonly bestCandidateDismissed = signal(false);
  readonly mergeCoverPreviewUrl = signal<string | undefined>(undefined);
  readonly mergeCoverPreviewRevision = signal(0);
  exportQualityMode: ExportQualityMode = 'compressed';
  tocMode: TocMode = 'books-and-chapters';
  readonly pickerErrorKey = signal<string | null>(null);
  readonly isPicking = signal(false);
  readonly isDetectingCoverCandidates = signal(false);
  readonly isMergeActionBusy = signal(false);
  adsRemoved = false;
  readonly epubAccept = EPUB_ACCEPT;
  readonly imageAccept = IMAGE_ACCEPT;
  readonly mergePickerItems = computed<readonly FilePickerPanelItem[]>(() =>
    this.mergeSelections().map((selection) => ({
      id: selection.id,
      title: selection.selectedName,
    })),
  );
  private readonly formatOptions = this.buildFormatOptions();
  private routerSub?: Subscription;
  private adsRemovedSub?: Subscription;
  private lastEditorSessionId?: string;
  private lastEditorSourceMode: EditorSourceMode = 'image';
  private mergeCoverSourceFile?: File;
  private mergeCoverWorkingFile?: File;
  private mergeCoverRenderedBlob?: Blob;
  private mergeCoverRenderedFile?: File;
  private mergeCoverCropState?: CoverCropState;
  private mergeCoverFormatId = 'epub';
  private mergeCoverPreviewThumbUrl?: string;

  getPageTitleKey(): string {
    if (!this.hasLoadedFiles()) {
      return 'TABS.HOME';
    }

    if (this.mergeSelections().length > 0 && this.selectedMode() === 'merge') {
      return 'HOME.MERGING_TITLE';
    }

    if (this.splitSelection() && this.selectedMode() === 'split') {
      return 'HOME.SPLITTING_TITLE';
    }

    return 'TABS.HOME';
  }

  hasLoadedFiles(): boolean {
    return this.mergeSelections().length > 0 || !!this.splitSelection();
  }

  getCoverSourceSuggestedAction(): 'image' | 'scratch' | null {
    const mode = this.coverSourceMode();
    return mode === 'image' || mode === 'scratch' ? mode : null;
  }

  canAdjustMergeCover(): boolean {
    return !!this.mergeCoverPreviewUrl() && !!this.mergeCoverWorkingFile;
  }

  async startMergeCoverAdjustment(): Promise<void> {
    if (!this.canAdjustMergeCover() || this.isPicking()) {
      return;
    }

    await this.openEditor(
      this.lastEditorSourceMode === 'scratch' ? 'scratch' : 'image',
    );
  }

  shouldShowBestCandidatePicker(): boolean {
    return (
      !this.bestCandidateDismissed() &&
      (this.isDetectingCoverCandidates() || this.coverCandidates().length > 0)
    );
  }

  async cancelWorkflow(): Promise<void> {
    if (this.isPicking()) {
      return;
    }

    this.clearPickerError();
    this.closePreview();
    this.selectedMode.set(null);
    this.resetFileInput(this.mergeInput?.nativeElement);
    this.resetFileInput(this.splitInput?.nativeElement);
    this.resetCoverSelection(true);
    await this.cleanupAllSelections();
  }

  constructor() {
    addIcons({ optionsOutline, sparklesOutline });
    void this.loadIcons();
  }

  ngOnInit(): void {
    void this.hydrateAdsState();
    void this.loadExportQualitySettings();
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        if (url.startsWith('/tabs/home')) {
          void this.consumeEditorResult();
        }
      });

    void this.consumeEditorResult();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.adsRemovedSub?.unsubscribe();
    this.resetCoverSelection(true);
    void this.cleanupAllSelections();
  }

  async onMergeButtonClick(): Promise<void> {
    if (this.isMergeActionBusy() || this.isPicking()) return;

    this.isMergeActionBusy.set(true);
    try {
      if (!this.adsRemoved) {
        const result = await this.ads.showRewarded();
        if (!result.rewardEarned || !result.adClosed) return;
      }

      await this.runMerge();
    } catch (error) {
      console.error('[epub-merger-and-splitter] merge failed', error);
      this.pickerErrorKey.set('HOME.INPUT_ERROR_CORRUPT');
    } finally {
      this.isMergeActionBusy.set(false);
    }
  }

  private async hydrateAdsState(): Promise<void> {
    this.adsRemoved = this.billing.isAdsRemoved();
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe((value) => {
      this.adsRemoved = value;
    });
    await this.billing.hydrateCachedState();
    this.adsRemoved = this.billing.isAdsRemoved();
  }

  private async runMerge(): Promise<void> {
    const selections = this.mergeSelections();
    const cover = this.mergeCoverRenderedFile;
    if (selections.length < 2 || !cover || !this.epubRewrite.isSupported()) {
      throw new Error('MERGE_UNAVAILABLE');
    }

    const inputs = selections.map((selection) => {
      if (!selection.workingNativePath) {
        throw new Error('MERGE_SOURCE_PATH_MISSING');
      }
      return {
        id: selection.id,
        path: selection.workingNativePath,
        name: selection.selectedName,
      };
    });
    const outputBaseName = `${selections[0]?.outputBaseName ?? 'merged'}_merged`;
    const [output, coverTemp] = await Promise.all([
      this.epubWorkingCopy.buildOutputFile(outputBaseName),
      this.epubWorkingCopy.writeTempCoverFile(cover, outputBaseName),
    ]);

    try {
      await this.epubRewrite.preflightMerge(inputs);
      const merged = await this.epubRewrite.mergeEpubs({
        inputs,
        outputPath: output.nativePath,
        outputName: outputBaseName,
        tocMode: this.tocMode,
        coverPath: coverTemp.nativePath,
      });
      await this.epubLibrary.saveExportedEpub(
        merged.outputPath,
        merged.outputName,
      );
      await this.router.navigateByUrl('/tabs/my-epubs');
    } finally {
      await Promise.allSettled([
        this.epubWorkingCopy.cleanupWorkingCopy(output.path),
        this.epubWorkingCopy.cleanupWorkingCopy(coverTemp.path),
      ]);
    }
  }

  async openMergePicker(): Promise<void> {
    if (this.isPicking()) {
      return;
    }

    this.clearPickerError();
    this.mergeInput?.nativeElement.click();
  }

  async openSplitPicker(): Promise<void> {
    if (this.isPicking()) {
      return;
    }

    this.clearPickerError();

    if (this.epubRewrite.isSupported()) {
      await this.pickNativeEpubForSplit();
      return;
    }

    this.splitInput?.nativeElement.click();
  }

  async onMergeFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);
    this.resetFileInput(input);

    if (files.length === 0 || this.isPicking()) {
      return;
    }

    this.clearPickerError();
    this.isPicking.set(true);

    try {
      const selections: SelectedEpubInput[] = [];
      for (const file of files) {
        selections.push(await this.prepareWebSelection(file));
      }
      this.mergeSelections.update((current) => [...current, ...selections]);
      this.selectedMode.set('merge');
      await this.refreshMergeCoverCandidates();
    } catch (error) {
      this.handlePickerError(error);
    } finally {
      this.isPicking.set(false);
    }
  }

  async onSplitFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.resetFileInput(input);

    if (!file || this.isPicking()) {
      return;
    }

    this.clearPickerError();
    this.isPicking.set(true);

    try {
      const selection = await this.prepareWebSelection(file);
      await this.replaceSplitSelection(selection);
    } catch (error) {
      this.handlePickerError(error);
    } finally {
      this.isPicking.set(false);
    }
  }

  async onMergeItemsReordered(event: FilePickerPanelReorderEvent): Promise<void> {
    if (event.from === event.to) {
      return;
    }

    this.mergeSelections.update((current) => {
      const next = [...current];
      const [moved] = next.splice(event.from, 1);
      if (!moved) {
        return current;
      }
      next.splice(event.to, 0, moved);
      return next;
    });

    await this.refreshMergeCoverCandidates();
  }

  async onMergeItemRemoved(event: FilePickerPanelRemoveEvent): Promise<void> {
    const selection = this.mergeSelections().find(
      (item) => item.id === event.id,
    );

    if (!selection) {
      return;
    }

    this.mergeSelections.update((current) =>
      current.filter((item) => item.id !== event.id),
    );

    if (this.mergeSelections().length === 0) {
      this.selectedMode.set(null);
      this.clearPickerError();
      this.resetFileInput(this.mergeInput?.nativeElement);
      this.resetCoverSelection(true);
    } else {
      await this.refreshMergeCoverCandidates();
    }

    await this.cleanupSelection(selection);
  }

  async onBestCandidateSelected(candidate: BestCandidateImage): Promise<void> {
    if (this.isDetectingCoverCandidates() || this.isPicking()) {
      return;
    }

    this.bestCandidateDismissed.set(true);
    this.isPicking.set(true);
    try {
      const loaded = await this.applyCandidateCover(candidate);
      if (!loaded) {
        this.bestCandidateDismissed.set(false);
        return;
      }

      this.selectedCoverCandidateId.set(candidate.id);
      this.coverSourceMode.set('candidate');
      await this.openEditor('image');
    } finally {
      this.isPicking.set(false);
    }
  }

  onBestCandidatePreviewRequested(candidate: BestCandidateImage): void {
    if (this.isPicking() || this.isDetectingCoverCandidates()) {
      return;
    }

    const src = candidate.src?.trim();
    if (!src) {
      return;
    }

    this.previewEditingPage.open({
      imageSrc: src,
      imageWidth: candidate.width,
      imageHeight: candidate.height,
      titleKey: 'BEST_CANDIDATE.PREVIEW.TITLE',
      returnUrl: '/tabs/home',
    });
    void this.router.navigateByUrl('/preview-editing');
  }

  onCoverImageSelected(): void {
    if (this.isPicking()) {
      return;
    }

    this.coverImageInput?.nativeElement.click();
  }

  openPreview(): void {
    if (!this.mergeCoverPreviewUrl()) {
      return;
    }

    this.previewEditingPage.open({
      imageSrc: this.mergeCoverPreviewUrl() ?? null,
      returnUrl: '/tabs/home',
    });
    void this.router.navigateByUrl('/preview-editing');
  }

  closePreview(): void {
    this.previewEditingPage.clear();
  }

  async onCoverScratchSelected(): Promise<void> {
    if (this.isPicking()) {
      return;
    }

    this.bestCandidateDismissed.set(true);
    this.coverSourceMode.set('scratch');
    this.selectedCoverCandidateId.set(undefined);
    await this.openEditor('scratch');
  }

  async onCoverImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.resetFileInput(input);

    if (!file || this.isPicking()) {
      return;
    }

    this.isPicking.set(true);
    try {
      const loaded = await this.applyMergeCoverSource(file);
      if (!loaded) {
        return;
      }
      this.coverSourceMode.set('image');
      this.bestCandidateDismissed.set(true);
      this.selectedCoverCandidateId.set(undefined);
      await this.openEditor('image');
    } finally {
      this.isPicking.set(false);
    }
  }

  private async refreshMergeCoverCandidates(): Promise<void> {
    this.isDetectingCoverCandidates.set(true);
    this.resetCandidateBlobUrls();
    const previousCoverMode = this.coverSourceMode();
    const previousCandidateId = this.selectedCoverCandidateId();

    try {
      const sources = this.mergeSelections()
        .map((selection, index) => ({
          epubId: selection.id,
          epubName: selection.selectedName,
          epubFile: selection.workingFile,
          order: index + 1,
        }))
        .filter(
          (source): source is {
            epubId: string;
            epubName: string;
            epubFile: File;
            order: number;
          } => !!source.epubFile,
        );
      const images = await this.mergeCoverCandidate.collectCandidates(sources);

      for (const image of images) {
        if (image.src.startsWith('blob:')) {
          this.candidateBlobUrls.add(image.src);
        }
      }

      const ranked = this.bestCandidate.rankCandidates(images, {
        maxCandidates: 3,
      });
      this.coverCandidates.set(ranked);

      if (previousCoverMode === 'image' || previousCoverMode === 'scratch') {
        this.selectedCoverCandidateId.set(undefined);
        return;
      }

      const selectedCandidate =
        ranked.find((candidate) => candidate.image.id === previousCandidateId)
          ?.image ?? ranked[0]?.image;

      this.selectedCoverCandidateId.set(selectedCandidate?.id);
      this.coverSourceMode.set(selectedCandidate ? 'candidate' : null);
      if (selectedCandidate) {
        await this.applyCandidateCover(selectedCandidate);
      } else {
        this.resetMergeCoverSelection(true);
      }
    } catch (error) {
      console.warn(
        '[epub-merger-and-splitter] failed to detect merge cover candidates',
        error,
      );
      this.coverCandidates.set([]);
      this.selectedCoverCandidateId.set(undefined);
      if (previousCoverMode !== 'image' && previousCoverMode !== 'scratch') {
        this.coverSourceMode.set(null);
        this.resetMergeCoverSelection(true);
      }
    } finally {
      this.isDetectingCoverCandidates.set(false);
    }
  }

  private resetCoverSelection(revokeUrls: boolean): void {
    this.coverCandidates.set([]);
    this.selectedCoverCandidateId.set(undefined);
    this.coverSourceMode.set(null);
    this.bestCandidateDismissed.set(false);
    this.isDetectingCoverCandidates.set(false);
    this.resetMergeCoverSelection(revokeUrls);

    if (revokeUrls) {
      this.resetCandidateBlobUrls();
    }
  }

  private resetCandidateBlobUrls(): void {
    for (const url of this.candidateBlobUrls) {
      URL.revokeObjectURL(url);
    }
    this.candidateBlobUrls.clear();
  }

  private async applyCandidateCover(
    candidate: BestCandidateImage,
  ): Promise<boolean> {
    const file = this.candidateFileFromMetadata(candidate);
    if (!file) {
      return false;
    }

    return this.applyMergeCoverSource(file);
  }

  private async applyMergeCoverSource(file: File): Promise<boolean> {
    this.mergeCoverCropState = undefined;
    this.mergeCoverRenderedBlob = undefined;
    this.mergeCoverRenderedFile = undefined;

    const source = await this.prepareEditorImageSource(file);
    if (!source) {
      return false;
    }

    this.mergeCoverSourceFile = source.source;
    this.mergeCoverWorkingFile = source.workingFile;
    this.setMergeCoverPreviewUrl(URL.createObjectURL(source.workingFile));
    this.mergeCoverPreviewThumbUrl = this.mergeCoverPreviewUrl();
    return true;
  }

  private async prepareEditorImageSource(
    file: File,
  ): Promise<{ source: File; workingFile: File } | null> {
    if (this.imagePipeline.validateBasic(file)) {
      return null;
    }

    let source = await this.imagePipeline.materializeFile(file);
    let sourceDims = await this.imagePipeline.getDimensions(source);
    if (!sourceDims) {
      const normalized = await this.imagePipeline.normalizeFile(source);
      if (normalized) {
        source = normalized;
        sourceDims = await this.imagePipeline.getDimensions(source);
      }
    }

    if (!sourceDims) {
      return null;
    }

    return {
      source,
      workingFile: await this.imagePipeline.prepareWorkingImage(source),
    };
  }

  private async openEditor(sourceMode: EditorSourceMode): Promise<void> {
    const selected = this.getSelectedFormatOption();
    const sourceFile =
      sourceMode === 'image' ? this.mergeCoverWorkingFile : undefined;
    if (sourceMode === 'image' && !sourceFile) {
      return;
    }

    const sid = this.editorSession.createSession({
      file: sourceFile,
      sourceMode,
      target: {
        width: selected.target.width,
        height: selected.target.height,
      },
      initialState:
        sourceMode === 'scratch'
          ? this.buildDefaultCropState()
          : this.mergeCoverCropState,
      tools: {
        formats: {
          options: this.formatOptions,
          selectedId: selected.id,
        },
        eReaderOptimization: {
          enabled: true,
        },
      },
      output: {
        includeRenderedBlob: true,
      },
      onResultApplied: async (result) => {
        await this.applyEditorResult(result);
        const appliedSessionId = this.lastEditorSessionId;
        if (appliedSessionId) this.editorSession.consumeResult(appliedSessionId);
        this.lastEditorSessionId = undefined;
      },
      preferences: {
        artifactReductionInfo: {
          hasSeen: async () =>
            this.readLocalPreference(
              'epub_merger_and_splitter_artifact_reduction_info_seen',
            ),
          markSeen: async () =>
            this.writeLocalPreference(
              'epub_merger_and_splitter_artifact_reduction_info_seen',
            ),
        },
      },
      returnUrl: '/tabs/home',
    });

    this.lastEditorSourceMode = sourceMode;
    this.lastEditorSessionId = sid;
    const entryPath = sourceMode === 'scratch' ? '/editor/tools' : '/editor';
    await this.router.navigate([entryPath], { queryParams: { sid } });
  }

  private async consumeEditorResult(sessionId?: string): Promise<void> {
    const { result } = consumeEditorResultSnapshot(
      this.editorSession,
      sessionId ?? this.lastEditorSessionId,
    );

    if (result) {
      this.lastEditorSessionId = undefined;
    }

    if (result?.file) {
      await this.applyEditorResult(result);
    }
  }

  private async applyEditorResult(result: CropperResult): Promise<void> {
    this.mergeCoverWorkingFile = result.file;
    this.mergeCoverRenderedBlob = result.renderedBlob ?? result.file;
    this.mergeCoverCropState = result.state;
    this.mergeCoverFormatId = this.resolveFormatId(result.formatId);
    this.coverSourceMode.set(this.lastEditorSourceMode);
    this.bestCandidateDismissed.set(true);
    this.selectedCoverCandidateId.set(undefined);

    const renderedBlob = result.renderedBlob;
    if (renderedBlob) {
      this.mergeCoverRenderedFile = this.buildRenderedFile(
        renderedBlob,
        result.renderedMimeType,
      );
      this.setMergeCoverPreviewUrl(URL.createObjectURL(renderedBlob));
      this.mergeCoverPreviewThumbUrl =
        (await this.buildThumbFromBlob(renderedBlob)) ??
        this.mergeCoverPreviewUrl();
      await this.applySelectedExportQuality();
      return;
    }

    this.setMergeCoverPreviewUrl(URL.createObjectURL(result.file));
    this.mergeCoverPreviewThumbUrl = this.mergeCoverPreviewUrl();
    await this.applySelectedExportQuality();
  }

  getEffectiveExportQualityMode(): ExportQualityMode {
    return normalizeExportQualityMode(this.exportQualityMode, false);
  }

  async onExportQualityModeSelect(mode: ExportQualityMode): Promise<void> {
    const normalized = normalizeExportQualityMode(mode, false);
    if (normalized !== mode) {
      return;
    }

    this.exportQualityMode = normalized;
    await this.settings.setForScope('exportQuality', {
      exportQualityMode: normalized,
    });
    await this.applySelectedExportQuality();
  }

  async onTripleExportQualityModeSelect(value: string): Promise<void> {
    if (value !== 'thumbnail' && value !== 'compressed' && value !== 'best') {
      return;
    }

    await this.onExportQualityModeSelect(value);
  }

  onTocModeChange(value: string): void {
    if (
      value === 'books-and-chapters' ||
      value === 'books-only' ||
      value === 'full-index'
    ) {
      this.tocMode = value;
    }
  }

  private async loadExportQualitySettings(): Promise<void> {
    const settings = await this.settings.load();
    this.exportQualityMode = normalizeExportQualityMode(
      settings.exportQualityMode,
      false,
    );
  }

  private async applySelectedExportQuality(): Promise<void> {
    const source = this.mergeCoverRenderedBlob;
    if (!source) {
      return;
    }

    const options = getCoverExportOptions(this.getEffectiveExportQualityMode());
    const bitmap = await createImageBitmap(source);
    try {
      const scale = options.maxDimension
        ? Math.min(1, options.maxDimension / Math.max(bitmap.width, bitmap.height))
        : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      if (options.mimeType === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, options.mimeType, options.quality),
      );
      if (!blob) {
        return;
      }

      this.mergeCoverRenderedFile = new File(
        [blob],
        `cover.${options.extension}`,
        { type: options.mimeType },
      );
    } finally {
      bitmap.close();
    }
  }

  private buildRenderedFile(blob: Blob, mimeType?: string): File {
    const type = mimeType || blob.type || 'image/png';
    const ext = type === 'image/png' ? 'png' : 'jpg';
    const sourceName =
      this.mergeCoverWorkingFile?.name ||
      this.mergeCoverSourceFile?.name ||
      'cover';
    const baseName =
      sourceName.replace(/\.(png|jpg|jpeg|webp)$/i, '') || 'cover';
    return new File([blob], `${baseName}_rendered.${ext}`, { type });
  }

  private setMergeCoverPreviewUrl(url?: string): void {
    this.revokeMergeCoverPreviewUrl();
    this.mergeCoverPreviewUrl.set(url);
    this.mergeCoverPreviewRevision.update((revision) => revision + 1);
  }

  private resetMergeCoverSelection(revokeUrl: boolean): void {
    this.mergeCoverSourceFile = undefined;
    this.mergeCoverWorkingFile = undefined;
    this.mergeCoverRenderedBlob = undefined;
    this.mergeCoverRenderedFile = undefined;
    this.mergeCoverCropState = undefined;
    this.mergeCoverFormatId = 'epub';
    this.mergeCoverPreviewThumbUrl = undefined;
    this.lastEditorSessionId = undefined;

    if (revokeUrl) {
      this.revokeMergeCoverPreviewUrl();
    }

    this.mergeCoverPreviewUrl.set(undefined);
    this.mergeCoverPreviewRevision.update((revision) => revision + 1);
  }

  private revokeMergeCoverPreviewUrl(): void {
    const url = this.mergeCoverPreviewUrl();
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  private candidateFileFromMetadata(
    candidate: BestCandidateImage,
  ): File | null {
    const candidateFile = candidate.metadata?.['file'];
    return candidateFile instanceof File ? candidateFile : null;
  }

  private buildFormatOptions(): CropFormatOption[] {
    const epubTarget: CropTarget = {
      width: EPUB_COVER_TARGET.width,
      height: EPUB_COVER_TARGET.height,
      output: 'target',
    };

    return [
      { id: 'epub', label: 'Kindle', target: epubTarget },
      {
        id: 'kobo',
        label: 'Kobo',
        target: { width: 1072, height: 1448, output: 'target' },
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

  private getSelectedFormatOption(): CropFormatOption {
    const selected =
      this.formatOptions.find((option) => option.id === this.mergeCoverFormatId) ??
      this.formatOptions[0];
    this.mergeCoverFormatId = selected.id;
    return selected;
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

  private buildDefaultCropState(): CoverCropState {
    return buildDefaultCoverCropState();
  }

  private async buildThumbFromBlob(blob: Blob): Promise<string | null> {
    try {
      const thumb = document.createElement('canvas');
      thumb.width = COVER_THUMB_SIZE;
      thumb.height = COVER_THUMB_SIZE;
      const ctx = thumb.getContext('2d');
      if (!ctx) {
        return null;
      }

      const bitmap = await createImageBitmap(blob);
      try {
        const scale = Math.min(
          COVER_THUMB_SIZE / Math.max(1, bitmap.width),
          COVER_THUMB_SIZE / Math.max(1, bitmap.height),
        );
        const width = bitmap.width * scale;
        const height = bitmap.height * scale;
        ctx.clearRect(0, 0, COVER_THUMB_SIZE, COVER_THUMB_SIZE);
        ctx.drawImage(
          bitmap,
          (COVER_THUMB_SIZE - width) / 2,
          (COVER_THUMB_SIZE - height) / 2,
          width,
          height,
        );
        return thumb.toDataURL('image/png');
      } finally {
        bitmap.close?.();
      }
    } catch {
      return null;
    }
  }

  private async readLocalPreference(key: string): Promise<boolean> {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  private async writeLocalPreference(key: string): Promise<void> {
    try {
      localStorage.setItem(key, '1');
    } catch {
    }
  }

  private async pickNativeEpubForSplit(): Promise<void> {
    this.isPicking.set(true);

    try {
      const selection = await this.prepareNativeSelection();
      await this.replaceSplitSelection(selection);
    } catch (error) {
      if (this.isCancelledPick(error)) {
        return;
      }
      this.handlePickerError(error);
    } finally {
      this.isPicking.set(false);
    }
  }

  private async replaceSplitSelection(
    selection: SelectedEpubInput,
  ): Promise<void> {
    const previous = this.splitSelection();
    this.splitSelection.set(selection);
    this.selectedMode.set('split');
    await this.cleanupSelection(previous);
  }

  private async prepareNativeSelection(): Promise<SelectedEpubInput> {
    const prepared = await this.epubRewrite.pickAndPrepareEpub({
      maxBytes: MAX_EPUB_SIZE_MB * 1024 * 1024,
      requireCover: false,
      includeCoverPreview: false,
    });

    return {
      id: this.createSelectionId(),
      sessionId: prepared.sessionId,
      selectedName: prepared.selectedName,
      sourceSize: prepared.sourceSize,
      sourceLastModified: prepared.sourceLastModified,
      sourceMimeType: prepared.sourceMimeType,
      workingPath: prepared.workingPath,
      workingName: prepared.workingName,
      workingFile: null,
      workingNativePath: prepared.workingNativePath,
      outputBaseName: prepared.outputBaseName,
      sourceKind: 'native',
    };
  }

  private async prepareWebSelection(file: File): Promise<SelectedEpubInput> {
    const validation = this.fileKit.validateEpub(file, MAX_EPUB_SIZE_MB);
    if (!validation.valid) {
      throw new Error(validation.errorKey ?? 'EPUB_ERROR_CORRUPT');
    }

    const cycle = this.epubRewrite.isSupported()
      ? await this.epubWorkingCopy.startStreamingCycle(file)
      : await this.epubWorkingCopy.startCycle(file);

    return {
      id: this.createSelectionId(),
      sessionId: null,
      selectedName: cycle.sourceMeta.name,
      sourceSize: cycle.sourceMeta.size,
      sourceLastModified: cycle.sourceMeta.lastModified,
      sourceMimeType: cycle.sourceMeta.type,
      workingPath: cycle.workingPath,
      workingName: cycle.workingName,
      workingFile: 'workingFile' in cycle ? cycle.workingFile : file,
      workingNativePath:
        'workingNativePath' in cycle ? cycle.workingNativePath : null,
      outputBaseName: cycle.outputBaseName,
      sourceKind: this.epubRewrite.isSupported() ? 'native' : 'web',
    };
  }

  private handlePickerError(error: unknown): void {
    this.pickerErrorKey.set(this.mapPickerError(error));
  }

  private clearPickerError(): void {
    this.pickerErrorKey.set(null);
  }

  private mapPickerError(error: unknown): string {
    if (error instanceof EpubRewriteError) {
      if (error.code === 'EPUB_TOO_LARGE') {
        return 'HOME.INPUT_ERROR_SIZE';
      }

      if (error.code === 'NO_SPACE') {
        return 'HOME.INPUT_ERROR_STORAGE';
      }
    }

    if (error instanceof Error) {
      if (error.message === 'EPUB_ERROR_SIZE') {
        return 'HOME.INPUT_ERROR_SIZE';
      }

      if (error.message === 'EPUB_ERROR_CORRUPT') {
        return 'HOME.INPUT_ERROR_CORRUPT';
      }
    }

    return 'HOME.INPUT_ERROR_CORRUPT';
  }

  private isCancelledPick(error: unknown): boolean {
    return error instanceof EpubRewriteError && error.code === 'PICK_CANCELLED';
  }

  private async cleanupAllSelections(): Promise<void> {
    const mergeSelections = this.mergeSelections();
    const splitSelection = this.splitSelection();

    this.mergeSelections.set([]);
    this.splitSelection.set(null);

    await Promise.allSettled([
      ...mergeSelections.map((selection) => this.cleanupSelection(selection)),
      this.cleanupSelection(splitSelection),
    ]);
  }

  private async cleanupSelection(
    selection: SelectedEpubInput | null,
  ): Promise<void> {
    if (!selection) {
      return;
    }

    try {
      if (selection.sessionId) {
        await this.epubRewrite.cleanup(selection.sessionId);
        return;
      }

      await this.epubWorkingCopy.cleanupWorkingCopy(selection.workingPath);
    } catch {
      // best effort cleanup
    }
  }

  private resetFileInput(input: HTMLInputElement | null | undefined): void {
    if (input) {
      input.value = '';
    }
  }

  private createSelectionId(): string {
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }

    return `selection-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private async loadIcons(): Promise<void> {
    try {
      const [mergeIconSvg, splitIconSvg] = await Promise.all([
        this.loadSvg('./assets/icons/merge.svg'),
        this.loadSvg('./assets/icons/split.svg'),
      ]);

      this.mergeIconSvg.set(mergeIconSvg);
      this.splitIconSvg.set(splitIconSvg);
    } catch (error) {
      console.error(
        '[epub-merger-and-splitter] failed to load home icons',
        error,
      );
    }
  }

  private async loadSvg(assetPath: string): Promise<string> {
    const response = await fetch(assetPath);

    if (!response.ok) {
      throw new Error(`Failed to load SVG asset: ${assetPath}`);
    }

    return response.text();
  }
}
