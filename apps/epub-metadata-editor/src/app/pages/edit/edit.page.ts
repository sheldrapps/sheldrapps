import { toSignal } from '@angular/core/rxjs-interop';
import { Component, effect, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonCol,
  IonButton,
  IonButtons,
  IonContent,
  IonGrid,
  IonHeader,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  appsOutline,
  fileTrayOutline,
  fileTrayStackedOutline,
  refreshOutline,
} from 'ionicons/icons';
import { AdsService, BillingService, ExportAccessService } from '@sheldrapps/ads-kit';
import {
  RecommendedAppsService,
  buildHomeHeaderItems,
  getRecommendedAppsTranslations,
  handleHomeHeaderAction,
} from '@sheldrapps/recommended-apps';
import type { RecommendedApp } from '@sheldrapps/recommended-apps';
import {
  ActionCardComponent,
  ProBadgeComponent,
  ScrollableButtonBarComponent,
  SectionCardComponent,
  WorkflowNavigationComponent,
  WorkflowStepperComponent,
  type ScrollableBarItem,
  type WorkflowStep,
} from '@sheldrapps/ui-theme';
import { EpubMetadataWorkflowService } from '../../services/epub-metadata-workflow.service';
import type {
  CompletedMetadataFile,
  PendingMetadataReview,
} from '../../services/epub-metadata-workflow.service';

type EditMode = 'single' | 'multiple';

const MULTIPLE_FILES_REQUIRES_PRO = false;

type MetadataSummaryRow = {
  labelKey: string;
  value: string;
};

type MetadataChangeRow = {
  labelKey: string;
  before: string;
  after: string;
};

@Component({
  selector: 'app-edit-page',
  templateUrl: './edit.page.html',
  styleUrls: ['./edit.page.scss'],
  imports: [
    IonButtons,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonCol,
    IonGrid,
    IonRow,
    TranslateModule,
    ActionCardComponent,
    ProBadgeComponent,
    SectionCardComponent,
    ScrollableButtonBarComponent,
    WorkflowNavigationComponent,
    WorkflowStepperComponent,
  ],
})
export class EditPage implements OnDestroy {
  private readonly alertController = inject(AlertController);
  private readonly ads = inject(AdsService);
  private readonly billing = inject(BillingService);
  private readonly exportAccess = inject(ExportAccessService);
  private readonly i18n = inject(TranslateService);
  private readonly metadataWorkflow = inject(EpubMetadataWorkflowService);
  private readonly recommendedAppsService = inject(RecommendedAppsService);
  private readonly router = inject(Router);

  readonly adsRemoved = toSignal(this.billing.adsRemoved$, {
    initialValue: this.billing.isAdsRemoved(),
  });

  editMode: EditMode | null = null;
  workflowStep = 0;
  isSelectingFiles = false;
  selectionErrorKey: string | null = null;
  editErrorKey: string | null = null;
  applyErrorKey: string | null = null;
  isApplyingChanges = false;
  isAuthorizingWrite = false;
  isOpeningEditor = false;
  private writeAccessGranted = false;
  headerItems: ScrollableBarItem[] = [];
  recommendedApps: RecommendedApp[] = [];
  isResettingFlow = false;
  private headerLangSub?: Subscription;
  private headerTranslationSub?: Subscription;

  constructor() {
    addIcons({
      appsOutline,
      fileTrayOutline,
      fileTrayStackedOutline,
      refreshOutline,
    });
    this.headerLangSub = this.i18n.onLangChange.subscribe(() => {
      void this.refreshHeaderItems();
    });
    this.headerTranslationSub = this.i18n.onTranslationChange.subscribe((event) => {
      if (event.lang) {
        void this.refreshHeaderItems();
      }
    });
    effect(() => {
      if (this.pendingReview) {
        this.workflowStep = 2;
      }
    });
  }

  get workflowSteps(): readonly WorkflowStep[] {
    return [
      { id: 'mode', label: 'EDIT.STEPPER.MODE' },
      { id: 'form', label: 'EDIT.STEPPER.FORM' },
      { id: 'summary', label: 'EDIT.STEPPER.SUMMARY' },
    ].map((step) => ({
      ...step,
      label: this.i18n.instant(step.label),
    }));
  }

  get selectableWorkflowSteps(): readonly number[] {
    return this.pendingReview ? [0, 1] : [0];
  }

  get canUseMultipleFiles(): boolean {
    return !MULTIPLE_FILES_REQUIRES_PRO || this.adsRemoved();
  }

  get isBusy(): boolean {
    return (
      this.isResettingFlow ||
      this.isSelectingFiles ||
      this.isApplyingChanges ||
      this.isAuthorizingWrite ||
      this.isOpeningEditor
    );
  }

