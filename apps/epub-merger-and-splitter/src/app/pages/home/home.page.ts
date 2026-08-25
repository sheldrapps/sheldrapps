import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { type PluginListenerHandle } from '@capacitor/core';
import { NavigationEnd, Router } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonButton,
  IonIcon,
  IonInput,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AdsService, BillingService } from '@sheldrapps/ads-kit';
import { SettingsStore } from '@sheldrapps/settings-kit';
import {
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
  CoverSourceActionsComponent,
  CoverImageStateComponent,
  ImagePipelineService,
  PreviewEditingPageService,
  buildDefaultCoverCropState,
  buildCompositionInput,
  encodeRenderedBlob,
  getCoverExportOptions,
  renderCompositionToFile,
  type CoverCropState,
  type CropFormatOption,
  type CropTarget,
  type CropperResult,
  toEditorRenderQuality,
} from '@sheldrapps/image-workflow';
import {
  EditorSessionService,
  EditorSessionExitService,
  consumeEditorResultSnapshot,
} from '@sheldrapps/image-workflow/editor';
import {
  ActionCardComponent,
  FilePickerPanelComponent,
  TripleButtonComponent,
  ScrollableButtonBarComponent,
  WorkflowStepperComponent,
  WorkflowNavigationComponent,
  SpinnerComponent,
  EpubDiagnosticIssuesComponent,
  type EpubDiagnosticIssueView,
  type WorkflowStep,
  type ScrollableBarItem,
  type FilePickerPanelItem,
  type FilePickerPanelRemoveEvent,
  type FilePickerPanelReorderEvent,
  SelectableButtonListComponent,
  type SelectableButtonListItem,
} from '@sheldrapps/ui-theme';
import { addIcons } from 'ionicons';
import {
  appsOutline,
  sparklesOutline,
  refreshOutline,
} from 'ionicons/icons';
import {
  EpubRewriteError,
  WebDevEpubFixerAdapter,
  buildCoverOnlyEpubBytes,
  type EpubDiagnosticIssue,
  type EpubSplitTocEntry,
  type EpubOperationProgress,
  EpubRewriteService,
  EpubWorkingCopyService,
  FileKitService,
  type NativeTempFile,
} from '@sheldrapps/file-kit';
import { filter, Subscription } from 'rxjs';
import { MergeCoverCandidateService } from '../../services/merge-cover-candidate.service';
import {
  EpubLibraryService,
  type EpubLibraryRecord,
} from '../../services/epub-library.service';
import { CoversEventsService } from '../../services/covers-events.service';
import {
  SplitAnalysisService,
  type SplitAnalysis,
  type SplitAnalysisTocEntry,
} from '../../services/split-analysis.service';
import { EpubMergerAndSplitterSettings } from '../../settings/epub-merger-and-splitter-settings.schema';
import {
  RecommendedAppsService,
  RecommendedAppCardComponent,
  buildHomeHeaderItems,
  getRecommendedAppsTranslations,
  handleHomeHeaderAction,
  openRecommendedApp,
  type RecommendedApp,
} from '@sheldrapps/recommended-apps';
import {
  LifecycleDiagnosticsService,
  WorkflowRecoveryCoordinator,
} from '@sheldrapps/lifecycle-kit';

type HomeMode = 'merge' | 'split';
type CoverSourceMode = 'candidate' | 'image' | 'scratch' | 'none';
type EditorSourceMode = 'image' | 'scratch';
type EditorEntryMode = 'new-cover' | 'existing-cover';
type TocMode = 'books-and-chapters' | 'books-only' | 'full-index';
type SplitMethod =
  | 'by-chapters-or-sections'
  | 'manual-split-points'
  | 'equal-parts'
  | 'maximum-file-size';

type SplitChapterMode = 'chapter' | 'section';

type SplitOutputPreview = {
  number: number;
  title: string;
  startUnit: number;
  endUnit: number;
  bookSizeBytes: number;
  coverSizeBytes: number;
  sizeBytes: number;
};

type EpubOperationFeedback = {
  operation: HomeMode;
  status: 'success' | 'error';
  outputs: readonly EpubLibraryRecord[];
  warnings: readonly string[];
  previewUrl?: string;
  errorKey?: string;
  errorDetails?: string;
};

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
  coverFile?: File;
  coverEntryPath?: string;
  workingNativePath: string | null;
  outputBaseName: string;
  sourceKind: 'native' | 'web';
  diagnosisStatus?: 'valid' | 'repairable';
  diagnosisIssues?: EpubDiagnosticIssue[];
  diagnosisMode?: 'quick' | 'deep';
  diagnosisCoverage?: 'complete' | 'limited';
};

type EmasRecoverySelection = Omit<SelectedEpubInput, 'workingFile' | 'coverFile'>;

type EmasRecoverySnapshot = {
  selectedMode: HomeMode | null;
  workflowStep: number;
  operationInProgress?: boolean;
  mergeSelections: EmasRecoverySelection[];
  splitSelection: EmasRecoverySelection | null;
  selectedCoverCandidateId?: string;
  coverSourceMode: CoverSourceMode | null;
  splitMethod: SplitMethod;
  tocMode: TocMode;
};

const EPUB_ACCEPT = '.epub,application/epub+zip';
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const MAX_EPUB_SIZE_MB = 2048;
const COVER_THUMB_SIZE = 96;
const SPLIT_METHOD_VALUES = new Set<SplitMethod>([
  'by-chapters-or-sections',
  'manual-split-points',
  'equal-parts',
  'maximum-file-size',
]);

