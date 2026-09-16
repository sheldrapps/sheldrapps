import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  ModalController,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  AdsService,
  BillingService,
  ExportAccessService,
  RemoveAdsPurchasePageService,
  type AdFailureConfidence,
  type AdFailureReason,
  type RewardedAdResult,
} from '@sheldrapps/ads-kit';
import { AdFallbackService } from '@sheldrapps/ad-fallback-kit';
import {
  DEFAULT_EXPORT_QUALITY_MODE,
  getCoverExportOptions,
  normalizeExportQualityMode,
  type ExportQualityMode,
} from '@sheldrapps/export-quality-kit';
import {
  encodeRenderedBlob,
  toEditorRenderQuality,
} from '@sheldrapps/image-workflow';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { addIcons } from 'ionicons';
import {
  appsOutline,
  closeCircleOutline,
  documentOutline,
  documentsOutline,
  refreshOutline,
} from 'ionicons/icons';
import { PdfRewriteError, PdfRewriteNativeService } from '../../pdf/pdf-rewrite.service';
import {
  PdfSplitPlannerService,
  type PdfManualSplitMode,
  type PdfSplitBookmarkMode,
} from '../../pdf/pdf-split-planner.service';
import { PdfLibraryService } from '../../services/pdf-library.service';
import { mergedPdfOutputName, splitPdfOutputName } from '../../pdf/pdf-output-naming';
import {
  ActionCardComponent,
  FilePickerPanelComponent,
  SelectableButtonListComponent,
  ScrollableButtonBarComponent,
  TripleButtonComponent,
  ProBadgeComponent,
  WorkflowStepperComponent,
  WorkflowNavigationComponent,
  SpinnerComponent,
  type FilePickerPanelItem,
  type FilePickerPanelReorderEvent,
  type SelectableButtonListItem,
  type WorkflowStep,
  type ScrollableBarItem,
} from '@sheldrapps/ui-theme';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import {
  RecommendedAppsService,
  buildHomeHeaderItems,
  handleHomeHeaderAction,
} from '@sheldrapps/recommended-apps';
import {
  PDF_ACCEPT,
  type PdfBookmarkMode,
  type PdfCoverDraft,
  type PdfOperation,
  type PdfSplitMethod,
  type SelectedPdf,
} from '../../pdf/pdf-domain';
import {
  EditorSessionExitService,
  EditorSessionService,
  consumeEditorResultSnapshot,
} from '@sheldrapps/image-workflow/editor';
import {
  CoverImageStateComponent,
  CoverSourceActionsComponent,
  type CropperResult,
} from '@sheldrapps/image-workflow';
import { PdfMergerAndSplitterSettings } from '../../settings/pdf-merger-and-splitter-settings.schema';

type WorkflowStepId = 'merge-split' | 'select' | 'order' | 'bookmarks' | 'method' | 'ranges' | 'cover' | 'adjust' | 'review';