  get workflowPreviousLabel(): string {
    return this.workflowSteps[this.workflowStep - 1]?.label ?? '';
  }

  get workflowNextLabel(): string {
    return this.workflowSteps[this.workflowStep + 1]?.label ?? '';
  }

  get canContinueWorkflow(): boolean {
    return false;
  }

  get completedMetadata(): readonly CompletedMetadataFile[] {
    return this.metadataWorkflow.completedMetadata();
  }

  get pendingReview(): PendingMetadataReview | null {
    return this.metadataWorkflow.pendingReview();
  }

  metadataSummaryRows(metadata: CompletedMetadataFile['metadata']): readonly MetadataSummaryRow[] {
    return this.metadataValues(metadata).filter((row) => row.value.length > 0);
  }

  metadataChangeRows(
    original: CompletedMetadataFile['metadata'],
    updated: CompletedMetadataFile['metadata'],
  ): readonly MetadataChangeRow[] {
    const originalRows = this.metadataValues(original);
    const updatedRows = this.metadataValues(updated);

    return originalRows.flatMap((row, index) => {
      const after = updatedRows[index].value;
      return row.value === after
        ? []
        : [{ labelKey: row.labelKey, before: row.value, after }];
    });
  }

  selectEditMode(mode: EditMode): void {
    if (mode === 'multiple' && !this.canUseMultipleFiles) {
      return;
    }

    this.writeAccessGranted = false;
    this.prepareEditMode(mode);
    void this.selectFiles();
  }

  prepareEditMode(mode: EditMode): void {
    this.selectionErrorKey = null;
    this.editMode = mode;
  }

  async selectFiles(): Promise<void> {
    if (!this.editMode || this.isSelectingFiles) return;
    this.selectionErrorKey = null;

    await this.runFileSelection(() =>
      this.metadataWorkflow.startFromNativePicker(this.editMode === 'multiple'),
    );
  }

  async ionViewWillEnter(): Promise<void> {
    await this.refreshHeaderItems();

    if (this.pendingReview) {
      this.applyErrorKey = null;
      this.workflowStep = 2;
      this.metadataWorkflow.clearFormReturnIntent();
      void this.ads.warmRewarded().catch(() => undefined);
      return;
    }

    if (this.metadataWorkflow.consumeFormReturnIntent()) {
      await this.metadataWorkflow.returnToModeSelection();
      this.workflowStep = 0;
      return;
    }

    if (this.completedMetadata.length > 0) {
      this.workflowStep = 2;
    }
  }

  ngOnDestroy(): void {
    this.headerLangSub?.unsubscribe();
    this.headerTranslationSub?.unsubscribe();
  }

