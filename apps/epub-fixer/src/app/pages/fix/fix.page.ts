import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { ToastOptions } from '@ionic/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  IonButtons,
  IonButton,
  IonCol,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonGrid,
  IonCheckbox,
  IonPopover,
  IonRow,
  IonRadio,
  IonRadioGroup,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircle,
  chevronDownOutline,
  chevronForwardOutline,
  appsOutline,
  closeOutline,
  documentOutline,
  fileTrayOutline,
  fileTrayStackedOutline,
  helpCircleOutline,
  shareSocialOutline,
  sparklesOutline,
  refreshOutline,
} from 'ionicons/icons';
import {
  buildEpubIssueSelectionKey,
  classifyEpubDiagnosticRepairMode,
  EpubDiagnosticResult,
  type EpubDiagnosticPage,
  type EpubDiagnosticRepairMode,
  type EpubDiagnosticIssue,
  EpubFixerPortError,
  EpubRewriteError,
  EpubRepairResult,
  EpubRepairingService,
  type EpubOperationProgress,
} from '@sheldrapps/file-kit';
import {
  AdFallbackService,
  type AdFailureConfidence,
  type AdFailureReason,
} from '@sheldrapps/ad-fallback-kit';
import {
  AdsService,
  BillingService,
  ExportAccessService,
  PURCHASE_INTENT_QUERY_PARAM,
  REMOVE_ADS_PURCHASE_INTENT,
  RemoveAdsPurchasePageService,
} from '@sheldrapps/ads-kit';
import {
  ActionCardComponent,
  RenameIconComponent,
  ProBadgeComponent,
  SpinnerComponent,
  SectionCardComponent,
  SaveCoverModalComponent,
  ScrollableBarItem,
  ScrollableButtonBarComponent,
  FilePickerPanelComponent,
  WorkflowNavigationComponent,
  WorkflowStepperComponent,
} from '@sheldrapps/ui-theme';
import { CoverImageStateComponent } from '@sheldrapps/image-workflow';
import { EditorSessionExitService } from '@sheldrapps/image-workflow/editor';
import type {
  FilePickerPanelItem,
  FilePickerPanelRemoveEvent,
  WorkflowStep,
} from '@sheldrapps/ui-theme';
import {
  RecommendedApp,
  RecommendedAppsService,
  buildHomeHeaderItems,
  handleHomeHeaderAction,
} from '@sheldrapps/recommended-apps';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { CoversEventsService } from '../../services/covers-events.service';

import { EpubFixerWorkflowService } from '../../services/epub-fixer-workflow.service';
import {
  EpubLibraryService,
  type LoadedGeneratedEpub,
} from '../../services/epub-library.service';
import { EpubFixerSettings } from '../../settings/epub-fixer-settings.schema';
import {
  LifecycleDiagnosticsService,
  WorkflowRecoveryCoordinator,
} from '@sheldrapps/lifecycle-kit';

type DiagnosisSeverityLevel = 'critical' | 'high' | 'medium' | 'low';
type FixMode = 'single' | 'multiple';
type IssueSectionKind = 'automatic' | 'confirmation' | 'manual' | 'blocked';

type IssueSectionView = {
  key: string;
  labelKey: string;
  kind: IssueSectionKind;
  issues: EpubDiagnosticIssue[];
  count: number;
};

const ISSUE_GROUP_BATCH_SIZE = 50;

type IssueGroupView = {
  key: string;
  primaryIssue: EpubDiagnosticIssue;
  issues: EpubDiagnosticIssue[];
};

type MultipleEpubDiagnosis = {
  id: string;
  sessionId: string;
  file: File | null;
  selectedName: string;
  sourceSize: number;
  diagnosis: EpubDiagnosticResult;
};

type EpubFixerRecoverySnapshot = {
  fixMode?: FixMode | null;
  selectedEpubName?: string;
  sourceEpubMeta?: FixPage['sourceEpubMeta'];
  workflowStep: number;
  viewState: FixPage['viewState'];
  epubErrorKey?: string;
  epubErrorParams: Record<string, unknown>;
  diagnosis?: EpubDiagnosticResult;
  repairResult?: EpubRepairResult;
  exportResult?: FixPage['exportResult'];
};

@Component({
  selector: 'app-fix-page',
  standalone: true,
  templateUrl: './fix.page.html',
  styleUrls: ['./fix.page.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonButtons,
    IonIcon,
    IonCheckbox,
    IonItem,
    IonLabel,
    IonPopover,
    IonRadio,
    IonRadioGroup,
    IonRow,
    IonTitle,
    IonToolbar,
    ActionCardComponent,
    RenameIconComponent,
    ProBadgeComponent,
    CoverImageStateComponent,
    SpinnerComponent,
    SectionCardComponent,
    ScrollableButtonBarComponent,
    FilePickerPanelComponent,
    WorkflowNavigationComponent,
    WorkflowStepperComponent,
  ],
})
export class FixPage implements OnInit, OnDestroy {
  private readonly repairing = inject(EpubRepairingService);
  private readonly workflow = inject(EpubFixerWorkflowService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly library = inject(EpubLibraryService);
  private readonly ads = inject(AdsService);
  private readonly exportAccess = inject(ExportAccessService);
  private readonly adFallback = inject(AdFallbackService);
  private readonly billing = inject(BillingService);
  private readonly removeAdsPurchasePage = inject(RemoveAdsPurchasePageService);
  private readonly settings = inject(SettingsStore<EpubFixerSettings>);
  private readonly coversEvents = inject(CoversEventsService);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly editorSessionExit = inject(EditorSessionExitService);
  private readonly lifecycle = inject(LifecycleDiagnosticsService);
  private readonly recovery = inject(WorkflowRecoveryCoordinator);
  private recoveryEpubFile?: File;

  @ViewChild('epubInput') epubInput!: ElementRef<HTMLInputElement>;
  @ViewChild('multipleEpubInput') multipleEpubInput!: ElementRef<HTMLInputElement>;

  constructor() {
    addIcons({
      alertCircleOutline,
      checkmarkCircle,
      chevronDownOutline,
      chevronForwardOutline,
      appsOutline,
      closeOutline,
      documentOutline,
      fileTrayOutline,
      fileTrayStackedOutline,
      helpCircleOutline,
      shareSocialOutline,
      sparklesOutline,
      refreshOutline,
    });
  }

  headerItems: ScrollableBarItem[] = [];
  recommendedApps: RecommendedApp[] = [];
  showRecommended = false;

  preparedSessionId?: string;
  fixMode: FixMode | null = null;
  multipleEpubDiagnoses: MultipleEpubDiagnosis[] = [];
  selectedEpubName?: string;
  sourceEpubMeta?: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  };
  diagnosis?: EpubDiagnosticResult;
  repairResult?: EpubRepairResult;
  exportResult?: {
    size: number;
    outputName: string;
    outputUri: string;
    previewSrc?: string;
  };
  removeAdsPriceFormatted: string | null = null;
  purchaseModalOpen = false;
  private readonly purchaseBusyState = signal(false);

  get purchaseBusy(): boolean {
    return this.purchaseBusyState();
  }

  set purchaseBusy(value: boolean) {
    this.purchaseBusyState.set(value);
  }
  private readonly adFallbackApp = 'ef' as const;
  private readonly adFallbackTotal = 1;
  private adFallbackRemaining = this.adFallbackTotal;
  private readonly adFallbackRemainingPrefKey = 'ef_ad_fallback_remaining';
  private readonly adFallbackTrialActivePrefKey = 'ef_ad_fallback_trial_active';
  private adFallbackTrialActive = false;

  get workflowSteps(): readonly WorkflowStep[] {
    return [
      { id: 'mode', label: this.translate.instant('FIX.STEPPER.MODE') },
      { id: 'load', label: this.translate.instant('FIX.STEPPER.LOAD') },
      { id: 'confirm', label: this.translate.instant('FIX.STEPPER.CONFIRM') },
      { id: 'fix', label: this.translate.instant('FIX.STEPPER.FIX') },
    ];
  }
  workflowStep = 0;

  viewState:
    | 'idle'
    | 'prepared'
    | 'diagnosing'
    | 'diagnosed'
    | 'repairing'
    | 'repaired'
    | 'failed' = 'idle';
  epubErrorKey?: string;
  epubErrorParams: Record<string, unknown> = {};
  private readonly busyActionState = signal<
    'prepare' | 'diagnose' | 'repair' | 'export' | undefined
  >(undefined);
  private readonly busyProgressPercentState = signal(0);
  private readonly isResettingFlowState = signal(false);
  readonly operationCompleted = signal(false);

  get busyAction(): 'prepare' | 'diagnose' | 'repair' | 'export' | undefined {
    return this.busyActionState();
  }

  set busyAction(value: 'prepare' | 'diagnose' | 'repair' | 'export' | undefined) {
    this.busyActionState.set(value);
  }

  get busyProgressPercent(): number {
    return this.busyProgressPercentState();
  }

  set busyProgressPercent(value: number) {
    this.busyProgressPercentState.set(value);
  }

  get isResettingFlow(): boolean {
    return this.isResettingFlowState();
  }

  set isResettingFlow(value: boolean) {
    this.isResettingFlowState.set(value);
  }
  adsRemoved = false;
  private adsRemovedSub?: Subscription;
  private removeAdsPriceSub?: Subscription;
  private headerLangSub?: Subscription;
  private headerTranslationSub?: Subscription;
  private diagnosisProgressListener?: { remove: () => Promise<void> };
  private lastHandledProjectRouteKey: string | null = null;
  private selectedConfirmationByIssueKey: Record<string, boolean> = {};
  private selectedGuidedOptionByIssueKey: Record<string, string> = {};
  private readonly expandedIssueGroupKeys = new Set<string>();
  private readonly issueGroupVisibleCounts = new Map<string, number>();
  private readonly issueGroupLoadingKeys = new Set<string>();

  infoOpen = false;
  infoEvent: Event | null = null;

  get isBusy(): boolean {
    return !!this.busyAction;
  }

  get workflowPreviousLabel(): string {
    return this.workflowSteps[this.workflowStep - 1]?.label ?? '';
  }

  get workflowNextLabel(): string {
    return this.workflowSteps[this.workflowStep + 1]?.label ?? '';
  }

