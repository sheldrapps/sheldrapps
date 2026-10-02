import { toSignal } from '@angular/core/rxjs-interop';
import { Component, effect, inject } from '@angular/core';
import {
  IonCol,
  IonButton,
  IonContent,
  IonGrid,
  IonHeader,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { fileTrayOutline, fileTrayStackedOutline } from 'ionicons/icons';
import { BillingService, ExportAccessService } from '@sheldrapps/ads-kit';
import {
  ActionCardComponent,
  ProBadgeComponent,
  SectionCardComponent,
  WorkflowNavigationComponent,
  WorkflowStepperComponent,
  type WorkflowStep,
} from '@sheldrapps/ui-theme';
import { EpubMetadataWorkflowService } from '../../services/epub-metadata-workflow.service';
import type {
  CompletedMetadataFile,
  PendingMetadataReview,
} from '../../services/epub-metadata-workflow.service';

type EditMode = 'single' | 'multiple';

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
    WorkflowNavigationComponent,
    WorkflowStepperComponent,
  ],
})
export class EditPage {
  private readonly billing = inject(BillingService);
  private readonly exportAccess = inject(ExportAccessService);
  private readonly i18n = inject(TranslateService);
  private readonly metadataWorkflow = inject(EpubMetadataWorkflowService);

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
  isAuthorizingEdit = false;

  constructor() {
    addIcons({ fileTrayOutline, fileTrayStackedOutline });
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
    if (!this.editMode) return this.pendingReview ? [0, 1] : [0];
    return this.pendingReview ? [0, 1] : [0];
  }

  get canUseMultipleFiles(): boolean {
    return this.adsRemoved();
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
    if (this.pendingReview) {
      this.applyErrorKey = null;
      this.workflowStep = 2;
      this.metadataWorkflow.clearFormReturnIntent();
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

  async applyMetadataChanges(): Promise<void> {
    if (this.isApplyingChanges || !this.pendingReview) return;

    this.isApplyingChanges = true;
    this.applyErrorKey = null;
    try {
      await this.metadataWorkflow.applyPendingChanges();
    } catch {
      this.applyErrorKey = 'EDIT.APPLY_ERROR';
    } finally {
      this.isApplyingChanges = false;
    }
  }

  private async runFileSelection(action: () => Promise<void>): Promise<void> {
    this.isSelectingFiles = true;
    try {
      await action();
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
      void this.metadataWorkflow.reopenPendingReview().catch(() => {
        this.editErrorKey = 'EDIT.OPEN_ERROR';
      });
      return;
    }

    if (this.workflowStep > 0) {
      this.workflowStep = 0;
    }
  }

  async editCompletedFile(filename: string): Promise<void> {
    if (this.isAuthorizingEdit) return;

    this.editErrorKey = null;
    this.isAuthorizingEdit = true;
    try {
      let granted: boolean;
      try {
        const access = await this.exportAccess.authorize({ onAdFailure: () => false });
        granted = access.granted;
      } catch {
        this.editErrorKey = 'EDIT.AD_UNAVAILABLE';
        return;
      }
      if (!granted) {
        this.editErrorKey = 'EDIT.AD_REQUIRED';
        return;
      }

      await this.metadataWorkflow.editCompleted(filename);
    } catch {
      this.editErrorKey = 'EDIT.OPEN_ERROR';
    } finally {
      this.isAuthorizingEdit = false;
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
      void this.metadataWorkflow.reopenPendingReview().catch(() => {
        this.editErrorKey = 'EDIT.OPEN_ERROR';
      });
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