const MERGE_FILE_SELECTION_STEP = 0;
const MERGE_COVER_STEP = 3;
const MERGE_EDITOR_STEP = 4;
const MERGE_RESULT_STEP = 5;
const WEB_DUMMY_EPUB_CREATOR = 'EPUB Merger & Splitter';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    TranslateModule,
    IonButtons,
    IonContent,
    IonHeader,
    IonButton,
    IonIcon,
    IonInput,
    IonTitle,
    IonToolbar,
    IonButtons,
    ActionCardComponent,
    BestCandidatePickerComponent,
    CoverSourceActionsComponent,
    CoverImageStateComponent,
    TripleButtonComponent,
    ScrollableButtonBarComponent,
    WorkflowStepperComponent,
    WorkflowNavigationComponent,
    SpinnerComponent,
    EpubDiagnosticIssuesComponent,
    FilePickerPanelComponent,
    SelectableButtonListComponent,
    RecommendedAppCardComponent,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly fileKit = inject(FileKitService);
  private readonly epubRewrite = inject(EpubRewriteService);
  private readonly webEpubFixer = inject(WebDevEpubFixerAdapter);
  private readonly epubWorkingCopy = inject(EpubWorkingCopyService);
  private readonly epubLibrary = inject(EpubLibraryService);
  private readonly coversEvents = inject(CoversEventsService);
  private readonly imagePipeline = inject(ImagePipelineService);
  private readonly previewEditingPage = inject(PreviewEditingPageService);
  private readonly editorSession = inject(EditorSessionService);
  private readonly editorSessionExit = inject(EditorSessionExitService);
  private readonly bestCandidate = inject(BestCandidateService);
  private readonly mergeCoverCandidate = inject(MergeCoverCandidateService);
  private readonly splitAnalysisService = inject(SplitAnalysisService);
  private readonly settings = inject(
    SettingsStore<EpubMergerAndSplitterSettings>,
  );
  private readonly ads = inject(AdsService);
  private readonly billing = inject(BillingService);
  private readonly translate = inject(TranslateService);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  private readonly lifecycle = inject(LifecycleDiagnosticsService);
  private readonly recovery = inject(WorkflowRecoveryCoordinator);
  private readonly candidateBlobUrls = new Set<string>();

  get epubFixerCopy() {
    return getRecommendedAppsTranslations(this.translate.currentLang);
  }
  headerItems: ScrollableBarItem[] = [];
  workflowSteps: WorkflowStep[] = [];
  private _workflowStep = 0;

  get workflowStep(): number {
    return this._workflowStep;
  }

  set workflowStep(value: number) {
    if (this.hasWorkflowErrorState()) {
      this._workflowStep = this.selectedMode?.() === 'merge'
        ? MERGE_FILE_SELECTION_STEP
        : 0;
      this.scrollWorkflowToTop();
      return;
    }

    this._workflowStep = value;
    this.scrollWorkflowToTop();
  }

  get visibleWorkflowSteps(): readonly WorkflowStep[] {
    if (this.selectedMode() === 'merge') {
      return this.workflowSteps;
    }

    if (this.selectedMode() === 'split') {
      return [
        this.workflowSteps[0],
        this.splitWorkflowStep,
        this.splitConfirmStep,
        this.splitCoverStep,
        this.splitAdjustStep,
        this.splitExecutionStep,
      ];
    }

    return this.workflowSteps.slice(0, 1);
  }

  private splitWorkflowStep: WorkflowStep = {
    id: 'split-method',
    label: '',
  };

  private splitConfirmStep: WorkflowStep = {
    id: 'split-confirm',
    label: '',
  };

  private splitCoverStep: WorkflowStep = {
    id: 'split-cover',
    label: '',
  };

  private splitAdjustStep: WorkflowStep = {
    id: 'split-adjust',
    label: '',
  };

  private splitExecutionStep: WorkflowStep = {
    id: 'split-execution',
    label: '',
  };

  get showWorkflowPrevious(): boolean {
    return this.workflowStep > 0;
  }

  get showWorkflowNext(): boolean {
    return this.workflowStep < this.visibleWorkflowSteps.length - 1;
  }

  get workflowNavigationBlocked(): boolean {
    return this.hasWorkflowErrorState();
  }

  get workflowNextDisabled(): boolean {
    if (this.workflowNavigationBlocked) {
      return true;
    }

    if (
      this.selectedMode() === 'split' &&
      this.workflowStep === 2 &&
      !this.splitCanExecute()
    ) {
      return true;
    }

    return (
      (this.selectedMode() === 'merge' || this.selectedMode() === 'split') &&
      this.workflowStep === this.coverWorkflowStep &&
      !this.canOpenMergeCoverEditor()
    );
  }

  private get coverWorkflowStep(): number {
    return this.selectedMode() === 'merge' ? MERGE_COVER_STEP : 3;
  }

  private get editorWorkflowStep(): number {
    return this.selectedMode() === 'merge' ? MERGE_EDITOR_STEP : 4;
  }

  private get resultWorkflowStep(): number {
    return this.selectedMode() === 'merge' ? MERGE_RESULT_STEP : 5;
  }

  get workflowNextLabel(): string {
    return this.visibleWorkflowSteps[this.workflowStep + 1]?.label ?? '';
  }

  get workflowPreviousLabel(): string {
    return this.visibleWorkflowSteps[this.workflowStep - 1]?.label ?? '';
  }

  get workflowLoadingLabelKey(): string {
    return this.splitAnalysisPending()
      ? 'HOME.SPLIT_CONFIRM.ANALYZING'
      : 'COMMON.LOADING';
  }

  get operationFeedbackTitleKey(): string {
    const feedback = this.operationFeedback();
    if (!feedback) {
      return '';
    }
    if (feedback.status === 'error') {
      return feedback.operation === 'merge'
        ? 'HOME.OPERATION.MERGE_FAILURE_TITLE'
        : 'HOME.OPERATION.SPLIT_FAILURE_TITLE';
    }
    return feedback.operation === 'merge'
      ? 'HOME.OPERATION.MERGE_SUCCESS_TITLE'
      : 'HOME.OPERATION.SPLIT_SUCCESS_TITLE';
  }

  get operationFeedbackBodyKey(): string {
    const feedback = this.operationFeedback();
    if (!feedback) {
      return '';
    }
    if (feedback.status === 'error') {
      return feedback.errorKey ?? '';
    }
    return feedback.operation === 'merge'
      ? 'HOME.OPERATION.MERGE_SUCCESS_BODY'
      : 'HOME.OPERATION.SPLIT_SUCCESS_BODY';
  }

  get operationProgressLabelKey(): string {
    const phase = this.operationProgress()?.phase;
    if (phase === 'analyzing') return 'HOME.OPERATION.PROGRESS.ANALYZING';
    if (phase === 'writing') return 'HOME.OPERATION.PROGRESS.WRITING';
    if (phase === 'validating') return 'HOME.OPERATION.PROGRESS.VALIDATING';
    if (phase === 'completed') return 'HOME.OPERATION.PROGRESS.COMPLETED';
    return 'HOME.OPERATION.PROGRESS.PREPARING';
  }

  get splitConfirmTitleKey(): string {
    return {
      'by-chapters-or-sections': 'HOME.SPLIT_CONFIRM.BY_CHAPTERS_TITLE',
      'manual-split-points': 'HOME.SPLIT_CONFIRM.MANUAL_TITLE',
      'equal-parts': 'HOME.SPLIT_CONFIRM.EQUAL_TITLE',
      'maximum-file-size': 'HOME.SPLIT_CONFIRM.MAXIMUM_SIZE_TITLE',
    }[this.splitMethod];
  }

  get splitSummaryLine(): string {
    const analysis = this.splitAnalysis();
    if (!analysis) return '';
    return this.translate.instant('HOME.SPLIT_CONFIRM.FILE_SUMMARY', {
      name: analysis.fileName,
      count: analysis.units.length,
      size: this.formatMegabytes(analysis.fileSizeBytes),
    });
  }

  get splitUnitCount(): number {
    return this.splitAnalysis()?.units.length ?? 1;
  }

  get splitHasSections(): boolean {
    return this.splitAnalysis()?.sections.length ? this.splitAnalysis()!.sections.length > 1 : false;
  }

  get splitChapterModeItems(): readonly SelectableButtonListItem[] {
    return [
      {
        value: 'chapter',
        titleKey: 'HOME.SPLIT_CONFIRM.BY_CHAPTER',
        sublineKey: 'HOME.SPLIT_CONFIRM.BY_CHAPTER_SUBLINE',
        ariaLabelKey: 'HOME.SPLIT_CONFIRM.BY_CHAPTER',
        leadingIconSrc: 'assets/icons/notebook2-outline.svg',
      },
      {
        value: 'section',
        titleKey: 'HOME.SPLIT_CONFIRM.BY_SECTION',
        sublineKey: 'HOME.SPLIT_CONFIRM.BY_SECTION_SUBLINE',
        ariaLabelKey: 'HOME.SPLIT_CONFIRM.BY_SECTION',
        leadingIconSrc: 'assets/icons/widget-outline.svg',
      },
    ];
  }

  get splitEqualPartsItems(): readonly SelectableButtonListItem[] {
    const max = this.splitAnalysis()?.units.length ?? 0;
    const values = [2, 3, 4].filter((value) => value <= max);
    return [
      ...values.map((value) => ({
        value: value.toString(),
        title: this.translate.instant('HOME.SPLIT_CONFIRM.PART_COUNT', { count: value }),
        subline: this.translate.instant('HOME.SPLIT_CONFIRM.PART_COUNT_SUBLINE', {
          count: Math.ceil(max / value),
        }),
        ariaLabel: this.translate.instant('HOME.SPLIT_CONFIRM.PART_COUNT', { count: value }),
        leadingIconSrc: 'assets/icons/widget-outline.svg',
      })),
      {
        value: 'custom',
        titleKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PART_COUNT',
        sublineKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PART_COUNT_SUBLINE',
        ariaLabelKey: 'HOME.SPLIT_CONFIRM.CUSTOM_PART_COUNT',
        leadingIconSrc: 'assets/icons/check-list-square-outline.svg',
        disabled: max < 2,
      },
    ];
  }

  get splitMaximumSizeItems(): readonly SelectableButtonListItem[] {
    const fileSize = this.splitAnalysis()?.fileSizeBytes ?? 0;
    const fileSizeMb = fileSize / (1024 * 1024);
    const presets: SelectableButtonListItem[] = [5, 10, 15]
      .filter((value) => value < fileSizeMb)
      .map((value) => ({
        value: value.toString(),
        title: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_SIZE_OPTION', { size: value }),
        subline: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_SIZE_OPTION_SUBLINE', { count: Math.ceil(fileSizeMb / value) }),
        ariaLabel: this.translate.instant('HOME.SPLIT_CONFIRM.MAXIMUM_SIZE_OPTION', { size: value }),
        leadingIconSrc: 'assets/icons/ruler2-outline.svg',
      }));
    return [
      ...presets,
      {
        value: 'custom',
        titleKey: 'HOME.SPLIT_CONFIRM.CUSTOM_SIZE',
        sublineKey: 'HOME.SPLIT_CONFIRM.CUSTOM_SIZE_SUBLINE',
        ariaLabelKey: 'HOME.SPLIT_CONFIRM.CUSTOM_SIZE',
        leadingIconSrc: 'assets/icons/ruler2-outline.svg',
      },
    ];
  }

  get splitEqualPartsSelection(): string {
    return this.splitEqualPartsSelectionValue;
  }

  get splitManualPointItems(): readonly SelectableButtonListItem[] {
    const chapters = this.splitAnalysis()?.units ?? [];
    return chapters.map((unit, index) => ({
      value: unit.id,
      kind: index === 0 ? 'static' : 'action',
      title: index === 0
        ? this.translate.instant('HOME.SPLIT_CONFIRM.BOOK_START')
        : this.translate.instant('HOME.SPLIT_CONFIRM.BEFORE_CHAPTER', { title: unit.title }),
      subline: index === 0
        ? this.translate.instant('HOME.SPLIT_CONFIRM.BOOK_START_SUBLINE')
        : this.translate.instant('HOME.SPLIT_CONFIRM.BEFORE_CHAPTER_SUBLINE', { title: unit.title }),
      ariaLabel: index === 0
        ? this.translate.instant('HOME.SPLIT_CONFIRM.BOOK_START')
        : this.translate.instant('HOME.SPLIT_CONFIRM.BEFORE_CHAPTER', { title: unit.title }),
      leadingIconSrc: 'assets/icons/check-list-square-outline.svg',
    }));
  }

  get splitManualPointValues(): readonly string[] {
    const first = this.splitAnalysis()?.units[0]?.id;
    return first ? [first, ...this.splitManualPointIds()] : [];
  }

  get selectableWorkflowSteps(): readonly number[] {
    if (this.workflowNavigationBlocked) {
      return [this.fileSelectionWorkflowStep];
    }

    if (this.selectedMode() !== 'merge') {
      if (!this.splitSelection()) {
        return [0];
      }

      const steps = [0, 1, 2, 3];
      if (this.canOpenMergeCoverEditor()) {
        steps.push(4);
      }
      if (this.mergeCoverRenderedFile || this.coverSourceMode() === 'none') {
        steps.push(5);
      }
      return steps;
    }

    const steps = [0, 1, 2, 3];
    if (this.canOpenMergeCoverEditor()) {
      steps.push(4);
    }
    if (this.mergeCoverRenderedFile || this.coverSourceMode() === 'none') {
      steps.push(5);
    }
    return steps;
  }

  @ViewChild('mergeInput') private mergeInput?: ElementRef<HTMLInputElement>;
  @ViewChild('splitInput') private splitInput?: ElementRef<HTMLInputElement>;
  @ViewChild(IonContent) private homeContent?: IonContent;
  @ViewChild('coverImageInput')
  private coverImageInput?: ElementRef<HTMLInputElement>;

  readonly selectedMode = signal<HomeMode | null>(null);
  readonly mergeIconSvg = signal<string | null>(null);
  readonly splitIconSvg = signal<string | null>(null);
  readonly epubCoverChanger = signal<RecommendedApp | null>(null);
  readonly epubFixer = signal<RecommendedApp | null>(null);
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
  splitMethod: SplitMethod = 'by-chapters-or-sections';
  splitChapterMode: SplitChapterMode = 'chapter';
  splitEqualPartsValue = 2;
  splitEqualPartsSelectionValue = '2';
  splitMaximumSize = 10;
  splitMaximumSizeSelection = '10';
  readonly splitAnalysis = signal<SplitAnalysis | null>(null);
  readonly splitAnalysisPending = signal(false);
  readonly splitManualPointIds = signal<readonly string[]>([]);
  readonly splitPreviewExpanded = signal(false);
  readonly splitConfigurationRevision = signal(0);
  readonly splitEqualPartsErrorKey = signal<string | null>(null);
  readonly splitMaximumSizeErrorKey = signal<string | null>(null);
  readonly splitOutputPreviews = computed(() => {
    this.splitConfigurationRevision();
    return this.buildSplitOutputPreviews();
  });
  readonly splitCanExecute = computed(
    () => !this.splitAnalysisPending() && this.splitOutputPreviews().length >= 2,
  );
  readonly pickerErrorKey = signal<string | null>(null);
  readonly pickerErrorIssues = signal<EpubDiagnosticIssue[]>([]);
  readonly pickerErrorDiagnosisName = signal<string | null>(null);
  readonly isPicking = signal(false);
  readonly isResettingFlow = signal(false);
  readonly isRebuildingExportQuality = signal(false);
  readonly isDetectingCoverCandidates = signal(false);
  readonly isMergeActionBusy = signal(false);
  readonly operationProgress = signal<EpubOperationProgress | null>(null);
  readonly diagnosisProgress = signal<EpubOperationProgress | null>(null);
  readonly operationFeedback = signal<EpubOperationFeedback | null>(null);
  readonly epubRepairRequired = computed(
    () =>
      this.mergeSelections().some(
        (selection) => this.hasEpubDiagnosticErrors(selection),
      ) ||
      (this.splitSelection()
        ? this.hasEpubDiagnosticErrors(this.splitSelection()!)
        : false),
  );
  readonly repairableEpubSelections = computed(() => [
    ...this.mergeSelections(),
    ...(this.splitSelection() ? [this.splitSelection()!] : []),
  ].filter((selection) => this.hasEpubDiagnosticErrors(selection)));
  readonly epubRepairMessageKey = computed(() =>
    this.repairableEpubSelections().length > 1
      ? 'FIX.REPAIR_REQUIRED_MULTIPLE'
      : 'FIX.REPAIR_REQUIRED_SINGLE',
  );
  readonly epubFixerRecommendation = computed(() => {
    return this.epubRepairRequired() ? this.epubFixer() : null;
  });
  readonly issueMessageResolver = (issue: EpubDiagnosticIssueView): string =>
    this.issueMessageLabel(issue);
  readonly issueDetailsResolver = (issue: EpubDiagnosticIssueView): string =>
    this.issueDetailsLabel(issue);

  get fileSelectionWorkflowStep(): 0 | 1 {
    return this.selectedMode() === 'merge'
      ? MERGE_FILE_SELECTION_STEP
      : 0;
  }
  adsRemoved = false;
  readonly epubAccept = EPUB_ACCEPT;
  readonly imageAccept = IMAGE_ACCEPT;
  readonly mergePickerItems = computed<readonly FilePickerPanelItem[]>(() =>
    this.mergeSelections().map((selection) => ({
      id: selection.id,
      title: selection.selectedName,
    })),
  );
  readonly splitMethodItems: readonly SelectableButtonListItem[] = [
    {
      value: 'by-chapters-or-sections',
      titleKey: 'HOME.SPLIT_OPTIONS.BY_CHAPTERS_OR_SECTIONS.TITLE',
      sublineKey: 'HOME.SPLIT_OPTIONS.BY_CHAPTERS_OR_SECTIONS.SUBLINE',
      ariaLabelKey: 'HOME.SPLIT_OPTIONS.BY_CHAPTERS_OR_SECTIONS.TITLE',
      leadingIconSrc: 'assets/icons/notebook2-outline.svg',
    },
    {
      value: 'manual-split-points',
      titleKey: 'HOME.SPLIT_OPTIONS.MANUAL_SPLIT_POINTS.TITLE',
      sublineKey: 'HOME.SPLIT_OPTIONS.MANUAL_SPLIT_POINTS.SUBLINE',
      ariaLabelKey: 'HOME.SPLIT_OPTIONS.MANUAL_SPLIT_POINTS.TITLE',
      leadingIconSrc: 'assets/icons/check-list-square-outline.svg',
    },
    {
      value: 'equal-parts',
      titleKey: 'HOME.SPLIT_OPTIONS.EQUAL_PARTS.TITLE',
      sublineKey: 'HOME.SPLIT_OPTIONS.EQUAL_PARTS.SUBLINE',
      ariaLabelKey: 'HOME.SPLIT_OPTIONS.EQUAL_PARTS.TITLE',
      leadingIconSrc: 'assets/icons/widget-outline.svg',
    },
    {
      value: 'maximum-file-size',
      titleKey: 'HOME.SPLIT_OPTIONS.MAXIMUM_FILE_SIZE.TITLE',
      sublineKey: 'HOME.SPLIT_OPTIONS.MAXIMUM_FILE_SIZE.SUBLINE',
      ariaLabelKey: 'HOME.SPLIT_OPTIONS.MAXIMUM_FILE_SIZE.TITLE',
      leadingIconSrc: 'assets/icons/ruler2-outline.svg',
    },
  ];
  private readonly formatOptions = this.buildFormatOptions();
  private routerSub?: Subscription;
  private adsRemovedSub?: Subscription;
  private languageSub?: Subscription;
  private operationProgressListener?: PluginListenerHandle;
  private flowEpoch = 0;
  private lastEditorSessionId?: string;
  private lastEditorSourceMode: EditorSourceMode = 'image';
  private editorEntryMode: EditorEntryMode = 'new-cover';
  private editorReturnStep = 3;
  private mergeCoverSourceFile?: File;
  private mergeCoverWorkingFile?: File;
  private mergeCoverMasterBlob?: Blob;
  private mergeCoverRenderedFile?: File;
  private mergeCoverQualityRevision = 0;
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
      'existing-cover',
      this.resultWorkflowStep,
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

    await this.clearFlowState();
  }

  async resetFlow(): Promise<void> {
    if (this.isResettingFlow()) return;
    if (!(await this.editorSessionExit.confirmResetFlow())) return;
    this.isResettingFlow.set(true);
    this.changeDetector?.detectChanges();
    try {
      await this.clearFlowState();
    } finally {
      this.isResettingFlow.set(false);
      this.changeDetector?.detectChanges();
    }
  }

  private async clearFlowState(): Promise<void> {
    this.invalidateFlowEpoch();
    await this.cancelNativeRewrite();
    const cleanupPromise = this.cleanupAllSelections();
    this.clearPickerError();
    this.operationFeedback.set(null);
    this.operationProgress.set(null);
    this.diagnosisProgress?.set(null);
    this.isPicking.set(false);
    this.isDetectingCoverCandidates.set(false);
    this.isRebuildingExportQuality?.set(false);
    this.isMergeActionBusy.set(false);
    this.splitAnalysisPending.set(false);
    this.splitAnalysis.set(null);
    this.splitMethod = 'by-chapters-or-sections';
    this.tocMode = 'books-and-chapters';
    this.resetSplitConfiguration();
    this.closePreview();
    this.selectedMode.set(null);
    this.workflowStep = 0;
    this.resetFileInput(this.mergeInput?.nativeElement);
    this.resetFileInput(this.splitInput?.nativeElement);
    this.resetCoverSelection(true);
    this.mergeCoverQualityRevision =
      (this.mergeCoverQualityRevision ?? 0) + 1;
    this.editorSession?.clearSessions?.();
    await cleanupPromise;
    await this.recovery.clear();
  }

  constructor() {
    addIcons({ appsOutline, sparklesOutline, refreshOutline });
    this.refreshWorkflowStepLabels();
    void this.loadIcons();
  }

  async ngOnInit(): Promise<void> {
    this.refreshWorkflowStepLabels();
    this.languageSub = this.translate.onLangChange.subscribe(() => {
      this.refreshWorkflowStepLabels();
    });
    void this.hydrateAdsState();
    void this.attachOperationProgressListener();
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
    void this.refreshHeaderItems();
    this.registerRecovery();
    const restoreEpoch = this.currentFlowEpoch();
    await this.recovery.restore();
    if (!this.isFlowEpochCurrent(restoreEpoch)) {
      return;
    }
  }

  async ionViewWillEnter(): Promise<void> {
    this.lifecycle.log('Ionic.HomePage.ionViewWillEnter', {
      workflowStep: this.workflowStep,
    });
    await this.refreshHeaderItems();
  }

  ionViewWillLeave(): void {
    this.lifecycle.log('Ionic.HomePage.ionViewWillLeave', {
      workflowStep: this.workflowStep,
    });
    void this.recovery.save();
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
    const recommendedApps = await this.recommendedAppsService.getRecommendedApps();
    this.epubCoverChanger.set(
      recommendedApps.find(
        (app) => app.packageName === 'com.sheldrapps.epubcoverchanger',
      ) ?? null,
    );
    this.epubFixer.set(
      recommendedApps.find(
        (app) => app.packageName === 'com.sheldrapps.epubfixer',
      ) ?? null,
    );
    this.headerItems = buildHomeHeaderItems(recommendedApps.length > 0, {
      appsLabel: this.translate.instant('ARR.TOOLS.APPS'),
      resetLabel: this.translate.instant('UI_THEME.RESET'),
      includeGuide: false,
    });
  }

  async openEpubCoverChanger(): Promise<void> {
    const epubCoverChanger =
      this.epubCoverChanger() ??
      (await this.recommendedAppsService.getRecommendedApps()).find(
        (app) => app.packageName === 'com.sheldrapps.epubcoverchanger',
      );
    if (!epubCoverChanger?.playStoreUrl) {
      return;
    }

    await openRecommendedApp(epubCoverChanger.playStoreUrl);
  }

  async openEpubFixer(): Promise<void> {
    const epubFixer =
      this.epubFixer() ??
      (await this.recommendedAppsService.getRecommendedApps()).find(
        (app) => app.packageName === 'com.sheldrapps.epubfixer',
      );
    if (epubFixer?.playStoreUrl) {
      await openRecommendedApp(epubFixer.playStoreUrl);
    }
  }

  async onWorkflowPrevious(): Promise<void> {
    if (this.isMergeActionBusy() || this.isResettingFlow()) {
      return;
    }

    if (this.workflowNavigationBlocked) {
      this.returnToFileSelectionStep();
      return;
    }

    if (
      this.workflowStep === this.resultWorkflowStep &&
      this.canOpenMergeCoverEditor()
    ) {
      await this.openMergeCoverEditor(
        'existing-cover',
        this.resultWorkflowStep,
      );
      return;
    }

    if (this.selectedMode() === 'split' && this.workflowStep === 2) {
      this.onSplitBackToHowTo();
      return;
    }

    if (this.workflowStep > 0) {
      this.workflowStep -= 1;
    }
  }

  async onWorkflowNext(): Promise<void> {
    if (this.isMergeActionBusy() || this.isResettingFlow()) {
      return;
    }

    if (this.workflowNavigationBlocked) {
      this.returnToFileSelectionStep();
      return;
    }

    if (
      this.workflowStep === this.coverWorkflowStep &&
      this.canOpenMergeCoverEditor()
    ) {
      await this.openMergeCoverEditor(
        this.mergeCoverRenderedFile ? 'existing-cover' : 'new-cover',
        this.coverWorkflowStep,
      );
      return;
    }

    if (
      this.workflowStep === this.coverWorkflowStep
    ) {
      return;
    }

    if (this.workflowStep < this.visibleWorkflowSteps.length - 1) {
      this.workflowStep += 1;
    }
  }

  async onWorkflowStepSelected(step: number): Promise<void> {
    if (this.isMergeActionBusy() || this.isResettingFlow()) {
      return;
    }

    if (this.workflowNavigationBlocked) {
      this.returnToFileSelectionStep();
      return;
    }

    if (step === this.editorWorkflowStep && this.canOpenMergeCoverEditor()) {
      await this.openMergeCoverEditor(
        this.mergeCoverRenderedFile ? 'existing-cover' : 'new-cover',
        this.resultWorkflowStep,
      );
      return;
    }

    if (this.selectableWorkflowSteps.includes(step)) {
      if (this.selectedMode() === 'split' && this.workflowStep >= 2 && step === 1) {
        this.resetSplitConfiguration();
      }
      this.workflowStep = step;
    }
  }

  onSplitMethodChange(value: string): void {
    if (!SPLIT_METHOD_VALUES.has(value as SplitMethod)) {
      return;
    }

    const nextMethod = value as SplitMethod;
    const analysis = typeof this.splitAnalysis === 'function'
      ? this.splitAnalysis()
      : null;
    const unitCount = analysis?.units.length ?? 0;

    this.resetSplitConfiguration(false);
    this.splitMethod = nextMethod;
    if (nextMethod === 'equal-parts' && unitCount >= 2) {
      this.splitEqualPartsValue = 2;
      this.splitEqualPartsSelectionValue = '2';
    }
    this.markSplitConfigurationChanged();
    this.changeDetector?.markForCheck();
  }

  onSplitChapterModeChange(value: string): void {
    if (value === 'chapter' || value === 'section') {
      this.splitChapterMode = value;
      this.markSplitConfigurationChanged();
    }
  }

  onSplitEqualPartsValueChange(value: number): void {
    const max = this.splitAnalysis()?.units.length ?? 1;
    if (!Number.isSafeInteger(value) || value < 2 || value > max) {
      this.splitEqualPartsErrorKey.set('HOME.SPLIT_CONFIRM.INVALID_PART_COUNT');
      return;
    }

    this.splitEqualPartsValue = value;
    this.splitEqualPartsSelectionValue = 'custom';
    this.splitEqualPartsErrorKey.set(null);
    this.markSplitConfigurationChanged();
  }

  onSplitEqualPartsInput(value: string | number | null | undefined): void {
    const rawValue = String(value ?? '').trim();
    if (!/^\d+$/.test(rawValue)) {
      this.splitEqualPartsErrorKey.set('HOME.SPLIT_CONFIRM.INVALID_PART_COUNT');
      return;
    }

    this.onSplitEqualPartsValueChange(Number(rawValue));
  }

  onSplitEqualPartsChange(value: string): void {
    if (value === 'custom') {
      this.splitEqualPartsSelectionValue = 'custom';
      this.splitEqualPartsErrorKey.set(null);
      this.markSplitConfigurationChanged();
      return;
    }

    if (/^\d+$/.test(value)) {
      const max = this.splitAnalysis()?.units.length ?? 1;
      const parsedValue = Number(value);
      if (Number.isSafeInteger(parsedValue) && parsedValue >= 2 && parsedValue <= max) {
        this.splitEqualPartsSelectionValue = value;
        this.splitEqualPartsValue = parsedValue;
        this.splitEqualPartsErrorKey.set(null);
        this.markSplitConfigurationChanged();
      }
    }
  }

  onSplitMaximumSizeChange(value: string): void {
    this.splitMaximumSizeSelection = value;
    if (value !== 'custom') {
      this.splitMaximumSize = Number(value);
    }
    this.splitMaximumSizeErrorKey.set(null);
    this.markSplitConfigurationChanged();
  }

  onSplitMaximumSizeInput(value: string | number | null | undefined): void {
    const rawValue = String(value ?? '').trim();
    if (!/^\d+$/.test(rawValue)) {
      this.splitMaximumSizeErrorKey.set('HOME.SPLIT_CONFIRM.INVALID_MAXIMUM_SIZE');
      return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isSafeInteger(parsedValue) || parsedValue < 1) {
      this.splitMaximumSizeErrorKey.set('HOME.SPLIT_CONFIRM.INVALID_MAXIMUM_SIZE');
      return;
    }

    this.splitMaximumSize = parsedValue;
    this.splitMaximumSizeErrorKey.set(null);
    this.markSplitConfigurationChanged();
  }

  onSplitIntegerKeydown(event: KeyboardEvent): void {
    if (['e', 'E', '+', '-', '.', ','].includes(event.key)) {
      event.preventDefault();
    }
  }

  onSplitManualPointsChange(values: readonly string[]): void {
    this.splitManualPointIds.set(values);
  }

  toggleSplitPreview(): void {
    this.splitPreviewExpanded.update((expanded) => !expanded);
  }

  onSplitExecute(): void {
    if (!this.splitCanExecute()) return;
    this.pickerErrorKey.set(null);
    this.workflowStep = 3;
  }

  async onSplitExport(): Promise<void> {
    if (
      !this.splitCanExecute() ||
      this.isPicking() ||
      this.isMergeActionBusy()
    ) {
      return;
    }

    const flowEpoch = this.currentFlowEpoch();
    this.isMergeActionBusy.set(true);
    this.operationProgress.set({ phase: 'preparing', percent: 0 });
    try {
      if (!this.adsRemoved) {
        const result = await this.ads.showRewarded();
        if (!result.rewardEarned || !result.adClosed) return;
      }

      await this.runSplit(flowEpoch);
    } catch (error) {
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      console.error('[epub-merger-and-splitter] split failed', error);
      this.markOperationFailure('split', error);
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isMergeActionBusy.set(false);
        this.operationProgress.set(null);
      }
    }
  }

  onSplitBackToHowTo(): void {
    this.resetSplitConfiguration();
    this.workflowStep = 1;
  }

  private resetSplitConfiguration(markRevision = true): void {
    this.splitChapterMode = 'chapter';
    this.splitEqualPartsValue = 2;
    this.splitEqualPartsSelectionValue = '2';
    this.splitMaximumSize = 10;
    this.splitMaximumSizeSelection = '10';
    this.resetSplitSelections();
    if (typeof this.splitEqualPartsErrorKey === 'function') {
      this.splitEqualPartsErrorKey.set(null);
    }
    if (typeof this.splitMaximumSizeErrorKey === 'function') {
      this.splitMaximumSizeErrorKey.set(null);
    }
    if (typeof this.splitPreviewExpanded === 'function') {
      this.splitPreviewExpanded.set(false);
    }
    if (markRevision) {
      this.markSplitConfigurationChanged();
    }
  }

  private resetSplitSelections(): void {
    if (typeof this.splitManualPointIds === 'function') {
      this.splitManualPointIds.set([]);
    }
  }

  private markSplitConfigurationChanged(): void {
    if (typeof this.splitConfigurationRevision === 'function') {
      this.splitConfigurationRevision.update((revision) => revision + 1);
    }
  }

  private refreshWorkflowStepLabels(): void {
    this.workflowSteps = [
      {
        id: 'merge-split',
        label: this.translate.instant('HOME.STEPPER.MERGE_SPLIT'),
      },
      { id: 'sort', label: this.translate.instant('HOME.STEPPER.SORT') },
      { id: 'toc', label: this.translate.instant('HOME.STEPPER.TOC') },
      { id: 'cover', label: this.translate.instant('HOME.STEPPER.COVER') },
      { id: 'adjust', label: this.translate.instant('HOME.STEPPER.ADJUST') },
      { id: 'join', label: this.translate.instant('HOME.STEPPER.JOIN') },
    ];
    this.splitWorkflowStep = {
      id: 'split-method',
      label: this.translate.instant('HOME.SPLIT_HOW_TO'),
    };
    this.splitConfirmStep = {
      id: 'split-confirm',
      label: this.translate.instant('HOME.STEPPER.CONFIRM'),
    };
    this.splitCoverStep = {
      id: 'split-cover',
      label: this.translate.instant('HOME.STEPPER.COVER'),
    };
    this.splitAdjustStep = {
      id: 'split-adjust',
      label: this.translate.instant('HOME.STEPPER.ADJUST'),
    };
    this.splitExecutionStep = {
      id: 'split-execution',
      label: this.translate.instant('HOME.SPLIT'),
    };
  }

  private canOpenMergeCoverEditor(): boolean {
    return (
      this.coverSourceMode() === 'scratch' ||
      !!this.mergeCoverWorkingFile ||
      !!this.mergeCoverPreviewUrl()
    );
  }

  private async openMergeCoverEditor(
    entryMode: EditorEntryMode,
    returnStep: number,
  ): Promise<void> {
    const sourceMode: EditorSourceMode =
      this.coverSourceMode() === 'scratch' ? 'scratch' : 'image';
    await this.openEditor(sourceMode, entryMode, returnStep);
  }

  private registerRecovery(): void {
    this.recovery.register<EmasRecoverySnapshot>({
      snapshot: () => ({
        selectedMode: this.selectedMode(),
        workflowStep: this.workflowStep,
        operationInProgress: this.isMergeActionBusy(),
        mergeSelections: this.mergeSelections().map(({ workingFile, coverFile, ...selection }) => selection),
        splitSelection: this.splitSelection()
          ? (({ workingFile, coverFile, ...selection }) => selection)(this.splitSelection()!)
          : null,
        selectedCoverCandidateId: this.selectedCoverCandidateId(),
        coverSourceMode: this.coverSourceMode(),
        splitMethod: this.splitMethod,
        tocMode: this.tocMode,
      }),
      assets: () => {
        const assets: Record<string, File | undefined> = {
          'merge-cover': this.mergeCoverRenderedFile,
        };
        this.mergeSelections().forEach((selection, index) => {
          assets[`merge-${index}`] = selection.workingFile ?? undefined;
          assets[`merge-cover-${index}`] = selection.coverFile;
        });
        const split = this.splitSelection();
        if (split) {
          assets['split'] = split.workingFile ?? undefined;
          assets['split-cover'] = split.coverFile;
        }
        return assets;
      },
      restore: async (snapshot, assets) => {
        const restoreEpoch = this.currentFlowEpoch();
        if (!this.isFlowEpochCurrent(restoreEpoch)) {
          return;
        }
        if (snapshot.operationInProgress) {
          await this.clearFlowState();
          if (
            this.currentFlowEpoch() === restoreEpoch + 1 &&
            !this.isResettingFlow()
          ) {
            this.pickerErrorKey.set('HOME.INPUT_ERROR_CORRUPT');
          }
          return;
        }

        const restoreSelection = (selection: EmasRecoverySelection, key: string): SelectedEpubInput => ({
          ...selection,
          workingFile: assets[key] ?? null,
          coverFile: assets[`${key}-cover`],
        });
        this.selectedMode.set(snapshot.selectedMode);
        this.workflowStep = snapshot.workflowStep;
        this.selectedCoverCandidateId.set(snapshot.selectedCoverCandidateId);
        this.coverSourceMode.set(snapshot.coverSourceMode);
        this.splitMethod = snapshot.splitMethod;
        this.tocMode = snapshot.tocMode;
        this.mergeSelections.set(snapshot.mergeSelections.map((selection, index) => restoreSelection(selection, `merge-${index}`)));
        this.splitSelection.set(snapshot.splitSelection ? restoreSelection(snapshot.splitSelection, 'split') : null);
        this.mergeCoverRenderedFile = assets['merge-cover'];

        if (!this.isFlowEpochCurrent(restoreEpoch)) {
          return;
        }

        if (this.workflowNavigationBlocked) {
          this.returnToFileSelectionStep();
        }

        const recoveredSplit = this.splitSelection();
        if (this.selectedMode() === 'split' && recoveredSplit) {
          this.splitAnalysisPending.set(true);
          this.splitAnalysis.set(null);
          try {
            const analysis = await this.analyzeSplitSelection(recoveredSplit);
            if (!this.isFlowEpochCurrent(restoreEpoch)) {
              return;
            }
            this.splitAnalysis.set(analysis);
            await this.refreshMergeCoverCandidates();
          } catch {
            if (!this.isFlowEpochCurrent(restoreEpoch)) {
              return;
            }
            this.pickerErrorKey.set('HOME.SPLIT_ANALYSIS_ERROR');
            this.returnToFileSelectionStep();
          } finally {
            if (this.isFlowEpochCurrent(restoreEpoch)) {
              this.splitAnalysisPending.set(false);
            }
          }
        }

        if (await this.hasMissingRecoveredWorkingCopies()) {
          if (!this.isFlowEpochCurrent(restoreEpoch)) {
            return;
          }
          const clearEpoch = this.currentFlowEpoch();
          await this.clearFlowState();
          if (
            this.currentFlowEpoch() === clearEpoch + 1 &&
            !this.isResettingFlow()
          ) {
            this.pickerErrorKey.set('HOME.INPUT_ERROR_CORRUPT');
          }
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.lifecycle.log('Ionic.HomePage.ngOnDestroy', {
      workflowStep: this.workflowStep,
    });
    this.routerSub?.unsubscribe();
    this.adsRemovedSub?.unsubscribe();
    this.languageSub?.unsubscribe();
    void this.operationProgressListener?.remove();
    void this.recovery.save();
  }

  async onMergeButtonClick(): Promise<void> {
    if (this.isMergeActionBusy() || this.isPicking()) return;

    const flowEpoch = this.currentFlowEpoch();
    this.isMergeActionBusy.set(true);
    this.operationProgress.set({ phase: 'preparing', percent: 0 });
    try {
      if (!this.adsRemoved) {
        const result = await this.ads.showRewarded();
        if (!result.rewardEarned || !result.adClosed) return;
      }

      await this.runMerge(flowEpoch);
    } catch (error) {
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      console.error('[epub-merger-and-splitter] merge failed', error);
      this.markOperationFailure('merge', error);
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isMergeActionBusy.set(false);
        this.operationProgress.set(null);
      }
    }
  }

  private async hydrateAdsState(): Promise<void> {
    this.adsRemoved = this.billing.isAdsRemoved();
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe((value) => {
      this.zone.run(() => {
        this.adsRemoved = value;
        this.changeDetector.markForCheck();
      });
    });
    await this.billing.hydrateCachedState();
    this.zone.run(() => {
      this.adsRemoved = this.billing.isAdsRemoved();
      this.changeDetector.markForCheck();
    });
  }

  private async attachOperationProgressListener(): Promise<void> {
    if (!this.epubRewrite.isSupported() || this.operationProgressListener) {
      return;
    }
    this.operationProgressListener = await this.epubRewrite.addProgressListener(
      (progress) => {
        const normalizedProgress = {
          ...progress,
          percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
        };
        if (progress.phase === 'diagnosing' && this.isPicking()) {
          this.diagnosisProgress.set(normalizedProgress);
          return;
        }
        if (!this.isMergeActionBusy()) return;
        this.operationProgress.set(normalizedProgress);
      },
    );
  }

  private async runMerge(flowEpoch = this.currentFlowEpoch()): Promise<void> {
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    const selections = this.mergeSelections();
    const cover = this.mergeCoverRenderedFile;
    if (selections.length < 2) {
      throw new Error('MERGE_UNAVAILABLE');
    }
    if (!this.epubRewrite.isSupported()) {
      await this.runWebDummyMerge(selections, flowEpoch);
      return;
    }

    await this.ensureNativeDeepDiagnosis(selections);
    if (!this.isFlowEpochCurrent(flowEpoch)) return;

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
    const output = await this.epubWorkingCopy.buildOutputFile(outputBaseName);
    let coverTemp: NativeTempFile | null = null;

    try {
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      coverTemp = cover
        ? await this.epubWorkingCopy.writeTempCoverFile(cover, outputBaseName)
        : null;
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      await this.epubRewrite.preflightMerge(inputs);
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      const merged = await this.epubRewrite.mergeEpubs({
        inputs,
        outputPath: output.nativePath,
        outputName: outputBaseName,
        tocMode: this.tocMode,
        removeSourceCover: !cover,
        ...(coverTemp ? { coverPath: coverTemp.nativePath } : {}),
      });
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      const saved = await this.epubLibrary.saveExportedEpub(
        merged.outputPath,
        merged.outputName,
      );
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      if (merged.warnings?.length) {
        this.completeOperation('merge', [saved], merged.warnings);
      } else {
        this.completeOperation('merge', [saved]);
      }
    } finally {
      await Promise.allSettled([
        this.epubWorkingCopy.cleanupWorkingCopy(output.path),
        this.epubWorkingCopy.cleanupWorkingCopy(coverTemp?.path),
      ]);
    }
  }

  private async runSplit(flowEpoch = this.currentFlowEpoch()): Promise<void> {
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    const selection = this.splitSelection();
    const analysis = this.splitAnalysis();
    const previews = this.splitOutputPreviews();
    if (!selection || previews.length < 2) {
      throw new Error('SPLIT_UNAVAILABLE');
    }
    if (!this.epubRewrite.isSupported()) {
      await this.runWebDummySplit(selection, previews, flowEpoch);
      return;
    }
    if (!selection.workingNativePath || !analysis) {
      throw new Error('SPLIT_UNAVAILABLE');
    }

    await this.ensureNativeDeepDiagnosis([selection]);
    if (!this.isFlowEpochCurrent(flowEpoch)) return;

    const operationId = this.createOperationId();
    const outputBaseName = selection.outputBaseName || 'split';
    let temporaryOutputs: NativeTempFile[] = [];
    const cover = this.mergeCoverRenderedFile;
    let coverTemp: NativeTempFile | null = null;

    try {
      temporaryOutputs = await Promise.all(
        previews.map((preview) =>
          this.epubWorkingCopy.buildOutputFile(
            outputBaseName + '_part_' + preview.number,
          ),
        ),
      );
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      coverTemp = cover
        ? await this.epubWorkingCopy.writeTempCoverFile(cover, outputBaseName)
        : null;
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      const outputs = previews.map((preview, index) => ({
        id: operationId + ':' + preview.number,
        outputPath: temporaryOutputs[index].nativePath,
        outputName:
          selection.outputBaseName +
          ' - ' +
          preview.number +
          '.epub',
        title: preview.title,
        spineItemIds: analysis.units
          .slice(preview.startUnit, preview.endUnit + 1)
          .map((unit) => unit.id),
        tocEntries: this.buildSplitTocEntries(analysis, preview),
      }));
      const created = await this.epubRewrite.splitEpubs({
        inputPath: selection.workingNativePath,
        outputs,
        removeSourceCover: !cover,
        coverPath: coverTemp?.nativePath,
      });
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      const saved = await this.epubLibrary.saveExportedEpubs(
        created.map((output, index) => ({
          sourceUri: output.outputPath,
          proposedFileName: output.outputName,
          title: output.title,
          operation: 'split',
          operationId,
          partIndex: index,
        })),
      );
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      this.completeOperation(
        'split',
        saved,
        Array.from(new Set(created.flatMap((output) => output.warnings ?? []))),
      );
    } finally {
      await Promise.allSettled([
        ...temporaryOutputs.map((output) =>
          this.epubWorkingCopy.cleanupWorkingCopy(output.path),
        ),
        this.epubWorkingCopy.cleanupWorkingCopy(coverTemp?.path),
      ]);
    }
  }

  private async runWebDummyMerge(
    selections: readonly SelectedEpubInput[],
    flowEpoch: number,
  ): Promise<void> {
    const cover = this.resolveWebDummyCover(selections);
    if (!cover) {
      throw new Error('WEB_DUMMY_COVER_REQUIRED');
    }
    const outputBaseName = `${selections[0]?.outputBaseName ?? 'merged'}_merged`;
    const bytes = await buildCoverOnlyEpubBytes({
      coverFile: cover,
      title: outputBaseName,
      lang: this.translate.currentLang,
      creator: WEB_DUMMY_EPUB_CREATOR,
    });
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    const saved = await this.epubLibrary.saveGeneratedEpubs([
      {
        bytes,
        coverFile: cover,
        proposedFileName: `${outputBaseName}.epub`,
        title: outputBaseName,
        operation: 'merge',
        operationId: this.createOperationId(),
        partIndex: 0,
      },
    ]);
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    this.completeOperation('merge', saved);
  }

  private async runWebDummySplit(
    selection: SelectedEpubInput,
    previews: readonly SplitOutputPreview[],
    flowEpoch: number,
  ): Promise<void> {
    const cover = this.resolveWebDummyCover([selection]);
    if (!cover) {
      throw new Error('WEB_DUMMY_COVER_REQUIRED');
    }
    const operationId = this.createOperationId();
    const outputBaseName = selection.outputBaseName || 'split';
    const requests = await Promise.all(
      previews.map(async (preview, index) => ({
        bytes: await buildCoverOnlyEpubBytes({
          coverFile: cover,
          title: preview.title || `${outputBaseName} - ${preview.number}`,
          lang: this.translate.currentLang,
          creator: WEB_DUMMY_EPUB_CREATOR,
        }),
        coverFile: cover,
        proposedFileName: `${outputBaseName} - ${preview.number}.epub`,
        title: preview.title,
        operation: 'split' as const,
        operationId,
        partIndex: index,
      })),
    );
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    const saved = await this.epubLibrary.saveGeneratedEpubs(requests);
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    this.completeOperation('split', saved);
  }

  private resolveWebDummyCover(
    selections: readonly SelectedEpubInput[],
  ): File | null {
    return (
      this.mergeCoverRenderedFile ??
      this.mergeCoverWorkingFile ??
      selections.find((selection) => selection.coverFile)?.coverFile ??
      null
    );
  }

  private completeOperation(
    operation: HomeMode,
    outputs: readonly EpubLibraryRecord[],
    warnings: readonly string[] = [],
  ): void {
    const previewUrl = outputs[0]?.thumbnailUri || this.mergeCoverPreviewUrl();
    this.operationFeedback.set({
      operation,
      status: 'success',
      outputs,
      warnings,
      previewUrl,
    });
    this.pickerErrorKey.set(null);
    this.workflowStep = this.resultWorkflowStep;
    outputs.forEach((output) => {
      this.coversEvents.emit({ type: 'saved', filename: output.filename });
    });
  }

  private markOperationFailure(operation: HomeMode, error: unknown): void {
    if (error instanceof EpubRewriteError && error.code === 'CANCELLED') {
      return;
    }
    const errorDetails = this.operationFailureDetails(error);
    this.operationFeedback.set({
      operation,
      status: 'error',
      outputs: [],
      warnings: [],
      errorKey:
        operation === 'merge'
          ? 'HOME.OPERATION.MERGE_FAILURE_BODY'
          : 'HOME.OPERATION.SPLIT_FAILURE_BODY',
      errorDetails,
    });
    this.workflowStep = this.resultWorkflowStep;
  }

  private operationFailureDetails(error: unknown): string | undefined {
    if (error instanceof EpubRewriteError) {
      const parts = [error.code];
      if (error.details?.stage) parts.push(`stage=${error.details.stage}`);
      if (error.details?.message) parts.push(error.details.message);
      return parts.join(' — ');
    }
    if (error instanceof Error && error.message.trim()) return error.message;
    return typeof error === 'string' && error.trim() ? error : undefined;
  }

  async onOperationFeedbackDone(): Promise<void> {
    if (this.isResettingFlow()) return;
    this.isResettingFlow.set(true);
    this.changeDetector?.detectChanges();
    try {
      await this.clearFlowState();
      await this.router.navigateByUrl('/tabs/my-epubs');
    } finally {
      this.isResettingFlow.set(false);
      this.changeDetector?.detectChanges();
    }
  }

  private createOperationId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'operation-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }

  async openMergePicker(): Promise<void> {
    if (this.isPicking()) {
      return;
    }

    this.selectedMode.set('merge');
    this.clearPickerError();

    if (this.epubRewrite.isSupported()) {
      await this.pickNativeEpubsForMerge();
      return;
    }

    this.mergeInput?.nativeElement.click();
  }

  async openSplitPicker(): Promise<void> {
    if (this.isPicking()) {
      return;
    }

    this.selectedMode.set('split');
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

    const flowEpoch = this.currentFlowEpoch();
    this.clearPickerError();
    this.diagnosisProgress.set(null);
    this.isPicking.set(true);

    try {
      const selections: SelectedEpubInput[] = [];
      for (const file of files) {
        selections.push(await this.prepareWebSelection(file, flowEpoch));
      }
      if (!this.isFlowEpochCurrent(flowEpoch)) {
        await Promise.all(
          selections.map((selection) => this.cleanupSelection(selection)),
        );
        return;
      }
      this.mergeSelections.update((current) => [...current, ...selections]);
      this.selectedMode.set('merge');
      this.updateWorkflowAfterEpubSelection(1);
      await this.refreshMergeCoverCandidates();
    } catch (error) {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.handlePickerError(error);
      }
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isPicking.set(false);
      }
    }
  }

  async onSplitFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.resetFileInput(input);

    if (!file || this.isPicking()) {
      return;
    }

    const flowEpoch = this.currentFlowEpoch();
    this.clearPickerError();
    this.diagnosisProgress.set(null);
    this.isPicking.set(true);

    try {
      const selection = await this.prepareWebSelection(file, flowEpoch);
      await this.replaceSplitSelection(selection, flowEpoch);
    } catch (error) {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.handlePickerError(error);
      }
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isPicking.set(false);
      }
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
      this.workflowStep = 0;
      this.clearPickerError();
      this.resetFileInput(this.mergeInput?.nativeElement);
      this.resetCoverSelection(true);
    } else {
      await this.refreshMergeCoverCandidates();
      this.updateWorkflowAfterEpubSelection(1);
    }

    await this.cleanupSelection(selection);
  }

  async onBestCandidateSelected(candidate: BestCandidateImage): Promise<void> {
    if (this.isDetectingCoverCandidates() || this.isPicking()) {
      return;
    }

    const flowEpoch = this.currentFlowEpoch();
    this.diagnosisProgress.set(null);
    this.isPicking.set(true);
    try {
      const loaded = await this.applyCandidateCover(candidate, flowEpoch);
      if (!loaded) {
        this.bestCandidateDismissed.set(false);
        return;
      }
      if (!this.isFlowEpochCurrent(flowEpoch)) return;

      this.selectedCoverCandidateId.set(candidate.id);
      this.coverSourceMode.set('candidate');
      await this.openEditor('image', 'new-cover', 3, flowEpoch);
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isPicking.set(false);
      }
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
    void this.router.navigateByUrl('/tabs/preview-editing');
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
    void this.router.navigateByUrl('/tabs/preview-editing');
  }

  closePreview(): void {
    this.previewEditingPage.clear();
  }

  async onCoverScratchSelected(): Promise<void> {
    if (this.isPicking()) {
      return;
    }

    const flowEpoch = this.currentFlowEpoch();
    this.bestCandidateDismissed.set(true);
    this.coverSourceMode.set('scratch');
    this.selectedCoverCandidateId.set(undefined);
    if (this.isFlowEpochCurrent(flowEpoch)) {
      await this.openEditor('scratch', 'new-cover', 3, flowEpoch);
    }
  }

  onCoverNoneSelected(): void {
    if (this.isPicking() || this.isMergeActionBusy()) {
      return;
    }

    this.bestCandidateDismissed.set(true);
    this.coverSourceMode.set('none');
    this.selectedCoverCandidateId.set(undefined);
    this.resetMergeCoverSelection(true);
    this.workflowStep = this.resultWorkflowStep;
  }

  async onCoverImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.resetFileInput(input);

    if (!file || this.isPicking()) {
      return;
    }

    const flowEpoch = this.currentFlowEpoch();
    this.diagnosisProgress.set(null);
    this.isPicking.set(true);
    try {
      const loaded = await this.applyMergeCoverSource(file, flowEpoch);
      if (!loaded) {
        return;
      }
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      this.coverSourceMode.set('image');
      this.bestCandidateDismissed.set(true);
      this.selectedCoverCandidateId.set(undefined);
      await this.openEditor('image', 'new-cover', 3, flowEpoch);
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isPicking.set(false);
      }
    }
  }

  private async refreshMergeCoverCandidates(
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<void> {
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    this.isDetectingCoverCandidates.set(true);
    this.resetCandidateBlobUrls();
    const previousCoverMode = this.coverSourceMode();
    const previousCandidateId = this.selectedCoverCandidateId();

    try {
      const selections =
        this.selectedMode() === 'split'
          ? (this.splitSelection() ? [this.splitSelection()!] : [])
          : this.mergeSelections();
      const sources = selections
        .map((selection, index) => ({
          epubId: selection.id,
          epubName: selection.selectedName,
          epubFile: selection.workingFile,
          coverFile: selection.coverFile,
          coverEntryPath: selection.coverEntryPath,
          order: index + 1,
        }))
        .filter((source) => !!source.epubFile || !!source.coverFile);
      const images = await this.mergeCoverCandidate.collectCandidates(sources);
      if (!this.isFlowEpochCurrent(flowEpoch)) return;

      for (const image of images) {
        if (image.src.startsWith('blob:')) {
          this.candidateBlobUrls.add(image.src);
        }
      }

      const ranked = this.bestCandidate.rankCandidates(images, {
        maxCandidates: 3,
      });
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      this.coverCandidates.set(ranked);

      if (
        previousCoverMode === 'image' ||
        previousCoverMode === 'scratch' ||
        previousCoverMode === 'none'
      ) {
        this.selectedCoverCandidateId.set(undefined);
        return;
      }

      const selectedCandidate =
        ranked.find((candidate) => candidate.image.id === previousCandidateId)
          ?.image ?? ranked[0]?.image;

      this.selectedCoverCandidateId.set(selectedCandidate?.id);
      this.coverSourceMode.set(selectedCandidate ? 'candidate' : null);
      if (selectedCandidate) {
        await this.applyCandidateCover(selectedCandidate, flowEpoch);
        if (!this.isFlowEpochCurrent(flowEpoch)) return;
      } else {
        this.resetMergeCoverSelection(true);
      }
    } catch (error) {
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      console.warn(
        '[epub-merger-and-splitter] failed to detect merge cover candidates',
        error,
      );
      this.coverCandidates.set([]);
      this.selectedCoverCandidateId.set(undefined);
      if (
        previousCoverMode !== 'image' &&
        previousCoverMode !== 'scratch' &&
        previousCoverMode !== 'none'
      ) {
        this.coverSourceMode.set(null);
        this.resetMergeCoverSelection(true);
      }
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isDetectingCoverCandidates.set(false);
      }
    }
  }

  private resetCoverSelection(revokeUrls: boolean): void {
    this.editorEntryMode = 'new-cover';
    this.editorReturnStep = this.coverWorkflowStep;
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
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<boolean> {
    if (!this.isFlowEpochCurrent(flowEpoch)) return false;
    const file = this.candidateFileFromMetadata(candidate);
    if (!file) {
      return false;
    }

    return this.applyMergeCoverSource(file, flowEpoch);
  }

  private async applyMergeCoverSource(
    file: File,
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<boolean> {
    if (!this.isFlowEpochCurrent(flowEpoch)) return false;
    this.mergeCoverCropState = undefined;
    this.mergeCoverMasterBlob = undefined;
    this.mergeCoverRenderedFile = undefined;

    const source = await this.prepareEditorImageSource(file, flowEpoch);
    if (!source || !this.isFlowEpochCurrent(flowEpoch)) {
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
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<{ source: File; workingFile: File } | null> {
    if (
      !this.isFlowEpochCurrent(flowEpoch) ||
      this.imagePipeline.validateBasic(file)
    ) {
      return null;
    }

    let source = await this.imagePipeline.materializeFile(file);
    if (!this.isFlowEpochCurrent(flowEpoch)) return null;
    let sourceDims = await this.imagePipeline.getDimensions(source);
    if (!this.isFlowEpochCurrent(flowEpoch)) return null;
    if (!sourceDims) {
      const normalized = await this.imagePipeline.normalizeFile(source);
      if (!this.isFlowEpochCurrent(flowEpoch)) return null;
      if (normalized) {
        source = normalized;
        sourceDims = await this.imagePipeline.getDimensions(source);
        if (!this.isFlowEpochCurrent(flowEpoch)) return null;
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

  private async openEditor(
    sourceMode: EditorSourceMode,
    entryMode: EditorEntryMode,
    returnStep: number,
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<void> {
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
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
        output: selected.target.output,
        unit:
          selected.target.unit ??
          (selected.target.output === 'source' ? 'ratio' : 'px'),
        outputMode:
          selected.target.outputMode ??
          (selected.target.output === 'source' ? 'aspect-only' : 'fixed-size'),
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
        exportQuality: toEditorRenderQuality(this.getEffectiveExportQualityMode()),
      },
      onResultApplied: async (result) => {
        const appliedSessionId = this.lastEditorSessionId;
        await this.applyEditorResult(result, flowEpoch);
        if (!this.isFlowEpochCurrent(flowEpoch)) return;
        if (appliedSessionId) this.editorSession.consumeResult(appliedSessionId);
        if (this.lastEditorSessionId === appliedSessionId) {
          this.lastEditorSessionId = undefined;
        }
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

    if (!this.isFlowEpochCurrent(flowEpoch)) {
      this.editorSession.consumeSession(sid);
      return;
    }

    this.lastEditorSourceMode = sourceMode;
    this.editorEntryMode = entryMode;
    this.editorReturnStep = returnStep;
    this.lastEditorSessionId = sid;
    this.workflowStep = this.editorWorkflowStep;
    const entryPath = sourceMode === 'scratch' ? '/editor/tools' : '/editor';
    await this.router.navigate([entryPath], { queryParams: { sid } });
  }

  private async consumeEditorResult(sessionId?: string): Promise<void> {
    const flowEpoch = this.currentFlowEpoch();
    const { session, result } = consumeEditorResultSnapshot(
      this.editorSession,
      sessionId ?? this.lastEditorSessionId,
    );

    if (result && this.isFlowEpochCurrent(flowEpoch)) {
      this.lastEditorSessionId = undefined;
    }

    if (result?.file && session) {
      await this.applyEditorResult(result, flowEpoch);
      return;
    }

    if (session && !result && this.isFlowEpochCurrent(flowEpoch)) {
      const entryMode = this.editorEntryMode;
      this.editorEntryMode = 'new-cover';
      if (entryMode === 'new-cover') {
        this.resetMergeCoverSelection(true);
        this.coverSourceMode.set(null);
        this.selectedCoverCandidateId.set(undefined);
        this.bestCandidateDismissed.set(false);
      }
      this.workflowStep = this.editorReturnStep;
      this.editorReturnStep = this.coverWorkflowStep;
    }
  }

  private async applyEditorResult(
    result: CropperResult,
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<void> {
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    this.mergeCoverWorkingFile = result.file;
    this.mergeCoverMasterBlob = result.editorMasterBlob;
    this.mergeCoverCropState = result.state;
    this.mergeCoverFormatId = this.resolveFormatId(result.formatId);
    this.coverSourceMode.set(this.lastEditorSourceMode);
    this.bestCandidateDismissed.set(true);
    this.selectedCoverCandidateId.set(undefined);
    this.editorEntryMode = 'new-cover';
    this.editorReturnStep = this.coverWorkflowStep;
    this.workflowStep = this.resultWorkflowStep;

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
      if (this.isFlowEpochCurrent(flowEpoch)) {
        await this.applySelectedExportQuality(flowEpoch);
      }
      return;
    }

    this.setMergeCoverPreviewUrl(URL.createObjectURL(result.file));
    this.mergeCoverPreviewThumbUrl = this.mergeCoverPreviewUrl();
    if (this.isFlowEpochCurrent(flowEpoch)) {
      await this.applySelectedExportQuality(flowEpoch);
    }
  }

  getEffectiveExportQualityMode(): ExportQualityMode {
    return normalizeExportQualityMode(this.exportQualityMode, this.adsRemoved);
  }

  async onExportQualityModeSelect(mode: ExportQualityMode): Promise<void> {
    const normalized = normalizeExportQualityMode(mode, this.adsRemoved);
    if (normalized !== mode) {
      return;
    }

    const flowEpoch = this.currentFlowEpoch();
    this.exportQualityMode = normalized;
    this.isRebuildingExportQuality.set(true);
    try {
      await this.settings.setForScope('exportQuality', {
        exportQualityMode: normalized,
      });
      if (this.isFlowEpochCurrent(flowEpoch)) {
        await this.applySelectedExportQuality(flowEpoch);
      }
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isRebuildingExportQuality.set(false);
      }
    }
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
      this.adsRemoved,
    );
  }

  private async applySelectedExportQuality(
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<void> {
    if (!this.isFlowEpochCurrent(flowEpoch)) return;
    const source = this.mergeCoverWorkingFile;
    const state = this.mergeCoverCropState;
    if (!source || !state) {
      return;
    }

    const revision = ++this.mergeCoverQualityRevision;
    const exportOptions = getCoverExportOptions(this.exportQualityMode);
    const master = this.mergeCoverMasterBlob;
    let rendered: File | null;
    if (master) {
      rendered = await encodeRenderedBlob(
        master,
        source.name,
        toEditorRenderQuality(this.exportQualityMode),
        exportOptions.mimeType === 'image/png' ? undefined : '#ffffff',
      );
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
    } else {
      const dimensions = await this.imagePipeline.getDimensions(source);
      if (!dimensions) return;

      const input = buildCompositionInput({
        file: source,
        target: this.getSelectedFormatOption().target,
        state,
        naturalWidth: dimensions.width,
        naturalHeight: dimensions.height,
      });
      if (!input) return;

      rendered = await renderCompositionToFile(input, {
        mode: 'export',
        outputScale: 1,
        mimeType: exportOptions.mimeType,
        quality: exportOptions.quality,
        maxDimension: exportOptions.maxDimension,
        backgroundFallbackColor:
          exportOptions.mimeType === 'image/png' ? undefined : '#ffffff',
      });
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
    }
    if (
      !rendered ||
      revision !== this.mergeCoverQualityRevision ||
      !this.isFlowEpochCurrent(flowEpoch)
    ) {
      return;
    }

    this.mergeCoverRenderedFile = rendered;
    const url = URL.createObjectURL(rendered);
    this.setMergeCoverPreviewUrl(url);
    this.mergeCoverPreviewThumbUrl =
      (await this.buildThumbFromBlob(rendered)) ?? url;
    if (this.isFlowEpochCurrent(flowEpoch)) {
      this.markSplitConfigurationChanged();
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
    this.mergeCoverMasterBlob = undefined;
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
    this.markSplitConfigurationChanged();
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
    const fixedTarget = (
      formatId: string,
      width: number,
      height: number,
    ): CropTarget => ({
      formatId,
      width,
      height,
      output: 'target',
      unit: 'px',
      outputMode: 'fixed-size',
    });
    const aspectTarget = (
      formatId: string,
      width: number,
      height: number,
      unit: 'mm' | 'in' | 'ratio',
    ): CropTarget => ({
      formatId,
      width,
      height,
      output: 'source',
      unit,
      outputMode: 'aspect-only',
    });

    return [
      { id: 'epub', label: 'Kindle', target: fixedTarget('epub', 1236, 1648) },
      {
        id: 'kobo',
        label: 'Kobo',
        target: fixedTarget('kobo', 1072, 1448),
      },
      {
        id: 'ridi-1600x2560',
        label: '1600 × 2560 px',
        target: fixedTarget('ridi-1600x2560', 1600, 2560),
      },
      {
        id: 'ridi-1200x1800',
        label: '1200 × 1800 px',
        target: fixedTarget('ridi-1200x1800', 1200, 1800),
      },
      {
        id: 'a3',
        label: 'A3',
        target: aspectTarget('a3', 297, 420, 'mm'),
      },
      {
        id: 'a4',
        label: 'A4',
        target: aspectTarget('a4', 210, 297, 'mm'),
      },
      {
        id: 'a5',
        label: 'A5',
        target: aspectTarget('a5', 148, 210, 'mm'),
      },
      {
        id: 'a6',
        label: 'A6',
        target: aspectTarget('a6', 105, 148, 'mm'),
      },
      {
        id: 'letter',
        label: 'Letter',
        target: aspectTarget('letter', 8.5, 11, 'in'),
      },
      {
        id: 'legal',
        label: 'Legal',
        target: aspectTarget('legal', 8.5, 14, 'in'),
      },
      {
        id: 'tabloid',
        label: 'Tabloid',
        target: aspectTarget('tabloid', 11, 17, 'in'),
      },
      {
        id: 'one_one',
        label: '1:1',
        target: aspectTarget('one_one', 1, 1, 'ratio'),
      },
      {
        id: 'two_three',
        label: '2:3',
        target: aspectTarget('two_three', 2, 3, 'ratio'),
      },
      {
        id: 'three_four',
        label: '3:4',
        target: aspectTarget('three_four', 3, 4, 'ratio'),
      },
      {
        id: 'four_five',
        label: '4:5',
        target: aspectTarget('four_five', 4, 5, 'ratio'),
      },
      {
        id: 'five_seven',
        label: '5:7',
        target: aspectTarget('five_seven', 5, 7, 'ratio'),
      },
      {
        id: 'five_eight',
        label: '5:8',
        target: aspectTarget('five_eight', 5, 8, 'ratio'),
      },
      {
        id: 'nine_sixteen',
        label: '9:16',
        target: aspectTarget('nine_sixteen', 9, 16, 'ratio'),
      },
      {
        id: 'sixteen_nine',
        label: '16:9',
        target: aspectTarget('sixteen_nine', 16, 9, 'ratio'),
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
    const flowEpoch = this.currentFlowEpoch();
    this.diagnosisProgress.set(null);
    this.isPicking.set(true);

    try {
      const selection = await this.prepareNativeSelection(flowEpoch);
      if (!this.isFlowEpochCurrent(flowEpoch)) {
        await this.cleanupSelection(selection);
        return;
      }
      await this.replaceSplitSelection(selection, flowEpoch);
    } catch (error) {
      if (this.isCancelledPick(error)) {
        return;
      }
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.handlePickerError(error);
      }
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isPicking.set(false);
      }
    }
  }

  private async pickNativeEpubsForMerge(): Promise<void> {
    const flowEpoch = this.currentFlowEpoch();
    this.diagnosisProgress.set(null);
    this.isPicking.set(true);

    try {
      const selections = await this.prepareNativeSelections(flowEpoch);
      if (!this.isFlowEpochCurrent(flowEpoch)) {
        await Promise.all(
          selections.map((selection) => this.cleanupSelection(selection)),
        );
        return;
      }
      this.mergeSelections.update((current) => [...current, ...selections]);
      this.selectedMode.set('merge');
      this.updateWorkflowAfterEpubSelection(1);
      await this.refreshMergeCoverCandidates();
    } catch (error) {
      if (this.isCancelledPick(error)) {
        return;
      }
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.handlePickerError(error);
      }
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.isPicking.set(false);
      }
    }
  }

  private async replaceSplitSelection(
    selection: SelectedEpubInput,
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<void> {
    if (!this.isFlowEpochCurrent(flowEpoch)) {
      await this.cleanupSelection(selection);
      return;
    }
    const previous = this.splitSelection();
    this.resetCoverSelection(true);
    this.splitSelection.set(selection);
    this.selectedMode.set('split');
    this.workflowStep = 0;
    this.splitAnalysisPending.set(true);
    this.splitAnalysis.set(null);
    this.resetSplitConfiguration();
    try {
      const analysis = await this.analyzeSplitSelection(selection);
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      this.splitAnalysis.set(analysis);
      await this.refreshMergeCoverCandidates();
      if (!this.isFlowEpochCurrent(flowEpoch)) return;
      this.updateWorkflowAfterEpubSelection(1);
    } catch (error) {
      if (!this.isFlowEpochCurrent(flowEpoch)) {
        return;
      }
      console.error('[epub-merger-and-splitter] split analysis failed', error);
      this.pickerErrorKey.set('HOME.SPLIT_ANALYSIS_ERROR');
      this.returnToFileSelectionStep();
    } finally {
      if (this.isFlowEpochCurrent(flowEpoch)) {
        this.splitAnalysisPending.set(false);
      }
    }
    await this.cleanupSelection(previous);
  }

  private analyzeSplitSelection(
    selection: SelectedEpubInput,
  ): Promise<SplitAnalysis> {
    return this.splitAnalysisService.analyze({
      fileName: selection.selectedName,
      fileSizeBytes: selection.sourceSize,
      workingFile: selection.workingFile,
      workingPath: selection.workingPath,
      workingNativePath: selection.workingNativePath,
    });
  }

  private buildSplitOutputPreviews(): readonly SplitOutputPreview[] {
    const units = this.splitAnalysis()?.units ?? [];
    if (units.length === 0) return [];

    let outputs: readonly SplitOutputPreview[];
    if (this.splitMethod === 'by-chapters-or-sections') {
      if (this.splitChapterMode === 'chapter') {
        outputs = units.map((_, index) => this.buildOutput(units, index, index));
      } else if (this.splitChapterMode === 'section' && this.splitHasSections) {
        const sections = this.splitAnalysis()!.sections;
        const leadingOutput =
          sections[0].firstUnitOrder > 0
            ? [
                this.buildOutput(
                  units,
                  0,
                  sections[0].firstUnitOrder - 1,
                ),
              ]
            : [];
        outputs = [
          ...leadingOutput,
          ...sections.map((section) =>
            this.buildOutput(
              units,
              section.firstUnitOrder,
              section.lastUnitOrder,
              section.title,
            ),
          ),
        ];
      } else {
        outputs = units.map((_, index) => this.buildOutput(units, index, index));
      }
    } else if (this.splitMethod === 'manual-split-points') {
      outputs = this.buildOutputsFromBreakpoints(units, this.splitManualPointIds());
    } else if (this.splitMethod === 'equal-parts') {
      outputs = this.buildEqualOutputs(units, this.splitEqualPartsValue);
    } else {
      outputs = this.buildMaximumSizeOutputs(units, this.splitMaximumSize);
    }
    return outputs.map((output, index) => ({ ...output, number: index + 1 }));
  }

  private buildOutputsFromBreakpoints(
    units: readonly SplitAnalysis['units'][number][],
    breakpointIds: readonly string[],
  ): readonly SplitOutputPreview[] {
    const points = breakpointIds
      .map((id) => units.findIndex((unit) => unit.id === id))
      .filter((index) => index > 0)
      .sort((left, right) => left - right);
    const starts = [0, ...points];
    return starts.map((start, index) =>
      this.buildOutput(units, start, (starts[index + 1] ?? units.length) - 1),
    );
  }

  private buildEqualOutputs(
    units: readonly SplitAnalysis['units'][number][],
    count: number,
  ): readonly SplitOutputPreview[] {
    const safeCount = Math.max(2, Math.min(count, units.length));
    return Array.from({ length: safeCount }, (_, index) => {
      const start = Math.floor((index * units.length) / safeCount);
      const end = Math.floor(((index + 1) * units.length) / safeCount) - 1;
      return this.buildOutput(units, start, end);
    });
  }

  private buildMaximumSizeOutputs(
    units: readonly SplitAnalysis['units'][number][],
    maximumMegabytes: number,
  ): readonly SplitOutputPreview[] {
    const maximumBytes = Math.max(1, maximumMegabytes) * 1024 * 1024;
    const coverSizeBytes = this.mergeCoverRenderedFile?.size ?? 0;
    const maximumBookBytes = Math.max(1, maximumBytes - coverSizeBytes);
    const outputs: SplitOutputPreview[] = [];
    let start = 0;
    let size = 0;
    for (let index = 0; index < units.length; index += 1) {
      const unitSize = units[index].sizeBytes;
      if (index > start && size + unitSize > maximumBookBytes) {
        outputs.push(this.buildOutput(units, start, index - 1));
        start = index;
        size = 0;
      }
      size += unitSize;
    }
    outputs.push(this.buildOutput(units, start, units.length - 1));
    return outputs;
  }

  private buildOutput(
    units: readonly SplitAnalysis['units'][number][],
    startUnit: number,
    endUnit: number,
    title?: string,
  ): SplitOutputPreview {
    const first = units[startUnit];
    const last = units[endUnit];
    const bookSizeBytes = units
      .slice(startUnit, endUnit + 1)
      .reduce((total, unit) => total + unit.sizeBytes, 0);
    const coverSizeBytes = this.mergeCoverRenderedFile?.size ?? 0;
    return {
      number: 0,
      title: title ?? this.rangeTitle(first.title, last.title, startUnit, endUnit),
      startUnit,
      endUnit,
      bookSizeBytes,
      coverSizeBytes,
      sizeBytes: bookSizeBytes + coverSizeBytes,
    };
  }

  private buildSplitTocEntries(
    analysis: SplitAnalysis,
    preview: SplitOutputPreview,
  ): readonly EpubSplitTocEntry[] {
    const selectedSpineItemIds = new Set(
      analysis.units
        .slice(preview.startUnit, preview.endUnit + 1)
        .map((unit) => unit.id),
    );

    const filterEntries = (
      entries: readonly SplitAnalysisTocEntry[],
    ): EpubSplitTocEntry[] =>
      entries.flatMap((entry) => {
        const children = filterEntries(entry.children);
        const spineItemId = entry.spineItemId;
        const belongsToOutput =
          spineItemId !== null && selectedSpineItemIds.has(spineItemId);
        if (belongsToOutput) {
          return [
            {
              spineItemId,
              title: entry.title,
              href: entry.href,
              children,
            },
          ];
        }
        return children;
      });

    return filterEntries(analysis.tocEntries);
  }

  private rangeTitle(first: string, last: string, start: number, end: number): string {
    return start === end ? first : `${first} – ${last}`;
  }

  formatMegabytes(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private async ensureNativeDeepDiagnosis(
    selections: readonly SelectedEpubInput[],
  ): Promise<void> {
    for (const selection of selections) {
      if (!selection.sessionId) {
        continue;
      }
      if (
        selection.diagnosisMode === 'deep' &&
        selection.diagnosisCoverage === 'complete'
      ) {
        continue;
      }
      const diagnosis = await this.epubRewrite.diagnose(
        selection.sessionId,
        'deep',
      );
      if (
        diagnosis.status === 'unsupported' ||
        diagnosis.status === 'failed' ||
        diagnosis.status === 'limited'
      ) {
        throw new EpubRewriteError('EPUB_DIAGNOSE_FAILED');
      }
    }
  }

  private async prepareNativeSelection(
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<SelectedEpubInput> {
    const prepared = await this.epubRewrite.pickAndPrepareEpub({
      maxBytes: MAX_EPUB_SIZE_MB * 1024 * 1024,
      requireCover: false,
      includeCoverPreview: true,
    });

    const diagnosis = await this.validateNativeEpubForReading(
      prepared.sessionId,
      prepared.selectedName,
      'deep',
      flowEpoch,
    );
    return this.toNativeSelection(prepared, diagnosis);
  }

  private async prepareNativeSelections(
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<SelectedEpubInput[]> {
    const prepared = await this.epubRewrite.pickAndPrepareEpubs({
      maxBytes: MAX_EPUB_SIZE_MB * 1024 * 1024,
      requireCover: false,
      includeCoverPreview: true,
    });

    try {
      const selections: SelectedEpubInput[] = [];
      for (const item of prepared) {
        const diagnosis = await this.validateNativeEpubForReading(
          item.sessionId,
          item.selectedName,
          'deep',
          flowEpoch,
        );
        selections.push(this.toNativeSelection(item, diagnosis));
      }
      return selections;
    } catch (error) {
      for (const item of prepared) {
        await this.epubRewrite.cleanup(item.sessionId).catch(() => undefined);
      }
      throw error;
    }
  }

  private toNativeSelection(prepared: {
    sessionId: string;
    selectedName: string;
    sourceSize: number;
    sourceLastModified: number;
    sourceMimeType: string;
    workingPath: string;
    workingName: string;
    workingNativePath: string;
    outputBaseName: string;
    file?: File;
    coverEntryPath?: string;
  },
    diagnosis: {
      status: 'valid' | 'repairable';
      issues: EpubDiagnosticIssue[];
      mode: 'quick' | 'deep';
      coverage: 'complete' | 'limited';
    },
  ): SelectedEpubInput {
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
      coverFile: prepared.file,
      coverEntryPath: prepared.coverEntryPath,
      workingNativePath: prepared.workingNativePath,
      outputBaseName: prepared.outputBaseName,
      sourceKind: 'native',
      diagnosisStatus: diagnosis.status,
      diagnosisIssues: diagnosis.issues,
      diagnosisMode: diagnosis.mode,
      diagnosisCoverage: diagnosis.coverage,
    };
  }

  private async prepareWebSelection(
    file: File,
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<SelectedEpubInput> {
    const validation = this.fileKit.validateEpub(file, MAX_EPUB_SIZE_MB);
    if (!validation.valid) {
      throw new Error(validation.errorKey ?? 'EPUB_ERROR_CORRUPT');
    }

    const cycle = this.epubRewrite.isSupported()
      ? await this.epubWorkingCopy.startStreamingCycle(file)
      : await this.epubWorkingCopy.startCycle(file);

    let diagnosis: {
      status: 'valid' | 'repairable';
      issues: EpubDiagnosticIssue[];
    };
    try {
      diagnosis = await this.validateWebEpubForReading(file, flowEpoch);
    } catch (error) {
      await this.epubWorkingCopy.cleanupWorkingCopy(cycle.workingPath);
      throw error;
    }

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
      diagnosisStatus: diagnosis.status,
      diagnosisIssues: diagnosis.issues,
      diagnosisMode: 'deep',
      diagnosisCoverage: 'complete',
    };
  }

  private async validateNativeEpubForReading(
    sessionId: string,
    displayName?: string,
    mode: 'quick' | 'deep' = 'deep',
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<{
    status: 'valid' | 'repairable';
    issues: EpubDiagnosticIssue[];
    mode: 'quick' | 'deep';
    coverage: 'complete' | 'limited';
  }> {
    try {
      const diagnosis = await this.epubRewrite.diagnose(sessionId, mode);
      if (!this.isFlowEpochCurrent(flowEpoch)) {
        throw new EpubRewriteError('CANCELLED');
      }
      if (
        diagnosis.status === 'unsupported' ||
        diagnosis.status === 'failed' ||
        diagnosis.status === 'limited'
      ) {
        this.setPickerDiagnosisFailure(diagnosis.issues, displayName);
        throw new EpubRewriteError('EPUB_UNSUPPORTED');
      }
      return {
        status: diagnosis.status,
        issues: diagnosis.issues,
        mode: diagnosis.mode ?? mode,
        coverage: diagnosis.coverage ?? (mode === 'deep' ? 'complete' : 'limited'),
      };
    } catch (error) {
      await this.epubRewrite.cleanup(sessionId).catch(() => undefined);
      throw error;
    }
  }

  private async validateWebEpubForReading(
    file: File,
    flowEpoch = this.currentFlowEpoch(),
  ): Promise<{
    status: 'valid' | 'repairable';
    issues: EpubDiagnosticIssue[];
  }> {
    const prepared = await this.webEpubFixer.prepare({
      file,
      displayName: file.name,
      maxBytes: MAX_EPUB_SIZE_MB * 1024 * 1024,
    });
    try {
      const diagnosis = await this.webEpubFixer.diagnose({
        sessionId: prepared.sessionId,
      });
      if (!this.isFlowEpochCurrent(flowEpoch)) {
        throw new EpubRewriteError('CANCELLED');
      }
      if (
        diagnosis.status === 'unsupported' ||
        diagnosis.status === 'failed' ||
        diagnosis.status === 'limited'
      ) {
        this.setPickerDiagnosisFailure(diagnosis.issues, file.name);
        throw new EpubRewriteError('EPUB_UNSUPPORTED');
      }
      return { status: diagnosis.status, issues: diagnosis.issues };
    } finally {
      await this.webEpubFixer.cleanup({ sessionId: prepared.sessionId });
    }
  }

  issueMessageLabel(issue: EpubDiagnosticIssueView): string {
    const normalizedKey = issue.messageKey.startsWith('FIX.ISSUE_')
      ? `FIX.ISSUE_${issue.code.replace(/-/g, '_')}`
      : issue.messageKey;
    const normalizedLabel = this.translate.instant(normalizedKey);
    return normalizedLabel !== normalizedKey
      ? normalizedLabel
      : this.translate.instant(issue.messageKey);
  }

  issueDetailsLabel(issue: EpubDiagnosticIssueView): string {
    const details = issue.details?.trim();
    if (!details) return '';

    switch (details) {
      case 'container.xml is missing':
        return this.translate.instant('FIX.ISSUE_DETAIL_CONTAINER_MISSING');
      case 'container.xml is not parseable':
        return this.translate.instant(
          'FIX.ISSUE_DETAIL_CONTAINER_NOT_PARSEABLE',
        );
      case 'container.xml does not declare a rootfile':
        return this.translate.instant('FIX.ISSUE_DETAIL_CONTAINER_NO_ROOTFILE');
      case 'Multiple package documents were found':
        return this.translate.instant('FIX.ISSUE_DETAIL_OPF_AMBIGUOUS');
      case 'No valid spine entries remain':
        return this.translate.instant('FIX.ISSUE_DETAIL_SPINE_EMPTY');
      case 'missing idref':
        return this.translate.instant('FIX.ISSUE_DETAIL_MISSING_IDREF');
    }

    const notParseableMatch = details.match(/^(.*) is not parseable$/);
    return notParseableMatch
      ? this.translate.instant('FIX.ISSUE_DETAIL_FILE_NOT_PARSEABLE', {
          path: notParseableMatch[1],
        })
      : details;
  }

  private hasEpubDiagnosticErrors(
    selection: Pick<SelectedEpubInput, 'diagnosisStatus' | 'diagnosisIssues'>,
  ): boolean {
    return (
      selection.diagnosisStatus === 'repairable' ||
      (selection.diagnosisIssues?.length ?? 0) > 0
    );
  }

  private hasWorkflowErrorState(): boolean {
    return !!this.pickerErrorKey?.();
  }

  private updateWorkflowAfterEpubSelection(nextStep: number): void {
    if (this.epubRepairRequired?.()) {
      this.workflowStep = this.fileSelectionWorkflowStep;
      return;
    }

    this.workflowStep = nextStep;
  }

  private currentFlowEpoch(): number {
    return this.flowEpoch ?? 0;
  }

  private isFlowEpochCurrent(flowEpoch: number): boolean {
    return (
      flowEpoch === this.currentFlowEpoch() &&
      !(this.isResettingFlow?.() ?? false)
    );
  }

  private invalidateFlowEpoch(): void {
    this.flowEpoch = this.currentFlowEpoch() + 1;
  }

  private async cancelNativeRewrite(): Promise<void> {
    if (!this.epubRewrite?.isSupported?.()) {
      return;
    }

    await Promise.resolve(this.epubRewrite.cancelRewrite?.()).catch(
      () => undefined,
    );
  }

  private returnToFileSelectionStep(): void {
    if (this.selectedMode() === 'merge') {
      this.workflowStep = MERGE_FILE_SELECTION_STEP;
    } else if (this.selectedMode() === 'split') {
      this.workflowStep = 0;
    }
  }

  private scrollWorkflowToTop(): void {
    const content = this.homeContent;
    if (!content) {
      return;
    }

    void content.scrollToTop(0).catch(() => undefined);
  }

  private handlePickerError(error: unknown): void {
    this.pickerErrorKey.set(this.mapPickerError(error));
    this.returnToFileSelectionStep();
  }

  private clearPickerError(): void {
    this.pickerErrorKey.set(null);
    this.pickerErrorIssues?.set([]);
    this.pickerErrorDiagnosisName?.set(null);
  }

  private setPickerDiagnosisFailure(
    issues: EpubDiagnosticIssue[],
    displayName?: string,
  ): void {
    this.pickerErrorIssues.set(issues);
    this.pickerErrorDiagnosisName.set(displayName ?? null);
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

  private async hasMissingRecoveredWorkingCopies(): Promise<boolean> {
    const selections = [
      ...this.mergeSelections(),
      ...(this.splitSelection() ? [this.splitSelection()!] : []),
    ];

    const results = await Promise.all(
      selections.map(async (selection) => {
        if (
          !selection.workingPath ||
          (selection.sourceKind === 'native' && !selection.workingNativePath)
        ) {
          return false;
        }
        return this.fileKit
          .exists({ dir: 'Data', path: selection.workingPath })
          .catch(() => false);
      }),
    );

    return results.some((exists) => !exists);
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