  get selectableWorkflowSteps(): readonly number[] {
    const steps = [0];
    if (this.fixMode) {
      steps.push(1);
    }
    if (this.hasValidEpub() && !!this.diagnosis) {
      steps.push(2);
    }
    if (this.canRepair || this.canExport || this.viewState === 'repaired') {
      steps.push(3);
    }
    return steps;
  }

  get canContinueWorkflow(): boolean {
    if (this.workflowStep === 0) {
      return !!this.fixMode && !this.isBusy;
    }

    if (this.workflowStep === 1 || this.workflowStep === 2) {
      if (this.workflowStep === 1 && this.fixMode === 'multiple') {
        return this.multipleEpubDiagnoses.length > 0 && !this.isBusy;
      }
      return (this.canRepair || this.canExport) && !this.isBusy;
    }

    return false;
  }

  async onWorkflowNext(): Promise<void> {
    if (!this.canContinueWorkflow) {
      return;
    }

    this.workflowStep += 1;
    if (this.workflowStep === 3) {
      void this.ads?.warmRewarded().catch(() => undefined);
    }
  }

  onWorkflowPrevious(): void {
    if (this.workflowStep > 0 && !this.isBusy) {
      this.operationCompleted.set(false);
      this.workflowStep -= 1;
    }
  }

  selectFixMode(mode: FixMode): void {
    if (
      this.isBusy ||
      (mode === 'multiple' && !this.canUseMultipleFiles)
    ) {
      return;
    }

    this.fixMode = mode;
    this.operationCompleted.set(false);
    this.workflowStep = 1;
  }

  onWorkflowStepSelected(step: number): void {
    if (
      step < 0 ||
      step >= this.workflowSteps.length ||
      step === this.workflowStep ||
      !this.selectableWorkflowSteps.includes(step) ||
      this.isBusy
    ) {
      return;
    }

    this.operationCompleted.set(false);
    this.workflowStep = step;
  }

  get loadingLabelKey(): string {
    if (this.busyAction === 'diagnose') {
      return 'FIX.LOADING_DIAGNOSE';
    }
    if (this.busyAction === 'repair') {
      return 'FIX.LOADING_REPAIR';
    }
    if (this.busyAction === 'export') {
      return 'FIX.LOADING_EXPORT';
    }
    return 'FIX.READING_EPUB';
  }

  get loadingProgressLabel(): string {
    const percent = Math.max(
      0,
      Math.min(100, Math.round(this.busyProgressPercent)),
    );
    return `${percent}%`;
  }

  get showLargeFileWarning(): boolean {
    return this.workflow.shouldWarnForLargeWebFile(this.sourceEpubMeta?.size);
  }

  get recommendedWebSizeMB(): number {
    return this.workflow.recommendedWebSizeMB;
  }

  get hasSelectedEpub(): boolean {
    return !!this.selectedEpubName && !this.epubErrorKey;
  }

  get canDiagnose(): boolean {
    return (
      this.fixMode !== 'multiple' &&
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.viewState === 'prepared'
    );
  }

  get canRepair(): boolean {
    if (this.fixMode === 'multiple') {
      return (
        this.multipleEpubDiagnoses.some(
          (item) => item.diagnosis.status === 'repairable',
        ) &&
        !this.isBusy &&
        this.viewState === 'diagnosed' &&
        !this.hasPendingConfirmationSelection &&
        !this.hasPendingGuidedSelection
      );
    }

    return (
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.viewState === 'diagnosed' &&
      this.diagnosis?.status === 'repairable' &&
      !this.hasPendingConfirmationSelection &&
      !this.hasPendingGuidedSelection
    );
  }

  get canUseMultipleFiles(): boolean {
    return this.adsRemoved;
  }

  get canExport(): boolean {
    if (this.fixMode === 'multiple') {
      return (
        this.multipleEpubDiagnoses.length > 0 &&
        this.multipleEpubDiagnoses.every(
          (item) => item.diagnosis.status === 'valid',
        ) &&
        !this.isBusy &&
        this.viewState === 'diagnosed'
      );
    }

    return (
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.viewState === 'diagnosed' &&
      this.diagnosis?.status === 'valid'
    );
  }

  get canSaveShare(): boolean {
    return (
      (!!this.preparedSessionId || this.fixMode === 'multiple') &&
      !this.isBusy &&
      !this.epubErrorKey &&
      !!this.exportResult
    );
  }

  get showPreparedActionCard(): boolean {
    return (
      this.hasValidEpub() &&
      (this.viewState === 'prepared' || this.viewState === 'diagnosing')
    );
  }

  get showReviewChecklist(): boolean {
    return this.hasValidEpub() && this.viewState === 'prepared';
  }

  get showIssuesList(): boolean {
    return (
      this.workflowStep === 2 &&
      this.hasValidEpub() &&
      !!this.diagnosis &&
      this.diagnosis.issues.length > 0
    );
  }

  get showDiagnosisOverview(): boolean {
    return this.hasValidEpub() && !!this.diagnosis;
  }

  get multipleFilePickerItems(): readonly FilePickerPanelItem[] {
    return this.multipleEpubDiagnoses.map((item) => ({
      id: item.id,
      title: item.selectedName,
      subtitle: this.formatFileSize(item.sourceSize),
      ariaLabel: item.selectedName,
    }));
  }

  multipleDiagnosisIssues(item: MultipleEpubDiagnosis): EpubDiagnosticIssue[] {
    return item.diagnosis.issues.map((issue) =>
      this.withMultipleSource(issue, item),
    );
  }

  multipleDiagnosisSeveritySummary(item: MultipleEpubDiagnosis): {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  } {
    const summary = {
      totalIssues: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
    };

    for (const issue of this.multipleDiagnosisIssues(item)) {
      summary.totalIssues += 1;
      switch (this.issueSeverityLevel(issue)) {
        case 'critical':
          summary.criticalIssues += 1;
          break;
        case 'high':
          summary.highIssues += 1;
          break;
        case 'medium':
          summary.mediumIssues += 1;
          break;
        case 'low':
          summary.lowIssues += 1;
          break;
      }
    }

    return summary;
  }

  multipleDiagnosisSeveritySegments(item: MultipleEpubDiagnosis): Array<{
    level: DiagnosisSeverityLevel;
    count: number;
  }> {
    const summary = this.multipleDiagnosisSeveritySummary(item);
    return [
      { level: 'critical', count: summary.criticalIssues },
      { level: 'high', count: summary.highIssues },
      { level: 'medium', count: summary.mediumIssues },
      { level: 'low', count: summary.lowIssues },
    ];
  }

  multipleIssueSections(item: MultipleEpubDiagnosis): IssueSectionView[] {
    return this.buildIssueSections(this.multipleDiagnosisIssues(item));
  }

  multipleConfirmationIssues(item: MultipleEpubDiagnosis): EpubDiagnosticIssue[] {
    return this.multipleDiagnosisIssues(item).filter(
      (issue) => this.issueRepairMode(issue) === 'review',
    );
  }

  async onMultipleEpubRemoved(event: FilePickerPanelRemoveEvent): Promise<void> {
    const removed = this.multipleEpubDiagnoses.find(
      (item) => item.id === event.id,
    );
    if (!removed) {
      return;
    }

    this.multipleEpubDiagnoses = this.multipleEpubDiagnoses.filter(
      (item) => item.id !== event.id,
    );
    await this.workflow.cleanup(removed.sessionId).catch(() => undefined);

    if (this.multipleEpubDiagnoses.length === 0) {
      this.diagnosis = undefined;
      this.workflowStep = 1;
      this.viewState = 'prepared';
      return;
    }

    this.diagnosis = this.aggregateMultipleDiagnosis();
  }

  get diagnosisSeveritySummary(): {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  } {
    const issues = this.diagnosis?.issues ?? [];
    const totalFindings = this.diagnosis?.summary?.totalFindings ?? issues.length;
    const summary = {
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
    };

    for (const issue of issues) {
      switch (this.issueSeverityLevel(issue)) {
        case 'critical':
          summary.criticalIssues += 1;
          break;
        case 'high':
          summary.highIssues += 1;
          break;
        case 'medium':
          summary.mediumIssues += 1;
          break;
        case 'low':
          summary.lowIssues += 1;
          break;
      }
    }

    if (this.hasTruncatedDiagnosisPreview(issues, totalFindings)) {
      const visibleLevels = new Set(
        issues.map((issue) => this.issueSeverityLevel(issue)),
      );
      if (visibleLevels.size === 1) {
        const [level] = visibleLevels;
        switch (level) {
          case 'critical':
            summary.criticalIssues = totalFindings;
            break;
          case 'high':
            summary.highIssues = totalFindings;
            break;
          case 'medium':
            summary.mediumIssues = totalFindings;
            break;
          case 'low':
            summary.lowIssues = totalFindings;
            break;
        }
      }
    }

    return {
      totalIssues: totalFindings,
      ...summary,
    };
  }

  get autoFixableIssueCount(): number {
    return (
      this.diagnosisSummary.automaticIssues + this.diagnosisSummary.reviewIssues
    );
  }

  get autoFixableIssues(): EpubDiagnosticIssue[] {
    return this.issuesByMode('automatic', 'review');
  }

  get manualInterventionIssues(): EpubDiagnosticIssue[] {
    return this.issuesByMode('guided');
  }

  get confirmationIssues(): EpubDiagnosticIssue[] {
    return this.issuesByMode('review');
  }

  get issueSections(): IssueSectionView[] {
    const issues = this.diagnosis?.issues ?? [];
    const summary = this.diagnosisSummary;
    return this.buildIssueSections(issues, {
      automatic: summary.automaticIssues,
      confirmation: summary.reviewIssues,
      manual: summary.guidedIssues,
      blocked: summary.blockedIssues,
    });
  }

