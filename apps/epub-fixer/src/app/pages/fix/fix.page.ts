import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AlertController,
  IonButtons,
  IonButton,
  IonBadge,
  IonCol,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonGrid,
  IonPopover,
  IonRow,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
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
  saveOutline,
  shareSocialOutline,
  sparklesOutline,
} from 'ionicons/icons';
import {
  classifyEpubDiagnosticRepairMode,
  EpubDiagnosticResult,
  type EpubDiagnosticRepairMode,
  type EpubDiagnosticIssue,
  EpubFixerPortError,
  EpubRewriteError,
  EpubRepairResult,
} from '@sheldrapps/file-kit';
import {
  AdsService,
  BillingService,
} from '@sheldrapps/ads-kit';
import {
  LoadingStateComponent,
  SectionCardComponent,
  SaveCoverModalComponent,
  ScrollableBarItem,
  ScrollableButtonBarComponent,
} from '@sheldrapps/ui-theme';
import {
  RecommendedApp,
  RecommendedAppsService,
  buildHomeHeaderItems,
  handleHomeHeaderAction,
} from '@sheldrapps/recommended-apps';
import { CoversEventsService } from '../../services/covers-events.service';

import { EpubFixerWorkflowService } from '../../services/epub-fixer-workflow.service';
import {
  EpubLibraryService,
  type LoadedGeneratedEpub,
} from '../../services/epub-library.service';

@Component({
  selector: 'app-fix-page',
  standalone: true,
  templateUrl: './fix.page.html',
  styleUrls: ['./fix.page.scss'],
  imports: [
    CommonModule,
    TranslateModule,
    IonBadge,
    IonButton,
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonButtons,
    IonIcon,
    IonItem,
    IonLabel,
    IonPopover,
    IonRow,
    IonTitle,
    IonToolbar,
    LoadingStateComponent,
    SectionCardComponent,
    ScrollableButtonBarComponent,
  ],
})
export class FixPage implements OnInit, OnDestroy {
  private readonly workflow = inject(EpubFixerWorkflowService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly library = inject(EpubLibraryService);
  private readonly ads = inject(AdsService);
  private readonly billing = inject(BillingService);
  private readonly coversEvents = inject(CoversEventsService);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('epubInput') epubInput!: ElementRef<HTMLInputElement>;

  constructor() {
    addIcons({
      alertCircleOutline,
      appsOutline,
      checkmarkCircle,
      documentOutline,
      helpCircleOutline,
      informationCircleOutline,
      saveOutline,
      shareSocialOutline,
      sparklesOutline,
    });
  }

  headerItems: ScrollableBarItem[] = [];
  recommendedApps: RecommendedApp[] = [];
  showRecommended = false;

  preparedSessionId?: string;
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
  };

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
  busyAction?: 'prepare' | 'diagnose' | 'repair' | 'export';
  busyProgressPercent = 0;
  adsRemoved = false;
  private adsRemovedSub?: Subscription;
  private lastHandledProjectRouteKey: string | null = null;

  infoOpen = false;
  infoEvent: Event | null = null;

