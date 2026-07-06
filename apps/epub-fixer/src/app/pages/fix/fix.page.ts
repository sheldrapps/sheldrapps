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
  IonModal,
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
  appsOutline,
  documentOutline,
  helpCircleOutline,
  saveOutline,
  shareSocialOutline,
  sparklesOutline,
} from 'ionicons/icons';
import {
  buildEpubIssueSelectionKey,
  classifyEpubDiagnosticRepairMode,
  EpubDiagnosticResult,
  type EpubDiagnosticRepairMode,
  type EpubDiagnosticIssue,
  EpubFixerPortError,
  EpubRewriteError,
  EpubRepairResult,
} from '@sheldrapps/file-kit';
import {
  AdFallbackService,
  type AdFailureConfidence,
  type AdFailureReason,
} from '@sheldrapps/ad-fallback-kit';
import {
  AdsService,
  BillingService,
  RemoveAdsUpgradeModalComponent,
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
import { SettingsStore } from '@sheldrapps/settings-kit';
import { CoversEventsService } from '../../services/covers-events.service';

import { EpubFixerWorkflowService } from '../../services/epub-fixer-workflow.service';
import {
  EpubLibraryService,
  type LoadedGeneratedEpub,
} from '../../services/epub-library.service';
import { EpubFixerSettings } from '../../settings/epub-fixer-settings.schema';

type DiagnosisSeverityLevel = 'critical' | 'high' | 'medium' | 'low';
type IssueSectionKind = 'automatic' | 'confirmation' | 'manual' | 'blocked';

type IssueSectionView = {
  key: string;
  labelKey: string;
  kind: IssueSectionKind;
  issues: EpubDiagnosticIssue[];
  count: number;
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
    IonModal,
    IonPopover,
    IonRadio,
    IonRadioGroup,
    IonRow,
    IonTitle,
    IonToolbar,
    LoadingStateComponent,
    SectionCardComponent,
    ScrollableButtonBarComponent,
    RemoveAdsUpgradeModalComponent,
  ],
})
export class FixPage implements OnInit, OnDestroy {
  private readonly workflow = inject(EpubFixerWorkflowService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly library = inject(EpubLibraryService);
  private readonly ads = inject(AdsService);
  private readonly adFallback = inject(AdFallbackService);
  private readonly billing = inject(BillingService);
  private readonly settings = inject(SettingsStore<EpubFixerSettings>);
  private readonly coversEvents = inject(CoversEventsService);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('epubInput') epubInput!: ElementRef<HTMLInputElement>;

  constructor() {
    addIcons({
      alertCircleOutline,
      checkmarkCircle,
      chevronDownOutline,
      appsOutline,
      documentOutline,
      helpCircleOutline,
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
  removeAdsPriceFormatted: string | null = null;
  purchaseModalOpen = false;
  purchaseBusy = false;
  private readonly adFallbackApp = 'ef' as const;
  private readonly adFallbackTotal = 1;
  private adFallbackRemaining = this.adFallbackTotal;
  private readonly adFallbackRemainingPrefKey = 'ef_ad_fallback_remaining';
  private readonly adFallbackTrialActivePrefKey = 'ef_ad_fallback_trial_active';
  private adFallbackTrialActive = false;

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
  private removeAdsPriceSub?: Subscription;
  private lastHandledProjectRouteKey: string | null = null;
  private selectedConfirmationByIssueKey: Record<string, boolean> = {};
  private selectedGuidedOptionByIssueKey: Record<string, string> = {};

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
      !this.hasPendingConfirmationSelection &&
      !this.hasPendingGuidedSelection
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

  get diagnosisSeveritySummary(): {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  } {
    const issues = this.diagnosis?.issues ?? [];
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

    return {
      totalIssues: issues.length,
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

  get issueSections(): IssueSectionView[] {
    const sections: IssueSectionView[] = [
      {
        key: 'automatic',
        labelKey: 'FIX.DIAGNOSIS_FIXABLE',
        kind: 'automatic',
        issues: this.issuesByMode('automatic'),
        count: 0,
      },
      {
        key: 'confirmation',
        labelKey: 'FIX.DIAGNOSIS_REVIEW',
        kind: 'confirmation',
        issues: this.issuesByMode('review'),
        count: 0,
      },
      {
        key: 'manual',
        labelKey: 'FIX.DIAGNOSIS_GUIDED',
        kind: 'manual',
        issues: this.issuesByMode('guided'),
        count: 0,
      },
      {
        key: 'blocked',
        labelKey: 'FIX.DIAGNOSIS_BLOCKED',
        kind: 'blocked',
        issues: this.issuesByMode('not_repairable'),
        count: 0,
      },
    ];

    return sections
      .map((section) => ({
        ...section,
        count: section.issues.length,
      }))
      .filter((section) => section.count > 0);
  }

  get diagnosisSummary(): {
    totalIssues: number;
    automaticIssues: number;
    reviewIssues: number;
    guidedIssues: number;
    blockedIssues: number;
  } {
    const issues = this.diagnosis?.issues ?? [];
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

    return {
      totalIssues: issues.length,
      ...summary,
    };
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

  async ngOnInit(): Promise<void> {
    await this.refreshHeaderItems();
    await this.billing.hydrateCachedState();
    const settings = await this.settings.load();
    this.hydrateAdFallbackState(settings.preferences);
    this.adsRemovedSub = this.billing.adsRemoved$.subscribe((value) => {
      this.adsRemoved = value;
      if (value) {
        this.adFallbackTrialActive = false;
        void this.persistAdFallbackState();
      }
    });
    this.adsRemoved = this.billing.isAdsRemoved();
    this.removeAdsPriceFormatted = this.billing.getRemoveAdsPriceFormatted();
    this.removeAdsPriceSub = this.billing.removeAdsPrice$.subscribe((value) => {
      this.removeAdsPriceFormatted = value;
    });
  }

  ngOnDestroy(): void {
    this.closeInfo();
    this.closePurchaseModal();
    this.adsRemovedSub?.unsubscribe();
    this.removeAdsPriceSub?.unsubscribe();
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
        preferredOpfPath,
        guidedSelections,
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

  async openPurchaseModal(): Promise<void> {
    if (!this.canShowRemoveAdsEntryPoint() || this.purchaseBusy) {
      return;
    }

    this.purchaseBusy = true;
    try {
      await this.billing.preparePurchaseUi();
    } finally {
      this.purchaseBusy = false;
    }

    if (!this.canShowRemoveAdsEntryPoint()) {
      return;
    }

    this.purchaseModalOpen = true;
  }

  closePurchaseModal(): void {
    this.purchaseModalOpen = false;
  }

  onPurchaseModalCloseClick(): void {
    this.closePurchaseModal();
  }

  async onPurchaseRemoveAds(): Promise<void> {
    if (!this.canPurchaseRemoveAds()) {
      return;
    }

    this.purchaseBusy = true;
    try {
      const success = await this.billing.purchaseRemoveAds();
      if (!success) {
        return;
      }

      this.closePurchaseModal();
      await this.showToast('COMMON.REMOVE_ADS_PURCHASED', 1800, 'success');
    } catch {
      await this.showToast('COMMON.PURCHASE_ERROR', 1800, 'error');
    } finally {
      this.purchaseBusy = false;
    }
  }

  async onRestorePurchases(): Promise<void> {
    if (!this.canRestoreRemoveAds()) {
      return;
    }

    this.purchaseBusy = true;
    try {
      const restored = await this.billing.restorePurchases();
      if (!restored) {
        await this.showToast('COMMON.RESTORE_ERROR', 1800, 'error');
        return;
      }

      this.closePurchaseModal();
      await this.showToast('COMMON.REMOVE_ADS_RESTORED', 1800, 'success');
    } catch {
      await this.showToast('COMMON.RESTORE_ERROR', 1800, 'error');
    } finally {
      this.purchaseBusy = false;
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
    const issues = this.diagnosis?.issues ?? [];
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

    if (this.adFallbackTrialActive && this.resolveAdFallbackRemaining() > 0) {
      const accepted = await this.confirmActiveAdFallbackTrial();
      if (!accepted) {
        this.epubErrorKey = 'FIX.ADS_REQUIRED';
        this.epubErrorParams = {};
        return false;
      }

      return true;
    }

    try {
      const result = await this.ads.showRewarded();
      if (result.rewardEarned) {
        return true;
      }

      const shouldFallback =
        result.failed || (!result.rewardEarned && !result.adClosed);
      if (shouldFallback) {
        const accepted = await this.openAdFallbackFromFailure(
          result.failed
            ? result
            : {
                rewardEarned: false,
                adClosed: false,
                failed: true,
                failureReason: 'unknown',
                failureConfidence: 'low',
              },
        );
        if (accepted) {
          return true;
        }
      }
    } catch (error) {
      console.warn('[epub-fixer] rewarded ad gate failed', error);
      const accepted = await this.openAdFallbackFromFailure({
        rewardEarned: false,
        adClosed: false,
        failed: true,
        failureReason: 'unknown',
        failureConfidence: 'low',
      });
      if (accepted) {
        return true;
      }
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
      await this.consumeAdFallbackAttemptAfterSuccess();
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

  private async showToast(
    messageKey: string,
    duration = 1600,
    kind: 'success' | 'error' = 'success',
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.translate.instant(messageKey),
      duration,
      position: 'middle',
      cssClass: ['cc-toast', `cc-toast--${kind}`],
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
    this.selectedConfirmationByIssueKey = {};
    this.selectedGuidedOptionByIssueKey = {};

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
    this.selectedGuidedOptionByIssueKey = {};
    this.selectedConfirmationByIssueKey = {};
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

  issueOptions(issue: EpubDiagnosticIssue): string[] {
    return (issue.options ?? []).map((option) => option.trim()).filter(Boolean);
  }

  issueSelectionKey(issue: EpubDiagnosticIssue): string {
    return buildEpubIssueSelectionKey({
      code: issue.code,
      details: issue.details,
      options: this.issueOptions(issue),
    });
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