  private buildIssueSections(
    issues: EpubDiagnosticIssue[],
    sectionCountOverrides?: Partial<Record<IssueSectionKind, number>>,
  ): IssueSectionView[] {
    const sections: IssueSectionView[] = [
      {
        key: 'automatic',
        labelKey: 'FIX.DIAGNOSIS_FIXABLE',
        kind: 'automatic',
        issues: this.issuesByModeFrom(issues, 'automatic'),
        count: 0,
      },
      {
        key: 'confirmation',
        labelKey: 'FIX.DIAGNOSIS_REVIEW',
        kind: 'confirmation',
        issues: this.issuesByModeFrom(issues, 'review'),
        count: 0,
      },
      {
        key: 'manual',
        labelKey: 'FIX.DIAGNOSIS_GUIDED',
        kind: 'manual',
        issues: this.issuesByModeFrom(issues, 'guided'),
        count: 0,
      },
      {
        key: 'blocked',
        labelKey: 'FIX.DIAGNOSIS_BLOCKED',
        kind: 'blocked',
        issues: this.issuesByModeFrom(issues, 'not_repairable'),
        count: 0,
      },
    ];

    return sections
      .map((section) => ({
        ...section,
        count: sectionCountOverrides?.[section.kind] ?? section.issues.length,
      }))
      .filter((section) => section.count > 0);
  }

  issueGroups(issues: EpubDiagnosticIssue[], sectionKey: string): IssueGroupView[] {
    const groups = new Map<string, IssueGroupView>();

    for (const issue of issues) {
      const key = `${sectionKey}:${issue.code}`;
      const group = groups.get(key);

      if (group) {
        group.issues.push(issue);
        continue;
      }

      groups.set(key, {
        key,
        primaryIssue: issue,
        issues: [issue],
      });
    }

    return Array.from(groups.values());
  }

  isIssueGroupExpanded(group: IssueGroupView): boolean {
    return this.expandedIssueGroupKeys?.has(group.key) ?? false;
  }

  toggleIssueGroup(
    group: IssueGroupView,
    diagnosis: EpubDiagnosticResult | undefined = this.diagnosis,
  ): void {
    if (this.issueGroupCount(group, diagnosis) < 2) {
      return;
    }

    if (this.expandedIssueGroupKeys.has(group.key)) {
      this.expandedIssueGroupKeys.delete(group.key);
      return;
    }

    this.expandedIssueGroupKeys.add(group.key);
  }

  issueGroupChevronName(group: IssueGroupView): string {
    return this.isIssueGroupExpanded(group)
      ? 'chevron-down-outline'
      : 'chevron-forward-outline';
  }

  issueGroupCount(
    group: IssueGroupView,
    diagnosis: EpubDiagnosticResult | undefined = this.diagnosis,
  ): number {
    const count = diagnosis?.summary?.byCode?.[group.primaryIssue.code];
    return typeof count === 'number' ? count : group.issues.length;
  }

  issueGroupToggleAriaLabel(
    group: IssueGroupView,
    diagnosis: EpubDiagnosticResult | undefined = this.diagnosis,
  ): string {
    return this.issueGroupCount(group, diagnosis) + ': ' + this.issueMessageLabel(group.primaryIssue);
  }

  visibleIssueGroupIssues(group: IssueGroupView): EpubDiagnosticIssue[] {
    const visibleCount = this.issueGroupVisibleCounts.get(group.key) ?? ISSUE_GROUP_BATCH_SIZE;
    return group.issues.slice(0, visibleCount);
  }

  canLoadMoreIssueGroup(
    group: IssueGroupView,
    diagnosis: EpubDiagnosticResult | undefined = this.diagnosis,
  ): boolean {
    const visibleCount = this.issueGroupVisibleCounts.get(group.key) ?? ISSUE_GROUP_BATCH_SIZE;
    return visibleCount < this.issueGroupCount(group, diagnosis);
  }

  isIssueGroupLoading(group: IssueGroupView): boolean {
    return this.issueGroupLoadingKeys.has(group.key);
  }

  async loadMoreIssueGroup(
    group: IssueGroupView,
    diagnosis: EpubDiagnosticResult | undefined = this.diagnosis,
  ): Promise<void> {
    if (!diagnosis?.diagnosisId || this.issueGroupLoadingKeys.has(group.key)) {
      return;
    }

    const visibleCount = this.issueGroupVisibleCounts.get(group.key) ?? ISSUE_GROUP_BATCH_SIZE;
    if (visibleCount < group.issues.length) {
      this.issueGroupVisibleCounts.set(
        group.key,
        Math.min(visibleCount + ISSUE_GROUP_BATCH_SIZE, group.issues.length),
      );
      await this.flushUi();
      return;
    }

    if (group.issues.length >= this.issueGroupCount(group, diagnosis)) {
      return;
    }

    const cursor = diagnosis.page?.nextCursor ?? String(diagnosis.issues.length);

    this.issueGroupLoadingKeys.add(group.key);
    try {
      const page = await this.workflow.getDiagnosisIssues(
        diagnosis.sessionId,
        diagnosis.diagnosisId,
        cursor,
        ISSUE_GROUP_BATCH_SIZE,
      );
      if (page.items.length === 0) {
        return;
      }

      this.updateDiagnosisWithPage(diagnosis, page);
      this.issueGroupVisibleCounts.set(
        group.key,
        Math.min(
          visibleCount + page.items.length,
          this.issueGroupCount(group, diagnosis),
        ),
      );
    } finally {
      this.issueGroupLoadingKeys.delete(group.key);
      await this.flushUi();
    }
  }

  private updateDiagnosisWithPage(
    diagnosis: EpubDiagnosticResult,
    page: EpubDiagnosticPage & { diagnosisId: string },
  ): void {
    const issues = [...diagnosis.issues, ...page.items];
    const updatedDiagnosis: EpubDiagnosticResult = {
      ...diagnosis,
      issues,
      page: {
        items: issues,
        total: page.total,
        nextCursor: page.nextCursor,
      },
    };
    const multipleIndex = this.multipleEpubDiagnoses.findIndex(
      (item) => item.diagnosis === diagnosis,
    );

    if (multipleIndex >= 0) {
      this.multipleEpubDiagnoses = this.multipleEpubDiagnoses.map(
        (item, index) =>
          index === multipleIndex
            ? { ...item, diagnosis: updatedDiagnosis }
            : item,
      );
      this.diagnosis = this.aggregateMultipleDiagnosis();
      return;
    }

    if (this.diagnosis === diagnosis) {
      this.diagnosis = updatedDiagnosis;
    }
  }
  get diagnosisSummary(): {
    totalIssues: number;
    automaticIssues: number;
    reviewIssues: number;
    guidedIssues: number;
    blockedIssues: number;
  } {
    const issues = this.diagnosis?.issues ?? [];
    const totalFindings = this.diagnosis?.summary?.totalFindings ?? issues.length;
    const fixableFindings = this.diagnosis?.summary?.fixableFindings;
    const summary = {
      automaticIssues: 0,
      reviewIssues: 0,
      guidedIssues: 0,
      blockedIssues: 0,
    };

    for (const issue of issues) {
      switch (this.issueRepairMode(issue)) {
        case 'automatic':
          summary.automaticIssues += 1;
          break;
        case 'review':
          summary.reviewIssues += 1;
          break;
        case 'guided':
          summary.guidedIssues += 1;
          break;
        case 'not_repairable':
          summary.blockedIssues += 1;
          break;
      }
    }

    if (
      this.hasTruncatedDiagnosisPreview(issues, totalFindings) &&
      typeof fixableFindings === 'number'
    ) {
      const visibleModes = new Set(
        issues.map((issue) => this.issueRepairMode(issue)),
      );
      if (visibleModes.size === 1 && visibleModes.has('automatic')) {
        summary.automaticIssues = fixableFindings;
      } else if (visibleModes.size === 1 && visibleModes.has('review')) {
        summary.reviewIssues = fixableFindings;
      }
    }

    return {
      totalIssues: totalFindings,
      ...summary,
    };
  }

  private hasTruncatedDiagnosisPreview(
    issues: EpubDiagnosticIssue[],
    totalFindings: number,
  ): boolean {
    return issues.length > 0 && totalFindings > issues.length;
  }
  get diagnosisSeveritySegments(): Array<{
    level: DiagnosisSeverityLevel;
    count: number;
  }> {
    return [
      {
        level: 'critical' as const,
        count: this.diagnosisSeveritySummary.criticalIssues,
      },
      {
        level: 'high' as const,
        count: this.diagnosisSeveritySummary.highIssues,
      },
      {
        level: 'medium' as const,
        count: this.diagnosisSeveritySummary.mediumIssues,
      },
      {
        level: 'low' as const,
        count: this.diagnosisSeveritySummary.lowIssues,
      },
    ];
  }

  get resultPrimaryActionKey(): string | null {
    if (this.viewState === 'failed') {
      return null;
    }
    if (
      this.viewState === 'diagnosed' &&
      this.diagnosis?.status === 'repairable' &&
      !this.exportResult
    ) {
      return 'FIX.ACTION_REPAIR';
    }
    if (this.canExport && !this.exportResult) {
      return 'FIX.ACTION_EXPORT';
    }
    return null;
  }

  get maxUploadSizeMB(): number {
    return this.workflow.maxNativeSizeMB;
  }

  get fileCardDescription(): string {
    const actionKey = this.selectedEpubName
      ? 'FIX.TAP_TO_CHANGE'
      : 'FIX.ACTION_SELECT_EPUB';
    const action = this.translate.instant(actionKey);
    const limits = this.translate.instant('FIX.EPUB_FILE_LIMITS', {
      maxSize: this.maxUploadSizeMB,
    });
    return `${action} · ${limits}`;
  }

  canShowRemoveAdsEntryPoint(): boolean {
    return !this.adsRemoved && this.billing.canShowRemoveAdsEntryPoint();
  }

  getRemoveAdsCtaSubtitleKey(): string {
    return this.removeAdsPriceFormatted
      ? 'COMMON.REMOVE_ADS_CTA_SUBTITLE_WITH_PRICE'
      : 'COMMON.REMOVE_ADS_CTA_SUBTITLE';
  }

  getRemoveAdsPriceParams(): Record<string, string> {
    return this.removeAdsPriceFormatted
      ? { price: this.removeAdsPriceFormatted }
      : {};
  }

  getRemoveAdsPurchaseState(): 'ready' | 'unavailable' {
    return this.billing.isDevelopmentMode() || this.billing.isBillingAvailable()
      ? 'ready'
      : 'unavailable';
  }