  async applyMetadataChanges(): Promise<void> {
    if (this.isApplyingChanges || this.isAuthorizingWrite || !this.pendingReview) return;

    this.applyErrorKey = null;
    this.isAuthorizingWrite = true;
    try {
      if (!this.writeAccessGranted) {
        let access: Awaited<ReturnType<ExportAccessService['authorize']>>;
        try {
          access = await this.exportAccess.authorize({ onAdFailure: () => false });
        } catch {
          this.applyErrorKey = 'EDIT.AD_UNAVAILABLE';
          return;
        }
        if (!access.granted) {
          this.applyErrorKey = 'EDIT.AD_REQUIRED';
          return;
        }
        this.writeAccessGranted = true;
      }

      this.isApplyingChanges = true;
      await this.metadataWorkflow.applyPendingChanges();
      if (!this.metadataWorkflow.hasActiveFiles) this.writeAccessGranted = false;
    } catch {
      this.applyErrorKey = 'EDIT.APPLY_ERROR';
    } finally {
      this.isAuthorizingWrite = false;
      this.isApplyingChanges = false;
    }
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

  async resetFlow(): Promise<void> {
    if (this.isBusy) return;

    this.isResettingFlow = true;
    try {
      if (!(await this.confirmResetFlow())) return;

      await this.metadataWorkflow.cancel();
      this.resetLocalSessionState();
    } finally {
      this.isResettingFlow = false;
    }
  }

  private resetLocalSessionState(): void {
    this.editMode = null;
    this.workflowStep = 0;
    this.isSelectingFiles = false;
    this.selectionErrorKey = null;
    this.editErrorKey = null;
    this.applyErrorKey = null;
    this.isApplyingChanges = false;
    this.isAuthorizingWrite = false;
    this.isOpeningEditor = false;
    this.writeAccessGranted = false;
  }

  private async refreshHeaderItems(): Promise<void> {
    this.recommendedApps = await this.recommendedAppsService.getRecommendedApps();
    this.headerItems = buildHomeHeaderItems(this.recommendedApps.length > 0, {
      appsLabel: getRecommendedAppsTranslations(this.i18n.currentLang).TITLE,
      resetLabel: this.i18n.instant('UI_THEME.RESET'),
      includeGuide: false,
    });
  }

  private async confirmResetFlow(): Promise<boolean> {
    const alert = await this.alertController.create({
      message: this.i18n.instant('UI_THEME.RESET_CONFIRMATION'),
      buttons: [
        { text: this.i18n.instant('COMMON.CANCEL'), role: 'cancel' },
        { text: this.i18n.instant('UI_THEME.RESET'), role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onWillDismiss();
    return role === 'confirm';
  }

  private async runFileSelection(action: () => Promise<void>): Promise<void> {
    this.isSelectingFiles = true;
    try {
      await action();
      this.workflowStep = 1;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code)
          : error instanceof Error
            ? error.message
            : String(error);
      if (code !== 'PICK_CANCELLED') {
        this.selectionErrorKey = 'EDIT.SELECTION_ERROR';
      }
    } finally {
      this.isSelectingFiles = false;
    }
  }

  onWorkflowPrevious(): void {
    if (this.workflowStep === 2 && this.pendingReview) {
      void this.reopenPendingReview();
      return;
    }

    if (this.workflowStep > 0) this.workflowStep = 0;
  }

  async editCompletedFile(filename: string): Promise<void> {
    if (this.isOpeningEditor) return;

    this.writeAccessGranted = false;
    this.editErrorKey = null;
    this.isOpeningEditor = true;
    try {
      await this.metadataWorkflow.editCompleted(filename);
    } catch {
      this.editErrorKey = 'EDIT.OPEN_ERROR';
    } finally {
      this.isOpeningEditor = false;
    }
  }

  onWorkflowStepSelected(step: number): void {
    if (
      step < 0 ||
      step >= this.workflowSteps.length ||
      step === this.workflowStep ||
      !this.selectableWorkflowSteps.includes(step)
    ) {
      return;
    }

    if (step === 1 && this.pendingReview) {
      void this.reopenPendingReview();
      return;
    }

    this.workflowStep = step;
  }

  private metadataValues(
    metadata: CompletedMetadataFile['metadata'],
  ): MetadataSummaryRow[] {
    return [
      { labelKey: 'EPUB_METADATA.TITLE', value: metadata.title },
      { labelKey: 'EPUB_METADATA.LANGUAGE', value: metadata.language },
      {
        labelKey: 'EPUB_METADATA.IDENTIFIER',
        value: [metadata.identifier.value, metadata.identifier.scheme]
          .filter((value): value is string => !!value?.trim())
          .join(' · '),
      },
      { labelKey: 'EPUB_METADATA.PUBLISHER', value: metadata.publisher ?? '' },
      { labelKey: 'EPUB_METADATA.DATE', value: metadata.date ?? '' },
      { labelKey: 'EPUB_METADATA.DESCRIPTION', value: metadata.description ?? '' },
      {
        labelKey: 'EPUB_METADATA.AUTHORS',
        value: this.formatPeople(metadata.creators) ?? '',
      },
      {
        labelKey: 'EPUB_METADATA.SUBJECTS',
        value: this.formatList(metadata.subjects) ?? '',
      },
      {
        labelKey: 'EPUB_METADATA.CONTRIBUTORS',
        value: this.formatPeople(metadata.contributors) ?? '',
      },
      { labelKey: 'EPUB_METADATA.RIGHTS', value: metadata.rights ?? '' },
      { labelKey: 'EPUB_METADATA.TYPE', value: metadata.type ?? '' },
      { labelKey: 'EPUB_METADATA.FORMAT', value: metadata.format ?? '' },
      { labelKey: 'EPUB_METADATA.SOURCE', value: metadata.source ?? '' },
      { labelKey: 'EPUB_METADATA.RELATION', value: metadata.relation ?? '' },
      { labelKey: 'EPUB_METADATA.COVERAGE', value: metadata.coverage ?? '' },
    ].map((row) => ({ ...row, value: row.value.trim() }));
  }

  private async reopenPendingReview(): Promise<void> {
    if (this.isOpeningEditor) return;

    this.isOpeningEditor = true;
    try {
      await this.metadataWorkflow.reopenPendingReview();
    } catch {
      this.editErrorKey = 'EDIT.OPEN_ERROR';
    } finally {
      this.isOpeningEditor = false;
    }
  }

  private formatList(values: readonly string[]): string | undefined {
    const normalizedValues = values.map((value) => value.trim()).filter(Boolean);
    return normalizedValues.length > 0 ? normalizedValues.join(', ') : undefined;
  }

  private formatPeople(
    people: readonly { name: string }[],
  ): string | undefined {
    return this.formatList(people.map((person) => person.name));
  }
}