type PdfOutputSummary = {
  fileName: string;
  sizeBytes: number;
};

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
    ActionCardComponent,
    FilePickerPanelComponent,
    SelectableButtonListComponent,
    TripleButtonComponent,
    CoverSourceActionsComponent,
    CoverImageStateComponent,
    ProBadgeComponent,
    IonInput,
    WorkflowStepperComponent,
    ScrollableButtonBarComponent,
    WorkflowNavigationComponent,
    SpinnerComponent,
  ],
})
export class HomePage implements OnDestroy, OnInit {
  private readonly rewrite = inject(PdfRewriteNativeService);
  private readonly splitPlanner = inject(PdfSplitPlannerService);
  private readonly library = inject(PdfLibraryService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly billing = inject(BillingService);
  private readonly removeAdsPurchasePage = inject(RemoveAdsPurchasePageService);
  private readonly ads = inject(AdsService);
  private readonly exportAccess = inject(ExportAccessService);
  private readonly adFallback = inject(AdFallbackService);
  private readonly modalController = inject(ModalController);
  private readonly settings = inject(SettingsStore<PdfMergerAndSplitterSettings>);
  private readonly recommendedApps = inject(RecommendedAppsService);
  private readonly editorSessionExit = inject(EditorSessionExitService);
  private readonly editorSession = inject(EditorSessionService);
  private readonly adFallbackTotal = 2;
  private adFallbackRemaining = this.adFallbackTotal;
  private adFallbackTrialActive = false;
  private readonly adFallbackApp = 'pmas' as const;
  private readonly adFallbackRemainingPreference = 'pmas_ad_fallback_remaining';
  private readonly adFallbackTrialPreference = 'pmas_ad_fallback_trial_active';

  @ViewChild('pdfInput') private pdfInput?: ElementRef<HTMLInputElement>;
  @ViewChild('coverInput') private coverInput?: ElementRef<HTMLInputElement>;

  readonly pdfAccept = PDF_ACCEPT;
  readonly selectedMode = signal<PdfOperation | null>(null);
  readonly pendingMode = signal<PdfOperation | null>(null);
  readonly mergePdfs = signal<SelectedPdf[]>([]);
  readonly splitPdf = signal<SelectedPdf | null>(null);
  readonly bookmarkMode = signal<PdfBookmarkMode>('documents-and-bookmarks');
  readonly tocMode = computed(() => {
    switch (this.bookmarkMode()) {
      case 'documents-only':
        return 'books-only';
      case 'original-bookmarks':
        return 'full-index';
      default:
        return 'books-and-chapters';
    }
  });
  readonly splitMethod = signal<PdfSplitMethod>('manual-cut-points');
  readonly splitBookmarkMode = signal<PdfSplitBookmarkMode>('chapter');
  readonly splitManualMode = signal<PdfManualSplitMode>('toc');
  readonly splitManualBookmarkIds = signal<readonly string[]>([]);
  readonly splitManualPageInput = signal('');
  readonly splitManualPageErrorKey = signal<string | null>(null);
  readonly splitEqualPartsValue = signal(2);
  readonly splitEqualPartsSelection = signal('2');
  readonly splitEqualPartsErrorKey = signal<string | null>(null);
  readonly splitMaximumPages = signal(10);
  readonly splitMaximumPagesSelection = signal('10');
  readonly splitMaximumPagesErrorKey = signal<string | null>(null);
  readonly cover = signal<PdfCoverDraft>({ source: 'none' });
  readonly coverFile = signal<File | null>(null);
  readonly coverImageUri = signal<string | null>(null);
  readonly coverPreviewUri = signal<string | null>(null);
  readonly isRebuildingExportQuality = signal(false);
  readonly adsRemoved = toSignal(this.billing.adsRemoved$, {
    initialValue: this.billing.isAdsRemoved(),
  });
  readonly removeAdsPriceFormatted = toSignal(this.billing.removeAdsPrice$, {
    initialValue: this.billing.getRemoveAdsPriceFormatted(),
  });
  exportQualityMode: ExportQualityMode = DEFAULT_EXPORT_QUALITY_MODE;
  readonly workflowStep = signal(0);
  readonly isBusy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly fidelityWarningsAcknowledged = signal(false);
  readonly resultWarnings = signal<readonly string[]>([]);
  readonly pickerErrorKey = signal<string | null>(null);
  readonly sessionId = signal<string | null>(null);
  readonly isResettingFlow = signal(false);
  readonly operationCompleted = signal(false);
  readonly operationOutputs = signal<readonly PdfOutputSummary[]>([]);
  private lastEditorSessionId: string | undefined;
  private editorFlowEpoch = 0;
  private routerSub?: Subscription;
  private editorReturnStep = 0;
  private coverMasterBlob: Blob | undefined;
  private previewObjectUrls = new Set<string>();
  readonly mergeIconSvg = signal<string | null>(null);
  readonly splitIconSvg = signal<string | null>(null);
  headerItems: ScrollableBarItem[] = [];

  readonly mergeSteps = [
    { id: 'merge-split' as WorkflowStepId, key: 'HOME.STEPPER.MERGE_SPLIT' },
    { id: 'select' as WorkflowStepId, key: 'HOME.STEPPER.SORT' },
    { id: 'bookmarks' as WorkflowStepId, key: 'HOME.STEPPER.TOC' },
    { id: 'cover' as WorkflowStepId, key: 'HOME.STEPPER.COVER' },
    { id: 'adjust' as WorkflowStepId, key: 'HOME.STEPPER.ADJUST' },
    { id: 'review' as WorkflowStepId, key: 'HOME.STEPPER.JOIN' },
  ];
  readonly splitSteps = [
    { id: 'merge-split' as WorkflowStepId, key: 'HOME.STEPPER.MERGE_SPLIT' },
    { id: 'method' as WorkflowStepId, key: 'HOME.SPLIT_HOW_TO' },
    { id: 'bookmarks' as WorkflowStepId, key: 'HOME.STEPPER.TOC' },
    { id: 'ranges' as WorkflowStepId, key: 'HOME.STEPPER.CONFIRM' },
    { id: 'cover' as WorkflowStepId, key: 'HOME.STEPPER.COVER' },
    { id: 'adjust' as WorkflowStepId, key: 'HOME.STEPPER.ADJUST' },
    { id: 'review' as WorkflowStepId, key: 'HOME.SPLIT' },
  ];

  readonly steps = computed(() => this.getWorkflowSteps());

  private getWorkflowSteps() {
    const selectedMode = this.selectedMode();
    if (!selectedMode) {
      return this.mergeSteps.slice(0, 1);
    }

    const steps = selectedMode === 'split' ? this.splitSteps : this.mergeSteps;
    return this.hasCurrentToc()
      ? steps
      : steps.filter((step) => step.id !== 'bookmarks');
  }

  readonly workflowUiSteps = computed<WorkflowStep[]>(() =>
    this.steps().map((step) => ({
      id: step.id,
      label: this.translate.instant(step.key),
    })),
  );

  readonly selectableWorkflowSteps = computed(() => {
    const currentStep = this.workflowStep();
    const adjustStep = this.adjustWorkflowStep;
    const reviewStep = this.reviewWorkflowStep;
    const selectableSteps = Array.from({ length: currentStep + 1 }, (_, index) => index);
    if (this.canContinue() && currentStep < this.steps().length - 1) {
      const nextStep = this.workflowStepId() === 'cover' && !this.canAdjustCover()
        ? reviewStep
        : currentStep + 1;
      selectableSteps.push(nextStep);
    }
    return Array.from(new Set(selectableSteps))
      .filter((index) => index !== adjustStep || this.canAdjustCover());
  });

  readonly workflowStepId = computed<WorkflowStepId | null>(
    () => this.steps()[this.workflowStep()]?.id ?? null,
  );

  readonly previousStepLabel = computed(
    () => this.workflowUiSteps()[this.workflowStep() - 1]?.label ?? '',
  );

  readonly nextStepLabel = computed(
    () => this.workflowUiSteps()[this.workflowStep() + 1]?.label ?? '',
  );

  readonly mergePickerItems = computed<FilePickerPanelItem[]>(() =>
    this.mergePdfs().map((pdf) => ({
      id: pdf.id,
      title: pdf.displayName,
      subtitle: pdf.pageCount
        ? `${pdf.pageCount} ${this.translate.instant('PDF_WORKFLOW.PAGES')}`
        : null,
    })),
  );

  readonly splitPageCount = computed(() => this.splitPdf()?.analysis?.pageCount ?? this.splitPdf()?.pageCount ?? 0);
  readonly fidelityWarnings = computed(() => {
    const sources = this.selectedMode() === 'split'
      ? [this.splitPdf()]
      : this.mergePdfs();
    return Array.from(new Set(sources.flatMap((pdf) => pdf?.warnings ?? pdf?.analysis?.warnings ?? [])));
  });
  readonly splitHasBookmarks = computed(() => this.splitPlanner.flattenBookmarks(this.splitPdf()?.analysis).length > 0);
  readonly hasCurrentToc = computed(() => {
    if (this.selectedMode() === 'split') return this.splitHasBookmarks();
    return this.mergePdfs().some((pdf) => (pdf.analysis?.bookmarks?.length ?? 0) > 0);
  });
  readonly splitBookmarkItems = computed<readonly SelectableButtonListItem[]>(() =>
    this.splitPlanner.flattenBookmarks(this.splitPdf()?.analysis).map((bookmark) => ({
      value: bookmark.id,
      title: bookmark.title,
      subline: `${bookmark.pageIndex + 1} ${this.translate.instant('PDF_WORKFLOW.PAGES')}`,
      ariaLabel: bookmark.title,
      leadingIconSrc: bookmark.hasChildren ? 'assets/icons/notebook2-outline.svg' : 'assets/icons/check-list-square-outline.svg',
    })),
  );
  readonly splitMethodItems = computed<readonly SelectableButtonListItem[]>(() => [
    ...(['bookmarks', 'manual-cut-points', 'equal-number-of-parts', 'maximum-pages-per-file'] as const).map((value) => ({
      value,
      titleKey: value === 'bookmarks'
        ? 'HOME.SPLIT_OPTIONS.BY_CHAPTERS_OR_SECTIONS.TITLE'
        : value === 'manual-cut-points'
          ? 'HOME.SPLIT_OPTIONS.MANUAL_SPLIT_POINTS.TITLE'
          : value === 'equal-number-of-parts'
          ? 'HOME.SPLIT_OPTIONS.EQUAL_PARTS.TITLE'
            : 'HOME.SPLIT_OPTIONS.MAXIMUM_FILE_SIZE.TITLE',
      sublineKey: value === 'bookmarks'
        ? 'HOME.SPLIT_OPTIONS.BY_CHAPTERS_OR_SECTIONS.SUBLINE'
        : value === 'manual-cut-points'
          ? 'HOME.SPLIT_OPTIONS.MANUAL_SPLIT_POINTS.SUBLINE'
          : value === 'equal-number-of-parts'
            ? 'HOME.SPLIT_OPTIONS.EQUAL_PARTS.SUBLINE'
            : 'HOME.SPLIT_OPTIONS.MAXIMUM_FILE_SIZE.SUBLINE',
      leadingIconSrc: value === 'bookmarks'
        ? 'assets/icons/notebook2-outline.svg'
        : value === 'manual-cut-points'
          ? 'assets/icons/check-list-square-outline.svg'
          : value === 'equal-number-of-parts'
          ? 'assets/icons/widget-outline.svg'
            : 'assets/icons/ruler2-outline.svg',
      disabled: value === 'bookmarks' && !this.splitHasBookmarks(),
    })),
  ]);

  readonly splitChapterModeItems = computed<readonly SelectableButtonListItem[]>(() => [
    {
      value: 'chapter',
      titleKey: 'HOME.SPLIT_CONFIRM.ONE_PER_CHAPTER',
      sublineKey: 'HOME.SPLIT_CONFIRM.BY_CHAPTER_SUBLINE',
      ariaLabelKey: 'HOME.SPLIT_CONFIRM.ONE_PER_CHAPTER',
    },
    {
      value: 'section',
      titleKey: 'HOME.SPLIT_CONFIRM.ONE_PER_SECTION',
      sublineKey: 'HOME.SPLIT_CONFIRM.BY_SECTION_SUBLINE',
      ariaLabelKey: 'HOME.SPLIT_CONFIRM.ONE_PER_SECTION',
      disabled: this.splitPlanner.sectionBookmarks(this.splitPdf()?.analysis).length < 2,
    },
  ]);

  readonly splitManualModeItems = computed<readonly SelectableButtonListItem[]>(() => [
    {
      value: 'toc',
      titleKey: 'HOME.SPLIT_CONFIRM.MANUAL_BOOKMARKS',
      sublineKey: 'HOME.SPLIT_CONFIRM.MANUAL_BOOKMARKS_SUBLINE',
      ariaLabelKey: 'HOME.SPLIT_CONFIRM.MANUAL_BOOKMARKS',
      disabled: !this.splitHasBookmarks(),
    },
    {
      value: 'pages',
      titleKey: 'HOME.SPLIT_CONFIRM.MANUAL_PAGES',
      sublineKey: 'HOME.SPLIT_CONFIRM.MANUAL_PAGES_SUBLINE',
      ariaLabelKey: 'HOME.SPLIT_CONFIRM.MANUAL_PAGES',
    },
  ]);

  readonly splitEqualPartsItems = computed<readonly SelectableButtonListItem[]>(() => {
    const pageCount = this.splitPageCount();
    const values = [2, 3, 4].filter((value) => value <= pageCount);
    return [
      ...values.map((value) => ({
        value: value.toString(),
        title: this.translate.instant('HOME.SPLIT_CONFIRM.PART_COUNT', { count: value }),
        subline: this.translate.instant('HOME.SPLIT_CONFIRM.PART_COUNT_SUBLINE', { count: Math.ceil(pageCount / value) }),
        ariaLabel: this.translate.instant('HOME.SPLIT_CONFIRM.PART_COUNT', { count: value }),
      })),
      {
        value: 'custom',
        titleKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PART_COUNT',
        sublineKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PART_COUNT_SUBLINE',
        ariaLabelKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PART_COUNT',
        disabled: pageCount < 2,
      },
    ];
  });

  readonly splitMaximumPagesItems = computed<readonly SelectableButtonListItem[]>(() => {
    const pageCount = this.splitPageCount();
    const presets = [5, 10, 20]
      .filter((value) => value < pageCount)
      .map((value) => ({
        value: value.toString(),
        title: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_PAGES_OPTION', { pages: value }),
        subline: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_PAGES_OPTION_SUBLINE', { count: Math.ceil(pageCount / value) }),
        ariaLabel: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_PAGES_OPTION', { pages: value }),
      }));
    return [
      ...presets,
      {
        value: 'custom',
        titleKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PAGES',
        sublineKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PAGES_SUBLINE',
        ariaLabelKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PAGES',
      },
    ];
  });

  readonly splitOutputs = computed(() => {
    const source = this.splitPdf();
    if (!source) return [];
    const pageCount = source.pageCount ?? 12;
    return this.splitPlanner.buildOutputs({
      analysis: this.splitPdf()?.analysis,
      method: this.splitMethod(),
      bookmarkMode: this.splitBookmarkMode(),
      manualMode: this.splitManualMode(),
      manualBookmarkIds: this.splitManualBookmarkIds(),
      manualPageInput: this.splitManualPageInput(),
      equalParts: this.splitEqualPartsValue(),
      maximumPagesPerFile: this.splitMaximumPages(),
    });
  });

  constructor() {
    addIcons({ appsOutline, closeCircleOutline, documentOutline, documentsOutline, refreshOutline });
    void this.loadIcons().catch(() => undefined);
  }

  getPageTitleKey(): string {
    if (this.mergePdfs().length > 0 && this.selectedMode() === 'merge') {
      return 'HOME.MERGING_TITLE';
    }
    if (this.splitPdf() && this.selectedMode() === 'split') {
      return 'HOME.SPLITTING_TITLE';
    }
    return 'TABS.HOME';
  }

  async ngOnInit(): Promise<void> {
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        if (url.startsWith('/tabs/home')) {
          void this.consumeEditorResult();
        }
      });
    await Promise.all([
      this.hydrateAdFallbackState(),
      this.refreshHeaderItems(),
      this.loadExportQualitySettings(),
    ]);
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.refreshHeaderItems();
    await this.consumeEditorResult();
  }

  async onHeaderItemClick(id: string): Promise<void> {
    await handleHomeHeaderAction(id, {
      closeInfo: () => undefined,
      toggleInfo: () => undefined,
      navigateToRecommended: async () => {
        await this.router.navigateByUrl('/tabs/recommended-apps');
      },
      resetFlow: () => this.resetFlow(),
    });
  }

  private async refreshHeaderItems(): Promise<void> {
    const apps = await this.recommendedApps.getRecommendedApps();
    this.headerItems = buildHomeHeaderItems(apps.length > 0, {
      appsLabel: this.translate.instant('ARR.TOOLS.APPS'),
      resetLabel: this.translate.instant('UI_THEME.RESET'),
      includeGuide: false,
    });
  }

  private async loadIcons(): Promise<void> {
    const [mergeIconSvg, splitIconSvg] = await Promise.all([
      this.loadSvg('./assets/icons/merge.svg'),
      this.loadSvg('./assets/icons/split.svg'),
    ]);
    this.mergeIconSvg.set(mergeIconSvg);
    this.splitIconSvg.set(splitIconSvg);
  }

  private async loadSvg(assetPath: string): Promise<string> {
    const response = await fetch(assetPath);
    if (!response.ok) throw new Error(`Failed to load SVG asset: ${assetPath}`);
    return response.text();
  }

  async resetFlow(): Promise<void> {
    if (this.isResettingFlow() || this.isBusy()) return;
    if (!(await this.editorSessionExit.confirmResetFlow())) return;
    this.isResettingFlow.set(true);
    try {
      await this.clearFlowState();
    } finally {
      this.isResettingFlow.set(false);
    }
  }

  async onOperationDone(): Promise<void> {
    if (this.isResettingFlow() || this.isBusy()) return;
    this.isResettingFlow.set(true);
    try {
      await this.clearFlowState();
      await this.router.navigateByUrl('/tabs/my-pdfs');
    } finally {
      this.isResettingFlow.set(false);
    }
  }

  private disposeEditorSession(): void {
    const sessionId = this.lastEditorSessionId;
    if (!sessionId) return;
    this.disposeEditorSessionById(sessionId);
    this.lastEditorSessionId = undefined;
  }

  private disposeEditorSessionById(sessionId: string): void {
    this.editorSession.consumeResult?.(sessionId);
    this.editorSession.consumeSession?.(sessionId);
  }

  private async releaseStagedCoverImage(uri: string | null): Promise<void> {
    if (!uri || !this.rewrite || typeof this.rewrite.releaseStagedCoverImage !== 'function') return;
    await this.rewrite.releaseStagedCoverImage(uri);
  }

  private async replaceStagedCoverImage(uri: string | null): Promise<void> {
    const previousUri = this.coverImageUri();
    if (previousUri && previousUri !== uri) await this.releaseStagedCoverImage(previousUri);
    this.coverImageUri.set(uri);
  }

  private releasePreviewObjectUrls(): void {
    if (!this.previewObjectUrls) return;
    for (const uri of this.previewObjectUrls) URL.revokeObjectURL(uri);
    this.previewObjectUrls.clear();
  }

  private async clearFlowState(): Promise<void> {
    this.editorFlowEpoch += 1;
    const sessionId = this.sessionId();
    const stagedCoverUri = this.coverImageUri();
    this.disposeEditorSession();
    try {
      await Promise.allSettled([
        sessionId ? this.rewrite.cleanupSession(sessionId) : Promise.resolve(),
        this.releaseStagedCoverImage(stagedCoverUri),
      ]);
    } finally {
      this.selectedMode.set(null);
      this.pendingMode.set(null);
      this.mergePdfs.set([]);
      this.splitPdf.set(null);
      this.resetSplitConfiguration();
      this.cover.set({ source: 'none' });
      this.coverFile.set(null);
      this.coverImageUri.set(null);
      this.coverPreviewUri.set(null);
      this.coverMasterBlob = undefined;
      this.sessionId.set(null);
      this.workflowStep.set(0);
      this.errorKey.set(null);
      this.pickerErrorKey.set(null);
      this.fidelityWarningsAcknowledged.set(false);
      this.resultWarnings.set([]);
      this.operationCompleted.set(false);
      this.operationOutputs.set([]);
      this.isRebuildingExportQuality.set(false);
      this.isBusy.set(false);
      this.editorReturnStep = 0;
      this.releasePreviewObjectUrls();
    }
  }

  selectMode(mode: PdfOperation): void {
    const sessionId = this.sessionId();
    const stagedCoverUri = this.coverImageUri();
    this.disposeEditorSession();
    if (sessionId) void this.rewrite.cleanupSession(sessionId);
    void this.releaseStagedCoverImage(stagedCoverUri);
    this.editorFlowEpoch += 1;
    this.operationCompleted.set(false);
    this.pendingMode.set(mode);
    this.selectedMode.set(null);
    this.workflowStep.set(0);
    this.errorKey.set(null);
    this.fidelityWarningsAcknowledged.set(false);
    this.resultWarnings.set([]);
    this.cover.set({ source: 'none' });
    this.coverFile.set(null);
    this.coverImageUri.set(null);
    this.coverPreviewUri.set(null);
    this.coverMasterBlob = undefined;
    this.sessionId.set(null);
    if (mode === 'merge') this.splitPdf.set(null);
    if (mode === 'split') {
      this.mergePdfs.set([]);
      this.resetSplitConfiguration();
    }
    this.openPdfPicker();
  }

  async onWorkflowStepSelected(step: number): Promise<void> {
    if (step === this.adjustWorkflowStep) {
      if (!this.canAdjustCover()) return;
      this.operationCompleted.set(false);
      await this.openExistingCoverEditor(this.workflowStep());
      return;
    }

    if (step <= this.workflowStep() || this.canContinue()) {
      this.operationCompleted.set(false);
      this.workflowStep.set(step);
    }
  }

  onMergeItemsReordered(event: FilePickerPanelReorderEvent): void {
    const pdfs = [...this.mergePdfs()];
    const [moved] = pdfs.splice(event.from, 1);
    if (!moved) return;
    pdfs.splice(event.to, 0, moved);
    this.mergePdfs.set(pdfs);
  }

  onBookmarkModeChange(value: string): void {
    const modeByTocValue: Record<string, PdfBookmarkMode> = {
      'books-and-chapters': 'documents-and-bookmarks',
      'books-only': 'documents-only',
      'full-index': 'original-bookmarks',
    };
    const mode = modeByTocValue[value];
    if (mode) this.bookmarkMode.set(mode);
  }

  openPdfPicker(): void {
    this.pickerErrorKey.set(null);
    if (this.rewrite.isNativeSupported()) {
      void this.pickNativePdf();
      return;
    }
    const input = this.pdfInput?.nativeElement;
    if (!input) return;
    input.multiple = (this.pendingMode() ?? this.selectedMode()) === 'merge';
    input.click();
  }

  private async pickNativePdf(): Promise<void> {
    const mode = this.pendingMode() ?? this.selectedMode();
    if (!mode) return;

    this.isBusy.set(true);
    this.errorKey.set(null);
    try {
      const session = this.sessionId()
        ? { id: this.sessionId()! }
        : await this.rewrite.createSession(mode);
      this.sessionId.set(session.id);
      this.selectedMode.set(mode);
      if (mode === 'split') {
        const imported = await this.rewrite.pickAndImportPdf(session.id);
        this.splitPdf.set(imported);
        this.splitMethod.set(this.splitHasBookmarks() ? 'bookmarks' : 'manual-cut-points');
        this.resetSplitConfiguration();
      } else {
        const imported = await this.rewrite.pickAndImportPdfs(session.id);
        this.mergePdfs.set([...this.mergePdfs(), ...imported]);
      }
      this.fidelityWarningsAcknowledged.set(false);
      this.workflowStep.set(1);
    } catch (error) {
      if (!(error instanceof PdfRewriteError && error.code === 'PICK_CANCELLED')) {
        this.pickerErrorKey.set(this.pickerErrorKeyFor(error));
      }
    } finally {
      this.isBusy.set(false);
    }
  }

  openCoverPicker(): void {
    this.coverInput?.nativeElement.click();
  }

  async onPdfFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const mode = this.pendingMode() ?? this.selectedMode();
    if (!files.length || !mode) return;

    this.isBusy.set(true);
    this.errorKey.set(null);
    try {
      const session = this.sessionId() ? { id: this.sessionId()! } : await this.rewrite.createSession(mode);
      this.sessionId.set(session.id);
      const imported = await Promise.all(
        (mode === 'split' ? files.slice(0, 1) : files).map((file) =>
          this.rewrite.importPdf(session.id, file.name, file),
        ),
      );
      this.selectedMode.set(mode);
      if (mode === 'split') {
        this.splitPdf.set(imported[0] ?? null);
        this.splitMethod.set(this.splitHasBookmarks() ? 'bookmarks' : 'manual-cut-points');
        this.resetSplitConfiguration();
      } else {
        this.mergePdfs.set([...this.mergePdfs(), ...imported]);
      }
      this.fidelityWarningsAcknowledged.set(false);
      this.workflowStep.set(1);
    } catch (error) {
      this.pickerErrorKey.set(this.pickerErrorKeyFor(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  async onCoverSelected(event: Event): Promise<void> {
    if (this.isBusy()) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    this.isBusy.set(true);
    try {
      this.coverFile.set(file);
      const stagedCoverUri = file ? await this.rewrite.stageCoverImage(file) : null;
      await this.replaceStagedCoverImage(stagedCoverUri);
      this.releasePreviewObjectUrls();
      this.coverPreviewUri.set(file ? await this.createPreviewUri(file) : null);
      this.cover.set(file ? { source: 'image', fileName: file.name } : { source: 'none' });
      this.coverMasterBlob = undefined;
      if (file) await this.openCoverEditor('image', file);
    } finally {
      this.isBusy.set(false);
    }
  }

  skipCover(): void {
    const stagedCoverUri = this.coverImageUri();
    this.coverFile.set(null);
    this.coverImageUri.set(null);
    this.coverPreviewUri.set(null);
    this.cover.set({ source: 'none' });
    this.coverMasterBlob = undefined;
    void this.releaseStagedCoverImage(stagedCoverUri);
    this.releasePreviewObjectUrls();
    this.workflowStep.set(this.reviewWorkflowStep);
  }

  async createCover(): Promise<void> {
    await this.openCoverEditor('scratch');
  }

  private async openCoverEditor(
    sourceMode: 'image' | 'scratch',
    file?: File,
    returnStep = this.coverWorkflowStep,
  ): Promise<void> {
    if (sourceMode === 'image' && !file) return;
    const flowEpoch = ++this.editorFlowEpoch;
    this.editorReturnStep = returnStep;
    const sessionId = this.editorSession.createSession({
      file,
      sourceMode,
      target: { width: 600, height: 800, output: 'target', unit: 'px', outputMode: 'fixed-size' },
      output: { includeRenderedBlob: true },
      onResultApplied: async (result) => {
        if (flowEpoch !== this.editorFlowEpoch) return;
        const appliedSessionId = this.lastEditorSessionId;
        const applied = await this.applyEditorResult(result, flowEpoch);
        if (!applied || flowEpoch !== this.editorFlowEpoch) return;
        if (appliedSessionId) this.disposeEditorSessionById(appliedSessionId);
        if (this.lastEditorSessionId === appliedSessionId) {
          this.lastEditorSessionId = undefined;
        }
      },
      returnUrl: '/tabs/home',
    });
    this.lastEditorSessionId = sessionId;
    this.workflowStep.set(this.adjustWorkflowStep);
    await this.router.navigate(sourceMode === 'scratch' ? ['/editor/tools'] : ['/editor'], { queryParams: { sid: sessionId } });
  }

  private async openExistingCoverEditor(returnStep = this.workflowStep()): Promise<void> {
    const file = this.coverFile();
    if (!file) return;
    await this.openCoverEditor('image', file, returnStep);
  }

  private get coverWorkflowStep(): number {
    return this.steps().findIndex((step) => step.id === 'cover');
  }

  private get adjustWorkflowStep(): number {
    return this.steps().findIndex((step) => step.id === 'adjust');
  }

  private get reviewWorkflowStep(): number {
    return this.steps().findIndex((step) => step.id === 'review');
  }

  private canAdjustCover(): boolean {
    return this.cover().source !== 'none' && !!this.coverFile();
  }

  private async consumeEditorResult(): Promise<void> {
    const flowEpoch = this.editorFlowEpoch;
    const snapshot = consumeEditorResultSnapshot(this.editorSession, this.lastEditorSessionId);
    if (!snapshot.result?.file) {
      if (snapshot.session) {
        if (this.lastEditorSessionId) this.disposeEditorSessionById(this.lastEditorSessionId);
        this.workflowStep.set(this.editorReturnStep);
        this.editorReturnStep = this.coverWorkflowStep;
      }
      return;
    }

    const applied = await this.applyEditorResult(snapshot.result, flowEpoch);
    if (!applied || flowEpoch !== this.editorFlowEpoch) return;
    if (this.lastEditorSessionId) {
      this.disposeEditorSessionById(this.lastEditorSessionId);
    }
    this.lastEditorSessionId = undefined;
  }

  private async applyEditorResult(result: CropperResult, flowEpoch: number): Promise<boolean> {
    if (flowEpoch !== this.editorFlowEpoch) return false;
    const renderedFile = this.buildRenderedCoverFile(result);
    this.coverMasterBlob = result.editorMasterBlob ?? result.renderedBlob ?? renderedFile;
    this.coverFile.set(renderedFile);
    const stagedCoverUri = await this.rewrite.stageCoverImage(renderedFile);
    if (flowEpoch !== this.editorFlowEpoch) {
      await this.releaseStagedCoverImage(stagedCoverUri);
      return false;
    }
    await this.replaceStagedCoverImage(stagedCoverUri);
    if (flowEpoch !== this.editorFlowEpoch) return false;
    this.releasePreviewObjectUrls();
    this.coverPreviewUri.set(await this.createPreviewUri(renderedFile));
    if (flowEpoch !== this.editorFlowEpoch) return false;
    this.cover.set({ source: 'editor', fileName: renderedFile.name });
    await this.applySelectedExportQuality(flowEpoch);
    if (flowEpoch !== this.editorFlowEpoch) return false;
    this.editorReturnStep = this.coverWorkflowStep;
    this.workflowStep.set(this.reviewWorkflowStep);
    return true;
  }

  private buildRenderedCoverFile(result: CropperResult): File {
    if (!result.renderedBlob) return result.file;

    const type = result.renderedMimeType ?? result.renderedBlob.type ?? 'image/jpeg';
    const extension = type === 'image/png' ? 'png' : 'jpg';
    const baseName = result.file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '') || 'cover';
    return new File([result.renderedBlob], `${baseName}_rendered.${extension}`, { type });
  }

  getEffectiveExportQualityMode(): ExportQualityMode {
    return normalizeExportQualityMode(this.exportQualityMode, this.adsRemoved());
  }

  canShowRemoveAdsEntryPoint(): boolean {
    return !this.adsRemoved() && this.billing.canShowRemoveAdsEntryPoint();
  }

  getRemoveAdsCtaSubtitleKey(): string {
    return this.removeAdsPriceFormatted()
      ? 'COMMON.REMOVE_ADS_CTA_SUBTITLE_WITH_PRICE'
      : 'COMMON.REMOVE_ADS_CTA_SUBTITLE';
  }

  getRemoveAdsPriceParams(): Record<string, string> {
    const price = this.removeAdsPriceFormatted();
    return price ? { price } : {};
  }

  async openPurchaseModal(): Promise<void> {
    if (!this.canShowRemoveAdsEntryPoint()) return;

    this.removeAdsPurchasePage.open({
      variant: 'PMAS',
      returnUrl: '/tabs/home',
    });
    await this.router.navigateByUrl('/remove-ads');
  }

  async onExportQualityModeSelect(mode: ExportQualityMode): Promise<void> {
    const normalized = normalizeExportQualityMode(mode, this.adsRemoved());
    if (normalized !== mode) return;

    this.exportQualityMode = normalized;
    this.isRebuildingExportQuality.set(true);
    try {
      await this.settings.setForScope('exportQuality', { exportQualityMode: normalized });
      await this.applySelectedExportQuality();
    } finally {
      this.isRebuildingExportQuality.set(false);
    }
  }

  async onTripleExportQualityModeSelect(value: string): Promise<void> {
    if (value !== 'thumbnail' && value !== 'compressed' && value !== 'best') return;
    await this.onExportQualityModeSelect(value);
  }

  formatMegabytes(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private getCoverPdfQuality(): number {
    return getCoverExportOptions(this.getEffectiveExportQualityMode()).quality ?? 0.95;
  }

  private async loadExportQualitySettings(): Promise<void> {
    const settings = await this.settings.load();
    this.exportQualityMode = normalizeExportQualityMode(settings.exportQualityMode, this.adsRemoved());
  }

  private async applySelectedExportQuality(expectedEpoch?: number): Promise<void> {
    if (!this.coverMasterBlob) return;
    const rendered = await encodeRenderedBlob(
      this.coverMasterBlob,
      this.coverFile()?.name ?? 'cover',
      toEditorRenderQuality(this.getEffectiveExportQualityMode()),
      '#ffffff',
    );
    if (!rendered) return;
    if (expectedEpoch !== undefined && expectedEpoch !== this.editorFlowEpoch) return;

    this.coverFile.set(rendered);
    const stagedCoverUri = await this.rewrite.stageCoverImage(rendered);
    if (expectedEpoch !== undefined && expectedEpoch !== this.editorFlowEpoch) {
      await this.releaseStagedCoverImage(stagedCoverUri);
      return;
    }
    await this.replaceStagedCoverImage(stagedCoverUri);
    this.releasePreviewObjectUrls();
    this.coverPreviewUri.set(await this.createPreviewUri(rendered));
    this.cover.update((current) => ({ ...current, fileName: rendered.name }));
  }

  private async createPreviewUri(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => {
        const uri = URL.createObjectURL(file);
        this.previewObjectUrls.add(uri);
        resolve(uri);
      };
      reader.readAsDataURL(file);
    });
  }

  removeMergePdf(id: string): void {
    this.mergePdfs.set(this.mergePdfs().filter((pdf) => pdf.id !== id));
    this.fidelityWarningsAcknowledged.set(false);
  }

  moveMergePdf(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const pdfs = [...this.mergePdfs()];
    if (target < 0 || target >= pdfs.length) return;
    [pdfs[index], pdfs[target]] = [pdfs[target], pdfs[index]];
    this.mergePdfs.set(pdfs);
  }

  onSplitMethodChange(value: string): void {
    if (!['bookmarks', 'manual-cut-points', 'equal-number-of-parts', 'maximum-pages-per-file'].includes(value)) return;
    if (value === 'bookmarks' && !this.splitHasBookmarks()) return;
    this.splitMethod.set(value as PdfSplitMethod);
    this.resetSplitConfiguration();
  }

  onSplitBookmarkModeChange(value: string): void {
    if (value === 'chapter' || value === 'section') this.splitBookmarkMode.set(value);
  }

  onSplitManualModeChange(value: string): void {
    if (value !== 'toc' && value !== 'pages') return;
    if (value === 'toc' && !this.splitHasBookmarks()) return;
    this.splitManualMode.set(value);
    this.splitManualBookmarkIds.set([]);
    this.splitManualPageInput.set('');
    this.splitManualPageErrorKey.set(null);
  }

  onSplitManualBookmarksChange(values: readonly string[]): void {
    this.splitManualBookmarkIds.set(values);
  }

  onSplitManualPageInput(value: string | number | null | undefined): void {
    const input = String(value ?? '');
    const parsed = Number(input.trim());
    this.splitManualPageInput.set(input);
    this.splitManualPageErrorKey.set(
      input.trim() && (!Number.isSafeInteger(parsed) || parsed < 1)
        ? 'HOME.SPLIT_CONFIRM.INVALID_PAGE_SIZE'
        : null,
    );
  }

  onSplitEqualPartsChange(value: string): void {
    if (value === 'custom') {
      this.splitEqualPartsSelection.set('custom');
      return;
    }
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed >= 2 && parsed <= this.splitPageCount()) {
      this.splitEqualPartsValue.set(parsed);
      this.splitEqualPartsSelection.set(value);
      this.splitEqualPartsErrorKey.set(null);
    }
  }

  onSplitEqualPartsInput(value: string | number | null | undefined): void {
    const parsed = Number(String(value ?? '').trim());
    if (!Number.isSafeInteger(parsed) || parsed < 2 || parsed > this.splitPageCount()) {
      this.splitEqualPartsErrorKey.set('HOME.SPLIT_CONFIRM.INVALID_PART_COUNT');
      return;
    }
    this.splitEqualPartsValue.set(parsed);
    this.splitEqualPartsSelection.set('custom');
    this.splitEqualPartsErrorKey.set(null);
  }

  onSplitMaximumPagesChange(value: string): void {
    if (value === 'custom') {
      this.splitMaximumPagesSelection.set('custom');
      return;
    }
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0 && parsed <= this.splitPageCount()) {
      this.splitMaximumPages.set(parsed);
      this.splitMaximumPagesSelection.set(value);
      this.splitMaximumPagesErrorKey.set(null);
    }
  }

  onSplitMaximumPagesInput(value: string | number | null | undefined): void {
    const parsed = Number(String(value ?? '').trim());
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > this.splitPageCount()) {
      this.splitMaximumPagesErrorKey.set('HOME.SPLIT_CONFIRM.INVALID_MAXIMUM_PAGES');
      return;
    }
    this.splitMaximumPages.set(parsed);
    this.splitMaximumPagesSelection.set('custom');
    this.splitMaximumPagesErrorKey.set(null);
  }

  onSplitIntegerKeydown(event: KeyboardEvent): void {
    if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault();
  }

  canContinue(): boolean {
    if (!this.selectedMode()) return false;
    const stepId = this.workflowStepId();
    if (this.selectedMode() === 'merge') {
      if (stepId === 'select') return this.mergePdfs().length >= 2;
      return true;
    }
    if (stepId === 'merge-split') return !!this.splitPdf();
    if (stepId === 'method') return this.splitMethod() !== 'bookmarks' || this.splitHasBookmarks();
    if (stepId === 'ranges') return this.splitOutputs().length >= 2;
    if (stepId === 'review') {
      return this.fidelityWarnings().length === 0 || this.fidelityWarningsAcknowledged();
    }
    return true;
  }

  acknowledgeFidelityWarnings(): void {
    this.fidelityWarningsAcknowledged.set(true);
  }

  async next(): Promise<void> {
    if (!this.canContinue() || this.workflowStep() >= this.steps().length - 1) return;

    if (this.workflowStep() === this.coverWorkflowStep) {
      if (!this.canAdjustCover()) {
        this.workflowStep.set(this.reviewWorkflowStep);
        void this.ads.warmRewarded().catch(() => undefined);
        return;
      }
      await this.openExistingCoverEditor();
      return;
    }

    if (this.workflowStep() === this.adjustWorkflowStep) {
      return;
    }

    this.workflowStep.update((step) => step + 1);
    if (this.workflowStepId() === 'review') {
      void this.ads.warmRewarded().catch(() => undefined);
    }
  }

  async previous(): Promise<void> {
    this.operationCompleted.set(false);

    if (this.workflowStep() === this.reviewWorkflowStep && this.canAdjustCover()) {
      await this.openExistingCoverEditor(this.reviewWorkflowStep);
      return;
    }

    if (this.workflowStep() === this.adjustWorkflowStep) {
      return;
    }

    this.workflowStep.update((step) => Math.max(0, step - 1));
  }

  async execute(): Promise<void> {
    if (this.isBusy()) return;

    const mode = this.selectedMode();
    if (!mode || !this.canContinue()) return;
    this.isBusy.set(true);
    this.operationCompleted.set(false);
    this.operationOutputs.set([]);
    this.errorKey.set(null);
    try {
      const sessionId = this.sessionId();
      if (!sessionId) throw new PdfRewriteError('SESSION_NOT_FOUND');
      const outputNames = this.outputNamesFor(mode);
      const access = await this.exportAccess.authorize({
        onActiveFallbackTrial: () =>
          this.adFallbackTrialActive && this.resolveAdFallbackRemaining() > 0
            ? this.confirmActiveAdFallbackTrial()
            : false,
        onAdFailure: (result) => this.openAdFallbackFromFailure(result),
      });
      if (!access.granted) return;
      let result;
      if (mode === 'merge') {
        result = await this.rewrite.mergePdf({
          sessionId,
          pdfs: this.mergePdfs(),
          bookmarkMode: this.bookmarkMode(),
          cover: this.cover(),
          outputName: outputNames[0],
          coverImageUri: this.coverImageUri() ?? undefined,
          coverQuality: this.getCoverPdfQuality(),
        });
      } else if (this.splitPdf()) {
        result = await this.rewrite.splitPdf({
          sessionId,
          source: this.splitPdf()!,
          method: this.splitMethod(),
          outputs: this.splitOutputs().map((output, index) => ({
            ...output,
            title: outputNames[index] ?? output.title,
          })),
          cover: this.cover(),
          coverImageUri: this.coverImageUri() ?? undefined,
          coverQuality: this.getCoverPdfQuality(),
        });
      }
      if (result) {
        this.resultWarnings.set(result.warnings ?? []);
        await this.saveOutputs(mode, result, outputNames);
        this.operationOutputs.set(
          (result.outputs ?? result.outputUris.map((uri, index) => ({
            uri,
            fileName: outputNames[index] ?? splitPdfOutputName(undefined, index + 1),
            sizeBytes: 0,
          }))).map(({ fileName, sizeBytes }) => ({ fileName, sizeBytes })),
        );
        if (access.source === 'fallback') {
          await this.consumeAdFallbackAttemptAfterSuccess(mode);
        }
      }
      await this.rewrite.cleanupSession(sessionId);
      this.sessionId.set(null);
      this.operationCompleted.set(true);
    } catch (error) {
      this.errorKey.set(this.errorKeyFor(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  splitMethodLabel(method: PdfSplitMethod): string {
    return this.translate.instant(`PDF_WORKFLOW.SPLIT_METHODS.${method}`);
  }

  private resetSplitConfiguration(): void {
    this.splitBookmarkMode.set('chapter');
    this.splitManualMode.set(this.splitHasBookmarks() ? 'toc' : 'pages');
    this.splitManualBookmarkIds.set([]);
    this.splitManualPageInput.set('');
    this.splitManualPageErrorKey.set(null);
    this.splitEqualPartsValue.set(Math.min(2, Math.max(1, this.splitPageCount())));
    this.splitEqualPartsSelection.set(this.splitPageCount() >= 2 ? '2' : 'custom');
    this.splitEqualPartsErrorKey.set(null);
    this.splitMaximumPages.set(10);
    this.splitMaximumPagesSelection.set('10');
    this.splitMaximumPagesErrorKey.set(null);
  }

  private errorKeyFor(error: unknown): string {
    if (error instanceof PdfRewriteError) {
      if (error.code === 'PDF_CORRUPT' || error.code === 'INVALID_PDF') {
        return 'PDF_WORKFLOW.ERRORS.INVALID_PDF';
      }
      if (error.code === 'PDF_TOO_LARGE') {
        return 'HOME.INPUT_ERROR_SIZE';
      }
      if (error.code === 'NO_SPACE') {
        return 'HOME.INPUT_ERROR_STORAGE';
      }
      if (error.code === 'OPERATION_CANCELLED') {
        return 'PDF_WORKFLOW.ERRORS.OPERATION_CANCELLED';
      }
      if (error.code === 'NATIVE_ENGINE_UNAVAILABLE' || error.code === 'WEB_PDF_REWRITE_UNAVAILABLE') {
        return 'PDF_WORKFLOW.NATIVE_ENGINE_NOTICE';
      }
      return this.selectedMode() === 'split'
        ? 'HOME.OPERATION.SPLIT_FAILURE_BODY'
        : 'HOME.OPERATION.MERGE_FAILURE_BODY';
    }
    return 'PDF_WORKFLOW.ERRORS.INVALID_PDF';
  }

  private pickerErrorKeyFor(error: unknown): string {
    if (error instanceof PdfRewriteError) {
      if (error.code === 'PDF_TOO_LARGE') return 'HOME.INPUT_ERROR_SIZE';
      if (error.code === 'NO_SPACE') return 'HOME.INPUT_ERROR_STORAGE';
      if (error.code === 'EMPTY_PDF' || error.code === 'PDF_CORRUPT' || error.code === 'INVALID_PDF') {
        return 'HOME.INPUT_ERROR_CORRUPT';
      }
      if (error.code === 'NATIVE_ENGINE_UNAVAILABLE' || error.code === 'WEB_PDF_REWRITE_UNAVAILABLE') {
        return 'PDF_WORKFLOW.NATIVE_ENGINE_NOTICE';
      }
    }
    return 'HOME.INPUT_ERROR_CORRUPT';
  }

  private outputNamesFor(mode: PdfOperation): string[] {
    if (mode === 'merge') {
      return [mergedPdfOutputName(this.mergePdfs()[0]?.displayName)];
    }
    return this.splitOutputs().map((_, index) => splitPdfOutputName(this.splitPdf()?.displayName, index + 1));
  }

  private async saveOutputs(mode: PdfOperation, result: { operationId: string; outputUris: string[]; outputs?: Array<{ uri: string; fileName: string; sizeBytes: number }> }, outputNames: readonly string[]): Promise<void> {
    const outputs = result.outputs ?? result.outputUris.map((uri, index) => ({
      uri,
      fileName: outputNames[index] ?? splitPdfOutputName(undefined, index + 1),
      sizeBytes: 0,
    }));
    await Promise.all(outputs.map((output, index) => this.library.saveRecord({
      id: `${result.operationId}:${index}`,
      operationId: result.operationId,
      operation: mode,
      fileName: output.fileName,
      title: output.fileName.replace(/\.pdf$/i, ''),
      uri: output.uri,
      sizeBytes: output.sizeBytes,
      pageCount: 0,
      createdAt: new Date().toISOString(),
      partIndex: mode === 'split' ? index + 1 : undefined,
      totalParts: mode === 'split' ? outputs.length : undefined,
      thumbnailUri: this.coverPreviewUri() ?? undefined,
    })));
  }

  private async openAdFallbackFromFailure(
    result: RewardedAdResult,
  ): Promise<boolean> {
    try {
      const decision = await this.adFallback.handleAdFailure(
        {
          app: this.adFallbackApp,
          reason: this.normalizeFailureReason(result.failureReason),
          confidence: this.normalizeFailureConfidence(result.failureConfidence),
          remaining: this.resolveAdFallbackRemaining(),
          total: this.adFallbackTotal,
          countdownSeconds: 5,
        },
        this.modalController,
      );

      if (decision !== 'accepted') {
        return false;
      }

      this.adFallbackTrialActive = true;
      await this.persistAdFallbackState();
      return true;
    } catch {
      return false;
    }
  }

  private async confirmActiveAdFallbackTrial(): Promise<boolean> {
    try {
      const decision = await this.adFallback.handleAdFailure(
        {
          app: this.adFallbackApp,
          reason: 'unknown',
          confidence: 'low',
          remaining: this.resolveAdFallbackRemaining(),
          total: this.adFallbackTotal,
          countdownSeconds: 5,
        },
        this.modalController,
      );

      return decision === 'accepted';
    } catch {
      return false;
    }
  }

  private resolveAdFallbackRemaining(): number {
    return this.adFallbackRemaining;
  }

  private async hydrateAdFallbackState(): Promise<void> {
    const settings = await this.settings.load();
    const rawRemaining = settings.preferences?.[this.adFallbackRemainingPreference];
    const parsedRemaining =
      typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)
        ? Math.floor(rawRemaining)
        : this.adFallbackTotal;
    this.adFallbackRemaining = Math.max(
      0,
      Math.min(this.adFallbackTotal, parsedRemaining),
    );

    const rawActive = settings.preferences?.[this.adFallbackTrialPreference];
    this.adFallbackTrialActive =
      rawActive === true && this.adFallbackRemaining > 0;
  }

  private async persistAdFallbackState(): Promise<void> {
    const remaining = Math.max(
      0,
      Math.min(this.adFallbackTotal, Math.floor(this.adFallbackRemaining)),
    );
    this.adFallbackRemaining = remaining;
    this.adFallbackTrialActive = this.adFallbackTrialActive && remaining > 0;

    await this.settings.set((previous) => ({
      ...previous,
      preferences: {
        ...(previous.preferences ?? {}),
        [this.adFallbackRemainingPreference]: remaining,
        [this.adFallbackTrialPreference]: this.adFallbackTrialActive,
      },
    }));
  }

  private async consumeAdFallbackAttemptAfterSuccess(
    operation: PdfOperation,
  ): Promise<void> {
    if (!this.adFallbackTrialActive) {
      return;
    }

    this.adFallbackRemaining = Math.max(
      0,
      this.resolveAdFallbackRemaining() - 1,
    );
    this.adFallbackTrialActive = false;
    await this.persistAdFallbackState();
    console.info(
      `[pdf-merger-and-splitter:ad-fallback] consumed on ${operation} ${JSON.stringify({
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
        return value;
      default:
        return 'unknown';
    }
  }

  private normalizeFailureConfidence(value: unknown): AdFailureConfidence {
    return value === 'high' ? 'high' : 'low';
  }
}