  getRemoveAdsModalDescriptionKey(): string {
    return this.getRemoveAdsPurchaseState() === 'ready'
      ? 'COMMON.REMOVE_ADS_DESCRIPTION'
      : 'COMMON.BILLING_UNAVAILABLE';
  }

  shouldShowRemoveAdsModalPrice(): boolean {
    return (
      this.getRemoveAdsPurchaseState() === 'ready' &&
      !!this.removeAdsPriceFormatted
    );
  }

  canPurchaseRemoveAds(): boolean {
    return (
      this.canShowRemoveAdsEntryPoint() &&
      this.getRemoveAdsPurchaseState() === 'ready' &&
      !this.purchaseBusy
    );
  }

  canRestoreRemoveAds(): boolean {
    return (
      this.canShowRemoveAdsEntryPoint() &&
      this.getRemoveAdsPurchaseState() === 'ready' &&
      !this.purchaseBusy
    );
  }

  private logPurchaseUiState(source: string): void {
    this.billing.logPurchaseUiState(source, {
      app: 'ef',
      adsRemoved: this.adsRemoved,
      navigatorOnline:
        typeof navigator === 'undefined' ? undefined : navigator.onLine,
      purchaseBusy: this.purchaseBusy,
      entryPointVisible: this.canShowRemoveAdsEntryPoint(),
      purchaseState: this.getRemoveAdsPurchaseState(),
      purchaseButtonEnabled: this.canPurchaseRemoveAds(),
      restoreButtonEnabled: this.canRestoreRemoveAds(),
    });
  }

  async ngOnInit(): Promise<void> {
    this.headerLangSub = this.translate.onLangChange.subscribe(() => {
      void this.refreshHeaderItems();
    });
    this.headerTranslationSub = this.translate.onTranslationChange.subscribe((event) => {
      if (event.lang) {
        void this.refreshHeaderItems();
      }
    });
    await this.refreshHeaderItems();
    if (this.workflow.usesNativePicker()) {
      this.diagnosisProgressListener = await this.workflow.addProgressListener(
        (progress: EpubOperationProgress) => {
          const isDiagnosisProgress =
            this.busyAction === 'diagnose' && progress.phase === 'diagnosing';
          const isRepairProgress =
            this.busyAction === 'repair' &&
            (progress.phase === undefined ||
              progress.phase === 'diagnosing' ||
              progress.phase === 'writing');
          if (!isDiagnosisProgress && !isRepairProgress) {
            return;
          }
          this.runInZone(() => {
            this.busyProgressPercent = progress.percent;
          });
        },
      );
    }
    await this.billing.hydrateCachedState();
    const settings = await this.settings.load();
    this.hydrateAdFallbackState(settings.preferences);
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe((value) => {
      this.runInZone(() => {
        this.adsRemoved = value;
        if (value) {
          this.adFallbackTrialActive = false;
          void this.persistAdFallbackState();
        }
      });
    });
    this.adsRemoved = this.billing.isAdsRemoved();
    this.removeAdsPriceFormatted = this.billing.getRemoveAdsPriceFormatted();
    this.removeAdsPriceSub = this.billing.removeAdsPrice$.subscribe((value) => {
      this.runInZone(() => {
        this.removeAdsPriceFormatted = value;
      });
    });
    this.registerRecovery();
    await this.recovery.restore();
  }

  ngOnDestroy(): void {
    this.lifecycle.log('Ionic.FixPage.ngOnDestroy', {
      workflowStep: this.workflowStep,
    });
    this.closeInfo();
    this.closePurchaseModal();
    this.adsRemovedSub?.unsubscribe();
    this.removeAdsPriceSub?.unsubscribe();
    this.headerLangSub?.unsubscribe();
    this.headerTranslationSub?.unsubscribe();
    void this.diagnosisProgressListener?.remove();
    void this.recovery.save();
  }

  async ionViewWillEnter(): Promise<void> {
    this.lifecycle.log('Ionic.FixPage.ionViewWillEnter', {
      workflowStep: this.workflowStep,
    });
    await this.refreshHeaderItems();
    await this.tryOpenProjectFromRoute();
    await this.tryOpenPurchaseFromRoute();
  }

  private async tryOpenPurchaseFromRoute(): Promise<void> {
    if (
      this.route.snapshot.queryParamMap.get(PURCHASE_INTENT_QUERY_PARAM) !==
      REMOVE_ADS_PURCHASE_INTENT
    ) {
      return;
    }

    await this.openPurchaseModal();
  }

  ionViewWillLeave(): void {
    this.lifecycle.log('Ionic.FixPage.ionViewWillLeave', {
      workflowStep: this.workflowStep,
    });
    void this.recovery.save();
    this.closeInfo();
  }

  private registerRecovery(): void {
    this.recovery.register<EpubFixerRecoverySnapshot>({
      snapshot: () => ({
        selectedEpubName: this.selectedEpubName,
        sourceEpubMeta: this.sourceEpubMeta,
        workflowStep: this.workflowStep,
        viewState: this.viewState,
        epubErrorKey: this.epubErrorKey,
        epubErrorParams: this.epubErrorParams,
        diagnosis: this.diagnosis,
        repairResult: this.repairResult,
        exportResult: this.exportResult,
        fixMode: this.fixMode,
      }),
      assets: () => ({ epub: this.recoveryEpubFile }),
      restore: async (snapshot, assets) => {
        const epub = assets['epub'];
        if (!epub) return;
        const prepared = await this.workflow.prepareFromFile(epub);
        this.recoveryEpubFile = epub;
        this.preparedSessionId = prepared.sessionId;
        this.selectedEpubName = snapshot.selectedEpubName ?? epub.name;
        this.sourceEpubMeta = snapshot.sourceEpubMeta ?? {
          name: epub.name,
          size: epub.size,
          lastModified: epub.lastModified,
          type: epub.type,
        };
        this.epubErrorKey = snapshot.epubErrorKey;
        this.epubErrorParams = snapshot.epubErrorParams ?? {};
        this.diagnosis = snapshot.diagnosis;
        this.repairResult = snapshot.repairResult;
        this.exportResult = snapshot.exportResult;
        const hasModeSnapshot = Object.prototype.hasOwnProperty.call(
          snapshot,
          'fixMode',
        );
        this.fixMode = hasModeSnapshot ? snapshot.fixMode ?? null : 'single';
        this.viewState = snapshot.viewState;
        this.workflowStep = hasModeSnapshot
          ? Math.max(0, Math.min(3, snapshot.workflowStep))
          : Math.min(3, snapshot.workflowStep + 1);
      },
    });
  }

  openEpubPicker(): void {
    if (this.fixMode === 'multiple') {
      if (this.usesNativePrepare()) {
        void this.pickNativeEpubs();
      } else {
        this.multipleEpubInput.nativeElement.click();
      }
      return;
    }
    if (this.usesNativePrepare()) {
      void this.pickNativeEpub();
      return;
    }
    this.epubInput.nativeElement.click();
  }

  private runInZone<T>(fn: () => T): T {
    return NgZone.isInAngularZone() || !this.zone ? fn() : this.zone.run(fn);
  }

