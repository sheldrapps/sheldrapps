import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BillingService } from '@sheldrapps/ads-kit';
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
import {
  ActionCardComponent,
  FilePickerPanelComponent,
  SelectableButtonListComponent,
  ScrollableButtonBarComponent,
  TripleButtonComponent,
  WorkflowStepperComponent,
  WorkflowNavigationComponent,
  SpinnerComponent,
  type FilePickerPanelItem,
  type FilePickerPanelReorderEvent,
  type SelectableButtonListItem,
  type WorkflowStep,
  type ScrollableBarItem,
} from '@sheldrapps/ui-theme';
import { Router } from '@angular/router';
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
} from '@sheldrapps/image-workflow';
import { PdfMergerAndSplitterSettings } from '../../settings/pdf-merger-and-splitter-settings.schema';

type WorkflowStepId = 'merge-split' | 'select' | 'order' | 'bookmarks' | 'method' | 'ranges' | 'cover' | 'review';

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
    IonInput,
    WorkflowStepperComponent,
    ScrollableButtonBarComponent,
    WorkflowNavigationComponent,
    SpinnerComponent,
  ],
})
export class HomePage implements OnInit {
  private readonly rewrite = inject(PdfRewriteNativeService);
  private readonly splitPlanner = inject(PdfSplitPlannerService);
  private readonly library = inject(PdfLibraryService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly billing = inject(BillingService);
  private readonly settings = inject(SettingsStore<PdfMergerAndSplitterSettings>);
  private readonly recommendedApps = inject(RecommendedAppsService);
  private readonly editorSessionExit = inject(EditorSessionExitService);
  private readonly editorSession = inject(EditorSessionService);

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
  readonly splitMaximumSize = signal(10);
  readonly splitMaximumSizeSelection = signal('10');
  readonly splitMaximumSizeErrorKey = signal<string | null>(null);
  readonly cover = signal<PdfCoverDraft>({ source: 'none' });
  readonly coverFile = signal<File | null>(null);
  readonly coverImageUri = signal<string | null>(null);
  readonly isRebuildingExportQuality = signal(false);
  readonly adsRemoved = toSignal(this.billing.adsRemoved$, {
    initialValue: this.billing.isAdsRemoved(),
  });
  exportQualityMode: ExportQualityMode = DEFAULT_EXPORT_QUALITY_MODE;
  readonly workflowStep = signal(0);
  readonly isBusy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly pickerErrorKey = signal<string | null>(null);
  readonly outputName = signal('merged-document.pdf');
  readonly sessionId = signal<string | null>(null);
  readonly isResettingFlow = signal(false);
  readonly operationCompleted = signal(false);
  private lastEditorSessionId: string | undefined;
  private coverMasterBlob: Blob | undefined;
  readonly mergeIconSvg = signal<string | null>(null);
  readonly splitIconSvg = signal<string | null>(null);
  headerItems: ScrollableBarItem[] = [];

  readonly mergeSteps = [
    { id: 'merge-split' as WorkflowStepId, key: 'HOME.STEPPER.MERGE_SPLIT' },
    { id: 'select' as WorkflowStepId, key: 'HOME.STEPPER.SORT' },
    { id: 'bookmarks' as WorkflowStepId, key: 'HOME.STEPPER.TOC' },
    { id: 'cover' as WorkflowStepId, key: 'HOME.STEPPER.COVER' },
    { id: 'review' as WorkflowStepId, key: 'HOME.STEPPER.JOIN' },
  ];
  readonly splitSteps = [
    { id: 'merge-split' as WorkflowStepId, key: 'HOME.STEPPER.MERGE_SPLIT' },
    { id: 'method' as WorkflowStepId, key: 'HOME.SPLIT_HOW_TO' },
    { id: 'ranges' as WorkflowStepId, key: 'HOME.STEPPER.CONFIRM' },
    { id: 'cover' as WorkflowStepId, key: 'HOME.STEPPER.COVER' },
    { id: 'review' as WorkflowStepId, key: 'HOME.SPLIT' },
  ];

  readonly steps = computed(() =>
    this.selectedMode() === 'split' ? this.splitSteps : this.mergeSteps,
  );

  readonly workflowUiSteps = computed<WorkflowStep[]>(() =>
    this.steps().map((step) => ({
      id: step.id,
      label: this.translate.instant(step.key),
    })),
  );

  readonly selectableWorkflowSteps = computed(() =>
    Array.from({ length: this.workflowStep() + 1 }, (_, index) => index),
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
  readonly splitHasBookmarks = computed(() => this.splitPlanner.flattenBookmarks(this.splitPdf()?.analysis).length > 0);
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
    ...(['bookmarks', 'manual-cut-points', 'equal-number-of-parts', 'maximum-file-size'] as const).map((value) => ({
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

  readonly splitMaximumSizeItems = computed<readonly SelectableButtonListItem[]>(() => {
    const sizeMb = (this.splitPdf()?.sizeBytes ?? 0) / (1024 * 1024);
    const presets = [5, 10, 15]
      .filter((value) => value < sizeMb + (this.coverFile()?.size ?? 0) / (1024 * 1024))
      .map((value) => ({
        value: value.toString(),
        title: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_SIZE_OPTION', { size: value }),
        subline: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_SIZE_OPTION_SUBLINE', { count: this.estimateMaximumSizeOutputCount(value) }),
        ariaLabel: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_SIZE_OPTION', { size: value }),
      }));
    return [
      ...presets,
      {
        value: 'custom',
        titleKey: 'HOME.SPLIT_CONFIRM.CUSTOM_SIZE',
        sublineKey: 'HOME.SPLIT_CONFIRM.CUSTOM_SIZE_SUBLINE',
        ariaLabelKey: 'HOME.SPLIT_CONFIRM.CUSTOM_SIZE',
      },
    ];
  });

  readonly splitOutputs = computed(() => {
    const source = this.splitPdf();
    if (!source) return [];
    const pageCount = source.pageCount ?? 12;
    return this.splitPlanner.buildOutputs({
      analysis: this.splitPdf()?.analysis,
      sourceSizeBytes: source.sizeBytes,
      coverSizeBytes: this.coverFile()?.size ?? 0,
      method: this.splitMethod(),
      bookmarkMode: this.splitBookmarkMode(),
      manualMode: this.splitManualMode(),
      manualBookmarkIds: this.splitManualBookmarkIds(),
      manualPageInput: this.splitManualPageInput(),
      equalParts: this.splitEqualPartsValue(),
      maximumSizeMb: this.splitMaximumSize(),
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
    await Promise.all([this.refreshHeaderItems(), this.loadExportQualitySettings()]);
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
    if (this.isResettingFlow()) return;
    if (!(await this.editorSessionExit.confirmResetFlow())) return;
    this.isResettingFlow.set(true);
    try {
      await this.clearFlowState();
    } finally {
      this.isResettingFlow.set(false);
    }
  }

  async onOperationDone(): Promise<void> {
    if (this.isResettingFlow()) return;
    this.isResettingFlow.set(true);
    try {
      await this.clearFlowState();
      await this.router.navigateByUrl('/tabs/my-pdfs');
    } finally {
      this.isResettingFlow.set(false);
    }
  }

  private async clearFlowState(): Promise<void> {
    const sessionId = this.sessionId();
    if (sessionId) await this.rewrite.cleanupSession(sessionId);
    this.selectedMode.set(null);
    this.pendingMode.set(null);
    this.mergePdfs.set([]);
    this.splitPdf.set(null);
    this.resetSplitConfiguration();
    this.cover.set({ source: 'none' });
    this.coverFile.set(null);
    this.coverImageUri.set(null);
    this.coverMasterBlob = undefined;
    this.lastEditorSessionId = undefined;
    this.sessionId.set(null);
    this.workflowStep.set(0);
    this.errorKey.set(null);
    this.operationCompleted.set(false);
  }

  selectMode(mode: PdfOperation): void {
    this.operationCompleted.set(false);
    this.pendingMode.set(mode);
    this.selectedMode.set(null);
    this.workflowStep.set(0);
    this.errorKey.set(null);
    this.cover.set({ source: 'none' });
    this.coverFile.set(null);
    this.coverImageUri.set(null);
    this.coverMasterBlob = undefined;
    this.sessionId.set(null);
    if (mode === 'merge') this.splitPdf.set(null);
    if (mode === 'split') {
      this.mergePdfs.set([]);
      this.resetSplitConfiguration();
    }
    this.openPdfPicker();
  }

  onWorkflowStepSelected(step: number): void {
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
      const imported = await this.rewrite.pickAndImportPdf(session.id);
      this.selectedMode.set(mode);
      if (mode === 'split') {
        this.splitPdf.set(imported);
        this.splitMethod.set(this.splitHasBookmarks() ? 'bookmarks' : 'manual-cut-points');
        this.resetSplitConfiguration();
      } else {
        this.mergePdfs.set([...this.mergePdfs(), imported]);
      }
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
          this.rewrite.importPdf(session.id, URL.createObjectURL(file), file),
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
      this.workflowStep.set(1);
    } catch (error) {
      this.pickerErrorKey.set(this.pickerErrorKeyFor(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  async onCoverSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.coverFile.set(file);
    this.coverImageUri.set(file ? await this.rewrite.stageCoverImage(file) : null);
    this.cover.set(file ? { source: 'image', fileName: file.name } : { source: 'none' });
    this.coverMasterBlob = undefined;
    if (file) await this.openCoverEditor('image', file);
  }

  skipCover(): void {
    this.coverFile.set(null);
    this.coverImageUri.set(null);
    this.cover.set({ source: 'none' });
    this.coverMasterBlob = undefined;
  }

  async createCover(): Promise<void> {
    await this.openCoverEditor('scratch');
  }

  private async openCoverEditor(sourceMode: 'image' | 'scratch', file?: File): Promise<void> {
    if (sourceMode === 'image' && !file) return;
    const sessionId = this.editorSession.createSession({
      file,
      sourceMode,
      target: { width: 600, height: 800, output: 'target', unit: 'px', outputMode: 'fixed-size' },
      output: { includeRenderedBlob: true },
      returnUrl: '/tabs/home',
    });
    this.lastEditorSessionId = sessionId;
    await this.router.navigate(sourceMode === 'scratch' ? ['/editor/tools'] : ['/editor'], { queryParams: { sid: sessionId } });
  }

  private async consumeEditorResult(): Promise<void> {
    const snapshot = consumeEditorResultSnapshot(this.editorSession, this.lastEditorSessionId);
    if (!snapshot.result?.file) return;
    const result = snapshot.result;
    const file = result.file;
    this.coverMasterBlob = result.editorMasterBlob ?? result.renderedBlob ?? file;
    this.cover.set({ source: 'editor', fileName: file.name });
    await this.applySelectedExportQuality();
    if (this.lastEditorSessionId) this.editorSession.consumeResult(this.lastEditorSessionId);
    this.lastEditorSessionId = undefined;
  }

  getEffectiveExportQualityMode(): ExportQualityMode {
    return normalizeExportQualityMode(this.exportQualityMode, this.adsRemoved());
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

  private async applySelectedExportQuality(): Promise<void> {
    if (!this.coverMasterBlob) return;
    const rendered = await encodeRenderedBlob(
      this.coverMasterBlob,
      this.coverFile()?.name ?? 'cover',
      toEditorRenderQuality(this.getEffectiveExportQualityMode()),
      '#ffffff',
    );
    if (!rendered) return;

    this.coverFile.set(rendered);
    this.coverImageUri.set(await this.rewrite.stageCoverImage(rendered));
    this.cover.update((current) => ({ ...current, fileName: rendered.name }));
  }

  removeMergePdf(id: string): void {
    this.mergePdfs.set(this.mergePdfs().filter((pdf) => pdf.id !== id));
  }

  moveMergePdf(index: number, direction: -1 | 1): void {
    const target = index + direction;
    const pdfs = [...this.mergePdfs()];
    if (target < 0 || target >= pdfs.length) return;
    [pdfs[index], pdfs[target]] = [pdfs[target], pdfs[index]];
    this.mergePdfs.set(pdfs);
  }

  onSplitMethodChange(value: string): void {
    if (!['bookmarks', 'manual-cut-points', 'equal-number-of-parts', 'maximum-file-size'].includes(value)) return;
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

  onSplitMaximumSizeChange(value: string): void {
    if (value === 'custom') {
      this.splitMaximumSizeSelection.set('custom');
      return;
    }
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      this.splitMaximumSize.set(parsed);
      this.splitMaximumSizeSelection.set(value);
      this.splitMaximumSizeErrorKey.set(null);
    }
  }

  onSplitMaximumSizeInput(value: string | number | null | undefined): void {
    const parsed = Number(String(value ?? '').trim());
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      this.splitMaximumSizeErrorKey.set('HOME.SPLIT_CONFIRM.INVALID_MAXIMUM_SIZE');
      return;
    }
    this.splitMaximumSize.set(parsed);
    this.splitMaximumSizeSelection.set('custom');
    this.splitMaximumSizeErrorKey.set(null);
  }

  onSplitIntegerKeydown(event: KeyboardEvent): void {
    if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault();
  }

  canContinue(): boolean {
    if (!this.selectedMode()) return false;
    if (this.selectedMode() === 'merge') {
      if (this.workflowStep() === 1) return this.mergePdfs().length >= 2;
      return true;
    }
    if (this.workflowStep() === 0) return !!this.splitPdf();
    if (this.workflowStep() === 1) return this.splitMethod() !== 'bookmarks' || this.splitHasBookmarks();
    if (this.workflowStep() === 2) return this.splitOutputs().length >= 2;
    return true;
  }

  next(): void {
    if (!this.canContinue() || this.workflowStep() >= this.steps().length - 1) return;
    this.workflowStep.update((step) => step + 1);
  }

  previous(): void {
    this.operationCompleted.set(false);
    this.workflowStep.update((step) => Math.max(0, step - 1));
  }

  async execute(): Promise<void> {
    const mode = this.selectedMode();
    if (!mode || !this.canContinue()) return;
    this.isBusy.set(true);
    this.operationCompleted.set(false);
    this.errorKey.set(null);
    try {
      const sessionId = this.sessionId();
      if (!sessionId) throw new PdfRewriteError('SESSION_NOT_FOUND');
      let result;
      if (mode === 'merge') {
        result = await this.rewrite.mergePdf({
          sessionId,
          pdfs: this.mergePdfs(),
          bookmarkMode: this.bookmarkMode(),
          cover: this.cover(),
          outputName: this.outputName(),
          coverImageUri: this.coverImageUri() ?? undefined,
          coverQuality: this.getCoverPdfQuality(),
        });
      } else if (this.splitPdf()) {
        result = await this.rewrite.splitPdf({
          sessionId,
          source: this.splitPdf()!,
          method: this.splitMethod(),
          outputs: this.splitOutputs(),
          cover: this.cover(),
          coverImageUri: this.coverImageUri() ?? undefined,
          coverQuality: this.getCoverPdfQuality(),
        });
      }
      if (result) await this.saveOutputs(mode, result);
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
    this.splitMaximumSize.set(10);
    this.splitMaximumSizeSelection.set('10');
    this.splitMaximumSizeErrorKey.set(null);
  }

  private estimateMaximumSizeOutputCount(maximumSizeMb: number): number {
    return this.splitPlanner.buildOutputs({
      analysis: this.splitPdf()?.analysis,
      sourceSizeBytes: this.splitPdf()?.sizeBytes ?? 0,
      coverSizeBytes: this.coverFile()?.size ?? 0,
      method: 'maximum-file-size',
      bookmarkMode: 'chapter',
      manualMode: 'pages',
      manualBookmarkIds: [],
      manualPageInput: '',
      equalParts: 2,
      maximumSizeMb,
    }).length;
  }

  private errorKeyFor(error: unknown): string {
    if (error instanceof PdfRewriteError) {
      if (error.code === 'PDF_CORRUPT' || error.code === 'INVALID_PDF') {
        return 'PDF_WORKFLOW.ERRORS.INVALID_PDF';
      }
      if (error.code === 'PDF_TOO_LARGE') {
        return 'HOME.INPUT_ERROR_SIZE';
      }
      if (error.code === 'WEB_PDF_REWRITE_UNAVAILABLE' || error.code === 'PUBLIC_EXPORT_FAILED') {
        return 'PDF_WORKFLOW.NATIVE_ENGINE_NOTICE';
      }
      return `PDF_WORKFLOW.ERRORS.${error.code}`;
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
      if (error.code === 'WEB_PDF_REWRITE_UNAVAILABLE' || error.code === 'PUBLIC_EXPORT_FAILED') {
        return 'PDF_WORKFLOW.NATIVE_ENGINE_NOTICE';
      }
    }
    return 'HOME.INPUT_ERROR_CORRUPT';
  }

  private async saveOutputs(mode: PdfOperation, result: { operationId: string; outputUris: string[]; outputs?: Array<{ uri: string; fileName: string; sizeBytes: number }> }): Promise<void> {
    const outputs = result.outputs ?? result.outputUris.map((uri, index) => ({ uri, fileName: `document-${index + 1}.pdf`, sizeBytes: 0 }));
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
    })));
  }
}