  get isBusy(): boolean {
    return !!this.busyAction;
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
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.viewState === 'prepared'
    );
  }

  get canRepair(): boolean {
    return (
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.viewState === 'diagnosed' &&
      this.diagnosis?.status === 'repairable' &&
      !this.hasGuidedResolutionIssue
    );
  }

  get canResolve(): boolean {
    return (
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.viewState === 'diagnosed' &&
      this.hasGuidedResolutionIssue
    );
  }

  get canExport(): boolean {
    return (
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.viewState === 'diagnosed' &&
      this.diagnosis?.status === 'valid'
    );
  }

  get canSaveShare(): boolean {
    return !!this.preparedSessionId && !this.isBusy && !!this.exportResult;
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
      this.hasValidEpub() &&
      !!this.diagnosis &&
      this.diagnosis.issues.length > 0
    );
  }

  get showDiagnosisOverview(): boolean {
    return this.hasValidEpub() && !!this.diagnosis;
  }

  get diagnosisSummary(): {
    totalIssues: number;
    automaticIssues: number;
    reviewIssues: number;
    guidedIssues: number;
    partialIssues: number;
    blockedIssues: number;
  } {
    const issues = this.diagnosis?.issues ?? [];
    const summary = {
      automaticIssues: 0,
      reviewIssues: 0,
      guidedIssues: 0,
      partialIssues: 0,
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
        case 'partial_recovery':
          summary.partialIssues += 1;
          break;
        case 'not_repairable':
          summary.blockedIssues += 1;
          break;
      }
    }

    return {
      totalIssues: issues.length,
      ...summary,
    };
  }

  get diagnosisOverviewKey(): string | null {
    if (!this.diagnosis) {
      return null;
    }

    const {
      totalIssues,
      automaticIssues,
      reviewIssues,
      guidedIssues,
      partialIssues,
      blockedIssues,
    } = this.diagnosisSummary;

    if (this.diagnosis.status === 'valid' || totalIssues === 0) {
      return 'FIX.DIAGNOSIS_STATUS_READY';
    }

    if (
      this.diagnosis.status === 'failed' ||
      this.diagnosis.status === 'unsupported' ||
      blockedIssues > 0
    ) {
      return 'FIX.DIAGNOSIS_STATUS_CRITICAL';
    }

    if (guidedIssues > 0) {
      return 'FIX.DIAGNOSIS_STATUS_GUIDED';
    }

    if (partialIssues > 0) {
      return 'FIX.DIAGNOSIS_STATUS_PARTIAL';
    }

    if (reviewIssues > 0) {
      return 'FIX.DIAGNOSIS_STATUS_REVIEW';
    }

    if (automaticIssues > 0) {
      return 'FIX.DIAGNOSIS_STATUS_REPAIRABLE';
    }

    return 'FIX.DIAGNOSIS_STATUS_CRITICAL';
  }

  get hasGuidedResolutionIssue(): boolean {
    return (
      this.diagnosis?.issues.some(
        (issue) => this.issueRepairMode(issue) === 'guided',
      ) ?? false
    );
  }

  get guidedResolutionIssue(): EpubDiagnosticIssue | undefined {
    return this.diagnosis?.issues.find(
      (issue) => this.issueRepairMode(issue) === 'guided',
    );
  }

  get resultPrimaryActionKey(): string | null {
    if (this.canResolve) {
      return 'FIX.ACTION_RESOLVE';
    }
    if (this.canRepair && !this.exportResult) {
      return 'FIX.ACTION_REPAIR';
    }
    if (this.canExport && !this.exportResult) {
      return 'FIX.ACTION_EXPORT';
    }
    return null;
  }

  async ngOnInit(): Promise<void> {
    await this.refreshHeaderItems();
    await this.billing.hydrateCachedState();
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe((value) => {
      this.adsRemoved = value;
    });
    this.adsRemoved = this.billing.isAdsRemoved();
  }

  ngOnDestroy(): void {
    this.closeInfo();
    this.adsRemovedSub?.unsubscribe();
    void this.cleanupPreparedEpub();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.refreshHeaderItems();
    await this.tryOpenProjectFromRoute();
  }

  ionViewWillLeave(): void {
    this.closeInfo();
  }

  openEpubPicker(): void {
    if (this.usesNativePrepare()) {
      void this.pickNativeEpub();
      return;
    }
    this.epubInput.nativeElement.click();
  }

  async onEpubSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.busyAction = 'prepare';
    this.busyProgressPercent = 0;
    try {
      await this.resetWorkflowForNewEpub();
      this.busyProgressPercent = 12;
      const prepared = await this.workflow.prepareFromFile(file);
      this.busyProgressPercent = 48;

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
      this.busyAction = undefined;
      this.busyProgressPercent = 0;
      input.value = '';
    }
  }

  hasValidEpub(): boolean {
    return !!this.preparedSessionId && !this.epubErrorKey;
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
      this.busyAction = undefined;
      this.busyProgressPercent = 0;
    }
  }

  async runRepair(preferredOpfPath?: string): Promise<void> {
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
        preferredOpfPath,
      );
      if (!this.repairResult.success) {
        this.failWorkflow('EPUB_ERROR_REWRITE');
      } else {
        this.clearEpubError();
        this.diagnosis = await this.workflow.diagnoseCurrentEpub();
        await this.exportCurrentCopy();
        this.viewState = 'repaired';
        await this.showToast('FIX.EPUB_FIXED_SUCCESS');
      }
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      this.busyAction = undefined;
      this.busyProgressPercent = 0;
    }
  }

  async exportFixed(): Promise<void> {
    if (!this.preparedSessionId || !this.canExport) {
      return;
    }

    this.busyAction = 'export';
    try {
      await this.exportCurrentCopy();
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      this.busyAction = undefined;
      this.busyProgressPercent = 0;
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
    });
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
      case 'partial_recovery':
        return 'FIX.REPAIR_MODE_PARTIAL';
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
      case 'partial_recovery':
        return 'medium';
      case 'not_repairable':
        return 'danger';
    }

    return 'danger';
  }

  async onPrimaryAction(): Promise<void> {
    if (this.canResolve) {
      await this.resolveGuidedRepair();
      return;
    }

    if (this.canRepair) {
      await this.runRepair();
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

  private async resolveGuidedRepair(): Promise<void> {
    const issue = this.guidedResolutionIssue;
    const options = issue?.options?.filter((option) => !!option.trim()) ?? [];
    if (!issue || options.length === 0) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: this.translate.instant('FIX.RESOLVE_OPF_TITLE'),
      message: this.translate.instant('FIX.RESOLVE_OPF_MESSAGE'),
      inputs: options.map((option, index) => ({
        type: 'radio',
        label: option,
        value: option,
        checked: index === 0,
      })),
      buttons: [
        {
          text: this.translate.instant('COMMON.CANCEL'),
          role: 'cancel',
        },
        {
          text: this.translate.instant('FIX.RESOLVE_OPF_CONFIRM'),
          role: 'confirm',
        },
      ],
    });

    await alert.present();
    const { data, role } = await alert.onDidDismiss<string>();
    if (role !== 'confirm' || typeof data !== 'string') {
      return;
    }

    await this.runRepair(data);
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

    this.busyAction = 'prepare';
    this.busyProgressPercent = 0;

    try {
      await this.resetWorkflowForNewEpub();
      this.busyProgressPercent = 12;

      if (this.workflow.usesNativePicker() && !project.uri) {
        throw new Error('Missing native EPUB URI for project load.');
      }

      const prepared = this.workflow.usesNativePicker()
        ? await this.workflow.prepareFromUri(project.uri!, project.file.name)
        : await this.workflow.prepareFromFile(project.file);

      this.busyProgressPercent = 48;
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
      this.busyAction = undefined;
      this.busyProgressPercent = 0;
    }
  }

  private async requestRewardedAdForFix(): Promise<boolean> {
    if (this.adsRemoved) {
      return true;
    }

    try {
      const result = await this.ads.showRewarded();
      if (result.rewardEarned) {
        return true;
      }
    } catch (error) {
      console.warn('[epub-fixer] rewarded ad gate failed', error);
    }

    this.epubErrorKey = 'FIX.ADS_REQUIRED';
    this.epubErrorParams = {};
    return false;
  }

  private async exportCurrentCopy(): Promise<void> {
    if (!this.preparedSessionId) {
      return;
    }

    const previousBusyAction = this.busyAction;
    this.busyAction = 'export';
    try {
      this.exportResult = undefined;
      const outputName =
        this.workflow.buildFixedOutputName(this.selectedEpubName);
      const exported = await this.workflow.exportCurrentEpub(outputName);
      try {
        await this.library.saveExportedEpub(exported.outputUri, outputName);
        this.coversEvents.emit({ type: 'saved', filename: outputName });
      } catch (saveError) {
        console.warn('[epub-fixer] save exported epub failed', saveError);
      }

      this.exportResult = {
        size: exported.size,
        outputName,
        outputUri: exported.outputUri,
      };
      this.clearEpubError();
    } finally {
      this.busyAction = previousBusyAction;
    }
  }

  private async performSave(filename: string): Promise<void> {
    if (!this.exportResult) {
      return;
    }

    const resolvedFilename = this.ensureEpubExtension(filename);
    const previousBusyAction = this.busyAction;
    this.busyAction = 'export';

    try {
      const previousFilename = this.exportResult.outputName;
      await this.library.saveExportedEpub(
        this.exportResult.outputUri,
        resolvedFilename,
      );

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
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      this.busyAction = previousBusyAction;
    }
  }

  private async showToast(messageKey: string, duration = 1600): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration,
      position: 'middle',
      cssClass: ['cc-toast', 'cc-toast--success'],
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
    this.recommendedApps = await this.recommendedAppsService.getRecommendedApps();
    this.showRecommended = this.recommendedApps.length > 0;
    this.headerItems = buildHomeHeaderItems(this.showRecommended, {
      appsLabel: this.translate.instant('ARR.TOOLS.APPS'),
      guideLabel: this.translate.instant('ARR.TOOLS.GUIDE'),
    });
  }

  private async pickNativeEpub(): Promise<void> {
    this.busyAction = 'prepare';
    this.busyProgressPercent = 0;

    try {
      await this.resetWorkflowForNewEpub();
      this.busyProgressPercent = 12;
      const prepared = await this.workflow.pickAndPrepareNative();
      this.busyProgressPercent = 48;

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
        return;
      }
    } catch (error) {
      if (error instanceof EpubRewriteError && error.code === 'PICK_CANCELLED') {
        return;
      }

      this.failEpub(
        this.mapPrepareError(error),
        this.sourceEpubMeta,
        this.buildNativeStorageErrorParams(error),
      );
      await this.cleanupPreparedEpub();
    } finally {
      this.busyAction = undefined;
      this.busyProgressPercent = 0;
    }
  }

  private async resetWorkflowForNewEpub(): Promise<void> {
    await this.cleanupPreparedEpub();
    this.clearEpubError();
    this.lastHandledProjectRouteKey = null;

    this.preparedSessionId = undefined;
    this.selectedEpubName = undefined;
    this.sourceEpubMeta = undefined;
    this.diagnosis = undefined;
    this.repairResult = undefined;
    this.exportResult = undefined;
    this.viewState = 'idle';
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
    this.viewState = 'failed';
  }

  private async performDiagnosis(): Promise<boolean> {
    if (!this.preparedSessionId) {
      return false;
    }

    this.busyAction = 'diagnose';
    this.busyProgressPercent = 72;
    this.viewState = 'diagnosing';
    this.repairResult = undefined;
    this.exportResult = undefined;

    try {
      this.diagnosis = await this.workflow.diagnoseCurrentEpub();
      this.viewState = 'diagnosed';
      this.clearEpubError();
      this.busyProgressPercent = 100;
      return true;
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
      return false;
    }
  }

  private clearEpubError(): void {
    this.epubErrorKey = undefined;
    this.epubErrorParams = {};
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
    this.epubErrorKey = `FIX.${errorKey}`;
    this.epubErrorParams = {};
    this.viewState = 'failed';
    if (error) {
      console.error('[epub-fixer] workflow action failed', error);
    }
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