  private async flushUi(): Promise<void> {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }
    this.runInZone(() => {
      this.changeDetector?.markForCheck();
      this.changeDetector?.detectChanges();
    });
  }

  private async clearBusyState(): Promise<void> {
    this.runInZone(() => {
      this.busyAction = undefined;
      this.busyProgressPercent = 0;
    });
  }

  private async setBusyProgress(percent: number): Promise<void> {
    this.busyProgressPercent = Math.max(0, Math.min(100, Math.round(percent)));
    await this.flushUi();
  }

  async onEpubSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.recoveryEpubFile = file;

    await this.runInZone(async () => {
      this.busyAction = 'prepare';
      this.busyProgressPercent = 0;
      try {
        await this.resetWorkflowForNewEpub();
        await this.setBusyProgress(12);
        const prepared = await this.workflow.prepareFromFile(file);
        await this.setBusyProgress(48);

        this.preparedSessionId = prepared.sessionId;
        this.selectedEpubName = file.name;
        this.sourceEpubMeta = {
          name: prepared.originalName,
          size: prepared.originalSize,
          lastModified: file.lastModified,
          type: file.type || 'application/epub+zip',
        };
        this.viewState = 'prepared';
        this.clearEpubError();

        const diagnosisSucceeded = await this.performDiagnosis();
        if (!diagnosisSucceeded) {
          await this.cleanupPreparedEpub();
          return;
        }
      } catch (error) {
        this.failEpub(this.mapPrepareError(error), file);
        await this.cleanupPreparedEpub();
      } finally {
        await this.clearBusyState();
        input.value = '';
      }
    });
  }

  async onMultipleEpubsSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    if (files.length === 0 || this.isBusy) {
      return;
    }

    await this.runInZone(async () => {
      this.busyAction = 'prepare';
      this.busyProgressPercent = 0;
      try {
        await this.resetWorkflowForNewEpub();
        this.multipleEpubDiagnoses = [];

        for (const [index, file] of files.entries()) {
          this.busyAction = 'prepare';
          await this.setBusyProgress((index / files.length) * 100);
          const prepared = await this.workflow.prepareFromFile(file);
          this.busyAction = 'diagnose';
          const diagnosis = await this.workflow.diagnose(
            prepared.sessionId,
            'deep',
          );

          if (
            diagnosis.status === 'unsupported' ||
            diagnosis.status === 'failed' ||
            diagnosis.status === 'limited'
          ) {
            throw new EpubRewriteError('EPUB_UNSUPPORTED');
          }

          this.multipleEpubDiagnoses.push({
            id: `${prepared.sessionId}:${index}`,
            sessionId: prepared.sessionId,
            file,
            selectedName: prepared.originalName,
            sourceSize: prepared.originalSize,
            diagnosis,
          });
          await this.flushUi();
        }

        this.diagnosis = this.aggregateMultipleDiagnosis();
        this.preparedSessionId = undefined;
        this.selectedEpubName = undefined;
        this.sourceEpubMeta = undefined;
        this.viewState = 'diagnosed';
        this.workflowStep = 2;
        this.clearEpubError();
        await this.setBusyProgress(100);
      } catch (error) {
        await this.cleanupMultipleEpubs();
        this.multipleEpubDiagnoses = [];
        this.diagnosis = undefined;
        this.failWorkflow('EPUB_ERROR_REWRITE', error);
      } finally {
        await this.clearBusyState();
      }
    });
  }

  hasValidEpub(): boolean {
    return (
      (this.fixMode === 'multiple'
        ? this.multipleEpubDiagnoses.length > 0
        : !!this.preparedSessionId) && !this.epubErrorKey
    );
  }

  formatFileSize(bytes?: number): string {
    if (!Number.isFinite(bytes as number) || !bytes) {
      return '';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes as number;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    const digits = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(value)} ${units[unitIndex]}`;
  }

  async runDiagnosis(): Promise<void> {
    if (!this.preparedSessionId || !this.canDiagnose) {
      return;
    }

    try {
      await this.performDiagnosis();
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      await this.clearBusyState();
    }
  }

  async runRepair(preferredOpfPath?: string): Promise<void> {
    if (this.fixMode === 'multiple') {
      await this.runMultipleRepair();
      return;
    }

    const guidedSelections = this.guidedRepairSelections;
    if (
      !this.preparedSessionId ||
      (!this.canRepair && !preferredOpfPath)
    ) {
      return;
    }

    this.busyAction = 'repair';
    this.viewState = 'repairing';
    try {
      this.clearEpubError();
      this.repairResult = undefined;
      this.exportResult = undefined;
      const canContinue = await this.requestRewardedAdForFix();
      if (!canContinue) {
        this.viewState = 'diagnosed';
        return;
      }

      this.repairResult = await this.workflow.repairCurrentEpub(
        this.diagnosis?.diagnosisId,
        preferredOpfPath,
        guidedSelections,
      );
      if (!this.repairResult.success) {
        this.workflowStep = 3;
        this.failWorkflow('EPUB_ERROR_REWRITE');
        return;
      }

      await this.exportCurrentCopy();
      this.viewState = 'repaired';
      this.workflowStep = 3;
    } catch (error) {
      this.workflowStep = 3;
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      await this.clearBusyState();
    }
  }

  async exportFixed(): Promise<void> {
    if (this.fixMode === 'multiple') {
      await this.exportMultipleFixed();
      return;
    }

    if (!this.preparedSessionId || !this.canExport) {
      return;
    }

    this.busyAction = 'export';
    try {
      await this.exportCurrentCopy();
      this.viewState = 'repaired';
      this.workflowStep = 3;
    } catch (error) {
      this.workflowStep = 3;
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      await this.clearBusyState();
    }
  }

  async onSave(): Promise<void> {
    if (!this.canSaveShare || !this.exportResult) {
      return;
    }

    const modal = await this.modalCtrl.create({
      component: SaveCoverModalComponent,
      componentProps: {
        initialFilename: this.exportResult.outputName.replace(/\.epub$/i, ''),
        title: this.translate.instant('FIX.SAVE_RENAME_TITLE'),
        message: this.translate.instant('FIX.SAVE_RENAME_MESSAGE'),
        placeholder: this.translate.instant('FIX.SAVE_RENAME_PLACEHOLDER'),
        cancelText: this.translate.instant('COMMON.CANCEL'),
        confirmText: this.translate.instant('COMMON.DONE'),
      },
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 1],
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || typeof data !== 'string') {
      return;
    }

    await this.performSave(data.trim());
  }

  async onShare(): Promise<void> {
    if (!this.canSaveShare || !this.exportResult) {
      return;
    }

    await this.library.shareByFilename(this.exportResult.outputName);
  }

  async onHeaderItemClick(id: string): Promise<void> {
    await handleHomeHeaderAction(id, {
      closeInfo: () => this.closeInfo(),
      toggleInfo: () => this.toggleInfo(),
      navigateToRecommended: async () => {
        await this.router.navigateByUrl('/recommended-apps');
      },
      resetFlow: () => this.resetFlow(),
    });
  }

  async resetFlow(): Promise<void> {
    if (this.isResettingFlow) return;
    if (!(await this.editorSessionExit.confirmResetFlow())) return;
    this.runInZone(() => {
      this.isResettingFlow = true;
      this.changeDetector.detectChanges();
    });
    await this.runInZone(async () => {
      try {
        this.busyAction = undefined;
        this.busyProgressPercent = 0;
        await this.resetWorkflowForNewEpub(true, true);
        if (this.epubInput?.nativeElement) {
          this.epubInput.nativeElement.value = '';
        }
      } finally {
        this.isResettingFlow = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  async onOperationDone(): Promise<void> {
    if (this.isResettingFlow) return;
    this.runInZone(() => {
      this.isResettingFlow = true;
      this.changeDetector.detectChanges();
    });
    await this.runInZone(async () => {
      try {
        this.busyAction = undefined;
        this.busyProgressPercent = 0;
        await this.resetWorkflowForNewEpub(true, true);
        if (this.epubInput?.nativeElement) {
          this.epubInput.nativeElement.value = '';
        }
        await this.router.navigateByUrl('/tabs/my-epubs');
      } finally {
        this.isResettingFlow = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  async openPurchaseModal(): Promise<void> {
    this.logPurchaseUiState('open-before-guard');
    if (!this.canShowRemoveAdsEntryPoint() || this.purchaseBusy) {
      return;
    }
    this.removeAdsPurchasePage.open({
      variant: 'EF',
      returnUrl: '/tabs/fix-page',
    });
    await this.router.navigateByUrl('/remove-ads');
  }

  closePurchaseModal(): void {
    this.runInZone(() => {
      this.purchaseModalOpen = false;
    });
  }

  onPurchaseModalCloseClick(): void {
    this.closePurchaseModal();
  }

  async onPurchaseRemoveAds(): Promise<void> {
    if (!this.canPurchaseRemoveAds()) {
      return;
    }

    this.runInZone(() => {
      this.purchaseBusy = true;
    });
    await this.flushUi();
    try {
      const success = await this.billing.purchaseRemoveAds();
      if (!success) {
        return;
      }

      this.runInZone(() => {
        this.closePurchaseModal();
      });
      await this.showToast(
        'COMMON.REMOVE_ADS_PURCHASED',
        { duration: 1800 },
        'success',
      );
    } catch {
      await this.showToast('COMMON.PURCHASE_ERROR', { duration: 1800 }, 'error');
    } finally {
      this.runInZone(() => {
        this.purchaseBusy = false;
      });
      await this.flushUi();
    }
  }

  async onRestorePurchases(): Promise<void> {
    if (!this.canRestoreRemoveAds()) {
      return;
    }

    this.runInZone(() => {
      this.purchaseBusy = true;
    });
    await this.flushUi();
    try {
      const restored = await this.billing.restorePurchases();
      if (!restored) {
        await this.showToast('COMMON.RESTORE_ERROR', { duration: 1800 }, 'error');
        return;
      }

      this.runInZone(() => {
        this.closePurchaseModal();
      });
      await this.showToast(
        'COMMON.REMOVE_ADS_RESTORED',
        { duration: 1800 },
        'success',
      );
    } catch {
      await this.showToast('COMMON.RESTORE_ERROR', { duration: 1800 }, 'error');
    } finally {
      this.runInZone(() => {
        this.purchaseBusy = false;
      });
      await this.flushUi();
    }
  }

  openInfo(): void {
    this.infoEvent = null;
    this.infoOpen = true;
  }

  issueRepairMode(issue: EpubDiagnosticIssue): EpubDiagnosticRepairMode {
    return issue.repairMode ?? classifyEpubDiagnosticRepairMode(issue);
  }

  issueRepairModeLabelKey(issue: EpubDiagnosticIssue): string {
    switch (this.issueRepairMode(issue)) {
      case 'automatic':
        return 'FIX.REPAIR_MODE_AUTOMATIC';
      case 'review':
        return 'FIX.REPAIR_MODE_REVIEW';
      case 'guided':
        return 'FIX.REPAIR_MODE_GUIDED';
      case 'not_repairable':
        return 'FIX.REPAIR_MODE_BLOCKED';
    }

    return 'FIX.REPAIR_MODE_BLOCKED';
  }

  issueRepairModeBadgeColor(issue: EpubDiagnosticIssue): string {
    switch (this.issueRepairMode(issue)) {
      case 'automatic':
        return 'success';
      case 'review':
        return 'warning';
      case 'guided':
        return 'tertiary';
      case 'not_repairable':
        return 'danger';
    }

    return 'danger';
  }

  issueSeverityLevel(issue: EpubDiagnosticIssue): DiagnosisSeverityLevel {
    const matrixCase = this.repairing?.resolveDiagnosticCases(issue)[0];
    if (matrixCase) {
      return matrixCase.severity;
    }

    const repairMode = this.issueRepairMode(issue);
    if (repairMode === 'not_repairable') {
      return 'critical';
    }

    if (repairMode === 'guided') {
      return issue.severity === 'error' ? 'critical' : 'high';
    }

    if (issue.severity === 'error') {
      return 'high';
    }

    if (issue.severity === 'warning') {
      return 'medium';
    }

    return 'low';
  }

  diagnosisSeverityLabelKey(level: DiagnosisSeverityLevel): string {
    switch (level) {
      case 'critical':
        return 'FIX.DIAGNOSIS_SEVERITY_CRITICAL';
      case 'high':
        return 'FIX.DIAGNOSIS_SEVERITY_HIGH';
      case 'medium':
        return 'FIX.DIAGNOSIS_SEVERITY_MEDIUM';
      case 'low':
        return 'FIX.DIAGNOSIS_SEVERITY_LOW';
    }
  }

  async onPrimaryAction(): Promise<void> {
    this.operationCompleted.set(false);
    if (this.canRepair) {
      await this.runRepair(this.guidedRepairPreferredOpfPath);
      return;
    }

    if (this.canExport) {
      await this.exportFixed();
    }
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

  private issuesByMode(...modes: EpubDiagnosticRepairMode[]): EpubDiagnosticIssue[] {
    return this.issuesByModeFrom(this.diagnosis?.issues ?? [], ...modes);
  }

  private issuesByModeFrom(
    issues: EpubDiagnosticIssue[],
    ...modes: EpubDiagnosticRepairMode[]
  ): EpubDiagnosticIssue[] {
    if (issues.length === 0) {
      return [];
    }

    const allowedModes = new Set(modes);
    const severityOrder: Record<DiagnosisSeverityLevel, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const modeOrder: Record<EpubDiagnosticRepairMode, number> = {
      automatic: 0,
      review: 1,
      guided: 2,
      not_repairable: 3,
    };

    return issues
      .filter((issue) => allowedModes.has(this.issueRepairMode(issue)))
      .sort((left, right) => {
        const severityDelta =
          severityOrder[this.issueSeverityLevel(left)] -
          severityOrder[this.issueSeverityLevel(right)];
        if (severityDelta !== 0) {
          return severityDelta;
        }

        const leftModeDelta = modeOrder[this.issueRepairMode(left)];
        const rightModeDelta = modeOrder[this.issueRepairMode(right)];
        const modeDelta = leftModeDelta - rightModeDelta;
        if (modeDelta !== 0) {
          return modeDelta;
        }

        return left.messageKey.localeCompare(right.messageKey);
      });
  }

  private async tryOpenProjectFromRoute(): Promise<void> {
    const project = this.route.snapshot.queryParamMap.get('project')?.trim();
    if (!project || project === this.lastHandledProjectRouteKey) {
      return;
    }

    const loaded = await this.openSavedProjectByFilename(project);
    if (loaded) {
      this.lastHandledProjectRouteKey = project;
    }
  }

  private async openSavedProjectByFilename(filename: string): Promise<boolean> {
    const project: LoadedGeneratedEpub | null =
      await this.library.loadGeneratedEpubByFilename(filename);
    if (!project) {
      this.failEpub('EPUB_ERROR_CORRUPT', { name: filename });
      return false;
    }

    return this.runInZone(async () => {
      this.busyAction = 'prepare';
      this.busyProgressPercent = 0;

      try {
        this.recoveryEpubFile = project.file;
        await this.resetWorkflowForNewEpub();
        await this.setBusyProgress(12);

        if (this.workflow.usesNativePicker() && !project.uri) {
          throw new Error('Missing native EPUB URI for project load.');
        }

        const prepared = this.workflow.usesNativePicker()
          ? await this.workflow.prepareFromUri(project.uri!, project.file.name)
          : await this.workflow.prepareFromFile(project.file);

        await this.setBusyProgress(48);
        this.preparedSessionId = prepared.sessionId;
        this.selectedEpubName = project.file.name;
        this.sourceEpubMeta = {
          name: prepared.originalName,
          size: project.size,
          lastModified: Date.now(),
          type: 'application/epub+zip',
        };
        this.viewState = 'prepared';
        this.clearEpubError();

        const diagnosisSucceeded = await this.performDiagnosis();
        if (!diagnosisSucceeded) {
          await this.cleanupPreparedEpub();
          return false;
        }

        return true;
      } catch (error) {
        this.failEpub(
          this.mapPrepareError(error),
          { name: filename },
          this.buildNativeStorageErrorParams(error),
        );
        await this.cleanupPreparedEpub();
        return false;
      } finally {
        await this.clearBusyState();
      }
    });
  }

  private async requestRewardedAdForFix(): Promise<boolean> {
    try {
      const access = await this.exportAccess.authorize({
        onActiveFallbackTrial: () =>
          this.adFallbackTrialActive && this.resolveAdFallbackRemaining() > 0
            ? this.confirmActiveAdFallbackTrial()
            : false,
        onAdFailure: (result) => this.openAdFallbackFromFailure(result),
      });
      if (access.granted) {
        return true;
      }
    } catch (error) {
      console.warn('[epub-fixer] rewarded ad gate failed', error);
    }

    this.epubErrorKey = 'FIX.ADS_REQUIRED';
    this.epubErrorParams = {};
    return false;
  }

  private async openAdFallbackFromFailure(
    result: {
      rewardEarned: boolean;
      adClosed: boolean;
      failed: boolean;
      failureReason?: AdFailureReason;
      failureConfidence?: AdFailureConfidence;
    },
  ): Promise<boolean> {
    const remaining = this.resolveAdFallbackRemaining();
    const decision = await this.adFallback.handleAdFailure(
      {
        app: this.adFallbackApp,
        reason: this.normalizeFailureReason(result.failureReason),
        confidence: this.normalizeFailureConfidence(result.failureConfidence),
        remaining,
        total: this.adFallbackTotal,
        countdownSeconds: 5,
      },
      this.modalCtrl,
    );

    if (decision === 'accepted') {
      this.adFallbackTrialActive = true;
      await this.persistAdFallbackState();
      return true;
    }

    return false;
  }

  private async confirmActiveAdFallbackTrial(): Promise<boolean> {
    const remaining = this.resolveAdFallbackRemaining();
    const decision = await this.adFallback.handleAdFailure(
      {
        app: this.adFallbackApp,
        reason: 'unknown',
        confidence: 'low',
        remaining,
        total: this.adFallbackTotal,
        countdownSeconds: 5,
      },
      this.modalCtrl,
    );

    return decision === 'accepted';
  }

  private resolveAdFallbackRemaining(): number {
    return this.adFallbackRemaining;
  }

  private hydrateAdFallbackState(
    preferences: Record<string, unknown> | undefined,
  ): void {
    const rawRemaining = preferences?.[this.adFallbackRemainingPrefKey];
    const parsedRemaining =
      typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)
        ? Math.floor(rawRemaining)
        : this.adFallbackTotal;
    this.adFallbackRemaining = Math.max(
      0,
      Math.min(this.adFallbackTotal, parsedRemaining),
    );

    const rawActive = preferences?.[this.adFallbackTrialActivePrefKey];
    this.adFallbackTrialActive =
      rawActive === true && this.adFallbackRemaining > 0;
  }

  private async persistAdFallbackState(): Promise<void> {
    const clampedRemaining = Math.max(
      0,
      Math.min(this.adFallbackTotal, Math.floor(this.adFallbackRemaining)),
    );
    this.adFallbackRemaining = clampedRemaining;
    const active = this.adFallbackTrialActive && clampedRemaining > 0;
    this.adFallbackTrialActive = active;

    await this.settings.set((prev) => ({
      ...prev,
      preferences: {
        ...(prev.preferences ?? {}),
        [this.adFallbackRemainingPrefKey]: clampedRemaining,
        [this.adFallbackTrialActivePrefKey]: active,
      },
    }));
  }

  private async consumeAdFallbackAttemptAfterSuccess(): Promise<void> {
    if (!this.adFallbackTrialActive) {
      return;
    }

    const remaining = this.resolveAdFallbackRemaining();
    if (remaining <= 0) {
      this.adFallbackTrialActive = false;
      await this.persistAdFallbackState();
      return;
    }

    this.adFallbackRemaining = remaining - 1;
    this.adFallbackTrialActive = false;
    await this.persistAdFallbackState();
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

  private normalizeFailureConfidence(
    value: unknown,
  ): AdFailureConfidence {
    return value === 'high' ? 'high' : 'low';
  }

  private normalizeIssueMessageKey(
    issue: Pick<EpubDiagnosticIssue, 'code' | 'messageKey'>,
  ): string {
    if (!issue.messageKey.startsWith('FIX.ISSUE_')) {
      return issue.messageKey;
    }

    return `FIX.ISSUE_${issue.code.replace(/-/g, '_')}`;
  }

  private async exportCurrentCopy(): Promise<void> {
    if (!this.preparedSessionId) {
      return;
    }

    await this.runInZone(async () => {
      const previousBusyAction = this.busyAction;
      this.busyAction = 'export';
      try {
        this.exportResult = undefined;
        await this.setBusyProgress(12);
        const outputName =
          this.workflow.buildFixedOutputName(this.selectedEpubName);
        const exported = await this.workflow.exportCurrentEpub(outputName);
        await this.setBusyProgress(48);
        await this.library.saveExportedEpub(exported.outputUri, outputName);
        await this.setBusyProgress(72);
        const preview = await this.library.resolvePreviewAsset(outputName, {
          forceRefresh: true,
        });
        await this.setBusyProgress(90);
        this.coversEvents.emit({ type: 'saved', filename: outputName });

        this.exportResult = {
          size: exported.size,
          outputName,
          outputUri: exported.outputUri,
          ...(preview.src ? { previewSrc: preview.src } : {}),
        };
        this.operationCompleted.set(true);
        this.clearEpubError();
        await this.consumeAdFallbackAttemptAfterSuccess();
        await this.setBusyProgress(100);
      } finally {
        this.busyAction = previousBusyAction;
      }
    });
  }

  private async performSave(filename: string): Promise<void> {
    if (!this.exportResult) {
      return;
    }

    const resolvedFilename = this.ensureEpubExtension(filename);
    const previousBusyAction = this.busyAction;
    this.busyAction = 'export';

    try {
      await this.setBusyProgress(12);
      const previousFilename = this.exportResult.outputName;
      await this.library.saveExportedEpub(
        this.exportResult.outputUri,
        resolvedFilename,
      );
      await this.setBusyProgress(72);

      if (
        previousFilename &&
        previousFilename.toLowerCase() !== resolvedFilename.toLowerCase()
      ) {
        try {
          await this.library.deleteByFilename(previousFilename);
        } catch {
          // Best effort cleanup.
        }
      }

      this.exportResult = {
        ...this.exportResult,
        outputName: resolvedFilename,
      };
      this.coversEvents.emit({ type: 'saved', filename: resolvedFilename });
      this.clearEpubError();
      await this.setBusyProgress(100);
      await this.showToast('FIX.RENAMED_OK', { duration: 1600 }, 'success');
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      this.busyAction = previousBusyAction;
      this.runInZone(() => {
        this.changeDetector.markForCheck();
        this.changeDetector.detectChanges();
      });
    }
  }

  private async showToast(
    messageKey: string,
    opts: Partial<ToastOptions> = {},
    variant: 'success' | 'error' | 'info' = 'success',
    params?: Record<string, unknown>,
  ): Promise<void> {
    const extra = opts.cssClass
      ? Array.isArray(opts.cssClass)
        ? opts.cssClass
        : [opts.cssClass]
      : [];

    const toast = await this.toastCtrl.create({
      ...opts,
      message: this.translate.instant(messageKey, params),
      position: 'middle',
      duration: opts.duration ?? 1800,
      animated: true,
      translucent: true,
      cssClass: ['cc-toast', `cc-toast--${variant}`, ...extra],
    });
    await toast.present();
  }

  private ensureEpubExtension(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      return 'book_fixed.epub';
    }

    return /\.epub$/i.test(trimmed) ? trimmed : `${trimmed}.epub`;
  }

  private async refreshHeaderItems(): Promise<void> {
    const [recommendedApps, labels] = await Promise.all([
      this.recommendedAppsService.getRecommendedApps(),
      firstValueFrom(
        this.translate.get([
          'ARR.TOOLS.APPS',
          'ARR.TOOLS.GUIDE',
        ]),
      ),
    ]);

    this.recommendedApps = recommendedApps;
    this.showRecommended = recommendedApps.length > 0;
    this.headerItems = buildHomeHeaderItems(this.showRecommended, {
      appsLabel: labels['ARR.TOOLS.APPS'],
      resetLabel: this.translate.instant('UI_THEME.RESET'),
      includeGuide: false,
    });
  }

  private async pickNativeEpub(): Promise<void> {
    await this.runInZone(async () => {
      this.busyAction = 'prepare';
      this.busyProgressPercent = 0;

      try {
        await this.resetWorkflowForNewEpub();
        await this.setBusyProgress(12);
        const prepared = await this.workflow.pickAndPrepareNative();
        await this.applyPreparedNativeEpub(prepared);
      } catch (error) {
        if (
          error instanceof EpubRewriteError &&
          error.code === 'PICK_CANCELLED'
        ) {
          return;
        }

        this.failEpub(
          this.mapPrepareError(error),
          this.sourceEpubMeta,
          this.buildNativeStorageErrorParams(error),
        );
        await this.cleanupPreparedEpub();
      } finally {
        await this.clearBusyState();
      }
    });
  }

  private async pickNativeEpubs(): Promise<void> {
    await this.runInZone(async () => {
      this.busyAction = 'prepare';
      this.busyProgressPercent = 0;

      try {
        await this.resetWorkflowForNewEpub();
        const preparedItems = await this.workflow.pickAndPrepareNativeMultiple();
        for (const [index, prepared] of preparedItems.entries()) {
          this.busyAction = 'diagnose';
          await this.setBusyProgress((index / preparedItems.length) * 100);
          const diagnosis = await this.workflow.diagnose(
            prepared.sessionId,
            'deep',
          );
          if (
            diagnosis.status === 'unsupported' ||
            diagnosis.status === 'failed' ||
            diagnosis.status === 'limited'
          ) {
            throw new EpubRewriteError('EPUB_UNSUPPORTED');
          }

          this.multipleEpubDiagnoses.push({
            id: `${prepared.sessionId}:${index}`,
            sessionId: prepared.sessionId,
            file: prepared.file ?? null,
            selectedName: prepared.originalName,
            sourceSize: prepared.originalSize,
            diagnosis,
          });
          await this.flushUi();
        }

        this.diagnosis = this.aggregateMultipleDiagnosis();
        this.viewState = 'diagnosed';
        this.workflowStep = 2;
        this.clearEpubError();
        await this.setBusyProgress(100);
      } catch (error) {
        await this.cleanupMultipleEpubs();
        this.diagnosis = undefined;
        this.failWorkflow('EPUB_ERROR_REWRITE', error);
      } finally {
        await this.clearBusyState();
      }
    });
  }

  private async applyPreparedNativeEpub(
    prepared: Awaited<ReturnType<EpubFixerWorkflowService['pickAndPrepareNative']>>,
  ): Promise<void> {
    await this.setBusyProgress(48);

    this.preparedSessionId = prepared.sessionId;
    this.selectedEpubName = prepared.originalName;
    this.sourceEpubMeta = {
      name: prepared.originalName,
      size: prepared.originalSize,
      lastModified: Date.now(),
      type: 'application/epub+zip',
    };
    this.viewState = 'prepared';
    this.clearEpubError();

    const diagnosisSucceeded = await this.performDiagnosis();
    if (!diagnosisSucceeded) {
      await this.cleanupPreparedEpub();
    }
  }

  private aggregateMultipleDiagnosis(): EpubDiagnosticResult {
    const issues = this.multipleEpubDiagnoses.flatMap((item) =>
      item.diagnosis.issues.map((issue) => ({
        ...issue,
        sourceId: item.id,
        sourceName: item.selectedName,
      })),
    );
    const hasRepairableFile = this.multipleEpubDiagnoses.some(
      (item) => item.diagnosis.status === 'repairable',
    );

    return {
      sessionId: this.multipleEpubDiagnoses[0]?.sessionId ?? '',
      status: hasRepairableFile ? 'repairable' : 'valid',
      issues,
    };
  }

  private async cleanupMultipleEpubs(): Promise<void> {
    const sessionIds = this.multipleEpubDiagnoses.map(
      (item) => item.sessionId,
    );
    this.multipleEpubDiagnoses = [];

    await Promise.all(
      sessionIds.map((sessionId) =>
        this.workflow.cleanup(sessionId).catch(() => undefined),
      ),
    );
    await this.workflow.cleanupCurrentEpub().catch(() => undefined);
  }

  private async resetWorkflowForNewEpub(
    waitForCleanup = true,
    resetMode = false,
  ): Promise<void> {
    const cleanupPromise = this.cleanupPreparedEpub();
    const multipleCleanupPromise = this.cleanupMultipleEpubs();
    this.runInZone(() => {
      this.operationCompleted.set(false);
      this.clearEpubError();
      this.lastHandledProjectRouteKey = null;
      if (resetMode) {
        this.fixMode = null;
      }
      this.selectedConfirmationByIssueKey = {};
      this.selectedGuidedOptionByIssueKey = {};
      this.expandedIssueGroupKeys?.clear();
      this.issueGroupVisibleCounts?.clear();
      this.issueGroupLoadingKeys?.clear();

      this.preparedSessionId = undefined;
      this.selectedEpubName = undefined;
      this.sourceEpubMeta = undefined;
      this.diagnosis = undefined;
      this.repairResult = undefined;
      this.exportResult = undefined;
      this.workflowStep = 0;
      this.viewState = 'idle';
    });
    if (waitForCleanup) {
      await cleanupPromise;
      await multipleCleanupPromise;
    } else {
      void cleanupPromise.catch(() => undefined);
      void multipleCleanupPromise.catch(() => undefined);
    }
    await this.recovery.clear();
  }

  private async cleanupPreparedEpub(): Promise<void> {
    const sessionId = this.preparedSessionId;
    this.preparedSessionId = undefined;

    if (sessionId) {
      try {
        await this.workflow.cleanup(sessionId);
      } catch {
        // Best-effort cleanup.
      }
      return;
    }

    try {
      await this.workflow.cleanupCurrentEpub();
    } catch {
      // Best-effort cleanup.
    }
  }

  private failEpub(
    errorKey: string,
    file?: { name?: string },
    extraParams: Record<string, unknown> = {},
  ): void {
    this.runInZone(() => {
      this.epubErrorKey = `FIX.${errorKey}`;
      this.epubErrorParams = {
        maxSize: String(this.workflow.maxNativeSizeMB),
        name: file?.name || '',
        ...extraParams,
      };
      this.preparedSessionId = undefined;
      this.sourceEpubMeta = undefined;
      this.selectedEpubName = undefined;
      this.diagnosis = undefined;
      this.repairResult = undefined;
      this.exportResult = undefined;
      this.selectedGuidedOptionByIssueKey = {};
      this.selectedConfirmationByIssueKey = {};
      this.workflowStep = 0;
      this.viewState = 'failed';
    });
  }

  private async performDiagnosis(): Promise<boolean> {
    if (!this.preparedSessionId) {
      return false;
    }

    return this.runInZone(async () => {
      this.busyAction = 'diagnose';
      await this.setBusyProgress(72);
      this.viewState = 'diagnosing';
      this.expandedIssueGroupKeys?.clear();
      this.issueGroupVisibleCounts?.clear();
      this.issueGroupLoadingKeys?.clear();
      this.repairResult = undefined;
      this.exportResult = undefined;

      try {
        this.diagnosis = await this.workflow.diagnoseCurrentEpub();
        this.viewState = 'diagnosed';
        this.workflowStep = 2;
        this.clearEpubError();
        await this.setBusyProgress(100);
        return true;
      } catch (error) {
        this.failWorkflow('EPUB_ERROR_REWRITE', error);
        return false;
      }
    });
  }

  private async runMultipleRepair(): Promise<void> {
    if (!this.canRepair) {
      return;
    }

    this.busyAction = 'repair';
    this.viewState = 'repairing';
    try {
      this.clearEpubError();
      const canContinue = await this.requestRewardedAdForFix();
      if (!canContinue) {
        this.viewState = 'diagnosed';
        return;
      }

      for (const item of this.multipleEpubDiagnoses) {
        if (item.diagnosis.status !== 'repairable') {
          continue;
        }

        const repairResult = await this.workflow.repair(
          item.sessionId,
          item.diagnosis.diagnosisId,
          this.guidedRepairPreferredOpfPathFor(item),
          this.guidedRepairSelectionsFor(item),
        );
        if (!repairResult.success) {
          throw new EpubRewriteError('EPUB_REPAIR_FAILED');
        }
        item.diagnosis = {
          ...item.diagnosis,
          status: 'valid',
        };
      }

      await this.exportMultipleSessions();
      this.viewState = 'repaired';
      this.workflowStep = 3;
    } catch (error) {
      this.workflowStep = 3;
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      await this.clearBusyState();
    }
  }

  private async exportMultipleFixed(): Promise<void> {
    if (!this.canExport) {
      return;
    }

    this.busyAction = 'export';
    try {
      this.clearEpubError();
      await this.exportMultipleSessions();
      this.viewState = 'repaired';
      this.workflowStep = 3;
    } catch (error) {
      this.workflowStep = 3;
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      await this.clearBusyState();
    }
  }

  private async exportMultipleSessions(): Promise<void> {
    let firstExport: FixPage['exportResult'] | undefined;

    for (const [index, item] of this.multipleEpubDiagnoses.entries()) {
      const outputName = this.buildMultipleOutputName(item.selectedName, index);
      const exported = await this.workflow.exportFixed(
        item.sessionId,
        outputName,
      );
      await this.library.saveExportedEpub(exported.outputUri, outputName);

      if (!firstExport) {
        const preview = await this.library.resolvePreviewAsset(outputName, {
          forceRefresh: true,
        });
        firstExport = {
          size: exported.size,
          outputName,
          outputUri: exported.outputUri,
          ...(preview.src ? { previewSrc: preview.src } : {}),
        };
      }

      this.coversEvents.emit({ type: 'saved', filename: outputName });
      await this.setBusyProgress(((index + 1) / this.multipleEpubDiagnoses.length) * 100);
    }

    this.exportResult = firstExport;
    this.operationCompleted.set(true);
    await this.consumeAdFallbackAttemptAfterSuccess();
  }

  private buildMultipleOutputName(selectedName: string, index: number): string {
    const outputName = this.workflow.buildFixedOutputName(selectedName);
    if (index === 0) {
      return outputName;
    }

    return outputName.replace(/\.epub$/i, `_${index + 1}.epub`);
  }

  private guidedRepairPreferredOpfPathFor(
    item: MultipleEpubDiagnosis,
  ): string | undefined {
    const issue = item.diagnosis.issues.find(
      (candidate) =>
        candidate.code === 'OPF_AMBIGUOUS' &&
        this.issueOptions(this.withMultipleSource(candidate, item)).length > 0,
    );
    return issue
      ? this.selectedGuidedOption(this.withMultipleSource(issue, item))
      : undefined;
  }

  private guidedRepairSelectionsFor(
    item: MultipleEpubDiagnosis,
  ): Record<string, string> | undefined {
    const selections: Record<string, string> = {};
    for (const issue of item.diagnosis.issues) {
      const contextualIssue = this.withMultipleSource(issue, item);
      if (this.issueRepairMode(contextualIssue) !== 'guided') {
        continue;
      }

      const selected = this.selectedGuidedOption(contextualIssue);
      if (selected) {
        selections[this.issueSelectionKey(contextualIssue)] = selected;
      }
    }
    return Object.keys(selections).length > 0 ? selections : undefined;
  }

  private withMultipleSource(
    issue: EpubDiagnosticIssue,
    item: MultipleEpubDiagnosis,
  ): EpubDiagnosticIssue {
    return {
      ...issue,
      sourceId: item.id,
      sourceName: item.selectedName,
    } as EpubDiagnosticIssue;
  }

  issueOptions(issue: EpubDiagnosticIssue): string[] {
    return (issue.options ?? []).map((option) => option.trim()).filter(Boolean);
  }

  issueSelectionKey(issue: EpubDiagnosticIssue): string {
    const key = buildEpubIssueSelectionKey({
      code: issue.code,
      details: issue.details,
      options: this.issueOptions(issue),
    });
    const sourceId = (issue as EpubDiagnosticIssue & { sourceId?: string })
      .sourceId;
    return sourceId ? `${sourceId}:${key}` : key;
  }

  issueMessageLabel(
    issue: Pick<EpubDiagnosticIssue, 'code' | 'messageKey'>,
  ): string {
    const normalizedKey = this.normalizeIssueMessageKey(issue);
    const normalizedLabel = this.translate.instant(normalizedKey);
    if (normalizedLabel !== normalizedKey) {
      return normalizedLabel;
    }

    return this.translate.instant(issue.messageKey);
  }

  issueDetailsLabel(issue: EpubDiagnosticIssue): string {
    const details = issue.details?.trim();
    const sourceName = (
      issue as EpubDiagnosticIssue & { sourceName?: string }
    ).sourceName;
    if (!details) {
      return sourceName ?? '';
    }

    let label: string;
    switch (details) {
      case 'container.xml is missing':
        label = this.translate.instant('FIX.ISSUE_DETAIL_CONTAINER_MISSING');
        break;
      case 'container.xml is not parseable':
        label = this.translate.instant(
          'FIX.ISSUE_DETAIL_CONTAINER_NOT_PARSEABLE',
        );
        break;
      case 'container.xml does not declare a rootfile':
        label = this.translate.instant('FIX.ISSUE_DETAIL_CONTAINER_NO_ROOTFILE');
        break;
      case 'Multiple package documents were found':
        label = this.translate.instant('FIX.ISSUE_DETAIL_OPF_AMBIGUOUS');
        break;
      case 'No valid spine entries remain':
        label = this.translate.instant('FIX.ISSUE_DETAIL_SPINE_EMPTY');
        break;
      case 'missing idref':
        label = this.translate.instant('FIX.ISSUE_DETAIL_MISSING_IDREF');
        break;
      default: {
        const notParseableMatch = details.match(/^(.*) is not parseable$/);
        label = notParseableMatch
          ? this.translate.instant('FIX.ISSUE_DETAIL_FILE_NOT_PARSEABLE', {
              path: notParseableMatch[1],
            })
          : details;
      }
    }

    return sourceName ? `${sourceName} · ${label}` : label;
  }

  selectedGuidedOption(issue: EpubDiagnosticIssue): string | undefined {
    const options = this.issueOptions(issue);
    const selected = (this.selectedGuidedOptionByIssueKey ?? {})[
      this.issueSelectionKey(issue)
    ];

    if (selected && options.includes(selected)) {
      return selected;
    }

    if (options.length === 1) {
      return options[0];
    }

    return undefined;
  }

  onGuidedOptionChange(
    issue: EpubDiagnosticIssue,
    value?: string | null,
  ): void {
    const key = this.issueSelectionKey(issue);
    if (!value || !value.trim()) {
      if (this.selectedGuidedOptionByIssueKey) {
        delete this.selectedGuidedOptionByIssueKey[key];
      }
      return;
    }

    this.selectedGuidedOptionByIssueKey ??= {};
    this.selectedGuidedOptionByIssueKey[key] = value;
  }

  isConfirmationChecked(issue: EpubDiagnosticIssue): boolean {
    return (
      (this.selectedConfirmationByIssueKey ?? {})[this.issueSelectionKey(issue)] ??
      false
    );
  }

  onConfirmationChange(
    issue: EpubDiagnosticIssue,
    checked?: boolean | null,
  ): void {
    const key = this.issueSelectionKey(issue);
    if (!checked) {
      if (this.selectedConfirmationByIssueKey) {
        delete this.selectedConfirmationByIssueKey[key];
      }
      return;
    }

    this.selectedConfirmationByIssueKey ??= {};
    this.selectedConfirmationByIssueKey[key] = true;
  }

  toggleConfirmation(issue: EpubDiagnosticIssue): void {
    this.onConfirmationChange(issue, !this.isConfirmationChecked(issue));
  }

  areAllConfirmationsChecked(issues: EpubDiagnosticIssue[]): boolean {
    return (
      issues.length > 0 &&
      issues.every((issue) => this.isConfirmationChecked(issue))
    );
  }

  hasPartialConfirmations(issues: EpubDiagnosticIssue[]): boolean {
    const checkedCount = issues.filter((issue) =>
      this.isConfirmationChecked(issue),
    ).length;
    return checkedCount > 0 && checkedCount < issues.length;
  }

  onAllConfirmationsChange(
    issues: EpubDiagnosticIssue[],
    checked?: boolean | null,
  ): void {
    const shouldCheck = checked === true;
    for (const issue of issues) {
      this.onConfirmationChange(issue, shouldCheck);
    }
  }

  toggleAllConfirmations(issues: EpubDiagnosticIssue[]): void {
    this.onAllConfirmationsChange(
      issues,
      !this.areAllConfirmationsChecked(issues),
    );
  }

  private clearEpubError(): void {
    this.runInZone(() => {
      this.epubErrorKey = undefined;
      this.epubErrorParams = {};
    });
  }

  private usesNativePrepare(): boolean {
    return this.workflow.usesNativePicker();
  }

  private mapPrepareError(error: unknown): string {
    if (
      error instanceof EpubFixerPortError &&
      error.code === 'ZIP_UNREADABLE'
    ) {
      return 'EPUB_ERROR_CORRUPT';
    }
    if (error instanceof EpubRewriteError && error.code === 'EPUB_TOO_LARGE') {
      return 'EPUB_ERROR_SIZE';
    }
    if (error instanceof EpubRewriteError && error.code === 'NO_SPACE') {
      return 'EPUB_ERROR_STORAGE';
    }
    return 'EPUB_ERROR_CORRUPT';
  }

  private failWorkflow(errorKey: string, error?: unknown): void {
    this.runInZone(() => {
      this.epubErrorKey = `FIX.${errorKey}`;
      this.epubErrorParams = {};
      this.viewState = 'failed';
    });
    if (error) {
      console.error('[epub-fixer] workflow action failed', error);
    }
  }

  private get guidedRepairPreferredOpfPath(): string | undefined {
    const guidedIssue = this.diagnosis?.issues.find(
      (issue) =>
        issue.code === 'OPF_AMBIGUOUS' && this.issueOptions(issue).length > 0,
    );

    return guidedIssue ? this.selectedGuidedOption(guidedIssue) : undefined;
  }

  private get guidedRepairSelections(): Record<string, string> | undefined {
    const selections: Record<string, string> = {};

    for (const issue of this.diagnosis?.issues ?? []) {
      if (this.issueRepairMode(issue) !== 'guided') {
        continue;
      }

      const selected = this.selectedGuidedOption(issue);
      if (!selected) {
        continue;
      }

      selections[this.issueSelectionKey(issue)] = selected;
    }

    return Object.keys(selections).length > 0 ? selections : undefined;
  }

  private get hasPendingGuidedSelection(): boolean {
    return (
      this.diagnosis?.issues.some((issue) => {
        if (this.issueRepairMode(issue) !== 'guided') {
          return false;
        }

        const options = this.issueOptions(issue);
        if (options.length <= 1) {
          return false;
        }

        return !this.selectedGuidedOption(issue);
      }) ?? false
    );
  }

  private get hasPendingConfirmationSelection(): boolean {
    return (
      this.diagnosis?.issues.some((issue) => {
        if (this.issueRepairMode(issue) !== 'review') {
          return false;
        }

        return !this.isConfirmationChecked(issue);
      }) ?? false
    );
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
