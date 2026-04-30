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
  IonButtons,
  IonButton,
  IonBadge,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
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
  EpubDiagnosticResult,
  EpubFixerPortError,
  EpubRewriteError,
  EpubRepairResult,
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

import { EpubFixerWorkflowService } from '../../services/epub-fixer-workflow.service';

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
    IonContent,
    IonHeader,
    IonButtons,
    IonIcon,
    IonItem,
    IonLabel,
    IonPopover,
    IonTitle,
    IonToolbar,
    LoadingStateComponent,
    ScrollableButtonBarComponent,
  ],
})
export class FixPage implements OnInit, OnDestroy {
  private readonly workflow = inject(EpubFixerWorkflowService);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

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

  get isWebDevMode(): boolean {
    return this.workflow.isWebDevMode();
  }

  get supportsFullWorkflow(): boolean {
    return this.workflow.supportsFullWorkflow();
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
      this.supportsFullWorkflow &&
      this.viewState === 'prepared'
    );
  }

  get canRepair(): boolean {
    return (
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.supportsFullWorkflow &&
      this.viewState === 'diagnosed' &&
      this.diagnosis?.status === 'repairable'
    );
  }

  get canExport(): boolean {
    return (
      !!this.preparedSessionId &&
      !this.isBusy &&
      this.supportsFullWorkflow &&
      (this.viewState === 'repaired' || this.diagnosis?.status === 'valid')
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

  get showDiagnosisSummary(): boolean {
    return (
      this.hasValidEpub() &&
      !!this.diagnosis &&
      (this.viewState === 'diagnosed' || this.viewState === 'repairing' || this.viewState === 'repaired')
    );
  }

  get showIssuesList(): boolean {
    return this.showDiagnosisSummary && this.diagnosis!.issues.length > 0;
  }

  get diagnosisIssueCount(): number {
    return this.diagnosis?.issues.length ?? 0;
  }

  get diagnosisFixableCount(): number {
    return this.diagnosis?.issues.filter((issue) => issue.fixable).length ?? 0;
  }

  get resultPrimaryActionKey(): string | null {
    if (this.canRepair) {
      return 'FIX.ACTION_REPAIR';
    }
    if (this.canExport) {
      return 'FIX.ACTION_EXPORT';
    }
    return null;
  }

  async ngOnInit(): Promise<void> {
    await this.refreshHeaderItems();
  }

  ngOnDestroy(): void {
    this.closeInfo();
    void this.cleanupPreparedEpub();
  }

  ionViewWillEnter(): void {
    void this.refreshHeaderItems();
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
    try {
      await this.resetWorkflowForNewEpub();
      const prepared = await this.workflow.prepareFromFile(file);

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
    } catch (error) {
      this.failEpub(this.mapPrepareError(error), file);
      await this.cleanupPreparedEpub();
    } finally {
      this.busyAction = undefined;
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

    this.busyAction = 'diagnose';
    this.viewState = 'diagnosing';
    try {
      this.repairResult = undefined;
      this.exportResult = undefined;
      this.diagnosis = await this.workflow.diagnoseCurrentEpub();
      this.viewState = 'diagnosed';
      this.clearEpubError();
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      this.busyAction = undefined;
    }
  }

  async runRepair(): Promise<void> {
    if (!this.preparedSessionId || !this.canRepair) {
      return;
    }

    this.busyAction = 'repair';
    this.viewState = 'repairing';
    try {
      this.exportResult = undefined;
      this.repairResult = await this.workflow.repairCurrentEpub();
      if (!this.repairResult.success) {
        this.failWorkflow('EPUB_ERROR_REWRITE');
      } else {
        this.clearEpubError();
        this.diagnosis = await this.workflow.diagnoseCurrentEpub();
        this.viewState = 'repaired';
      }
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      this.busyAction = undefined;
    }
  }

  async exportFixed(): Promise<void> {
    if (!this.preparedSessionId || !this.canExport) {
      return;
    }

    this.busyAction = 'export';
    try {
      const outputName = this.workflow.buildFixedOutputName(this.selectedEpubName);
      const exported = await this.workflow.exportCurrentEpub(outputName);
      this.exportResult = {
        size: exported.size,
        outputName,
      };
      this.clearEpubError();
    } catch (error) {
      this.failWorkflow('EPUB_ERROR_REWRITE', error);
    } finally {
      this.busyAction = undefined;
    }
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
    this.busyAction = 'prepare';

    try {
      await this.resetWorkflowForNewEpub();
      const prepared = await this.workflow.pickAndPrepareNative();

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
    }
  }

  private async resetWorkflowForNewEpub(): Promise<void> {
    await this.cleanupPreparedEpub();
    this.clearEpubError();

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
