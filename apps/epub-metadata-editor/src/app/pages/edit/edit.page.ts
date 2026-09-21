import { toSignal } from '@angular/core/rxjs-interop';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import {
  IonCol,
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
import { BillingService } from '@sheldrapps/ads-kit';
import {
  ActionCardComponent,
  FilePickerPanelComponent,
  ProBadgeComponent,
  SectionCardComponent,
  WorkflowNavigationComponent,
  WorkflowStepperComponent,
  type WorkflowStep,
} from '@sheldrapps/ui-theme';
import type { FilePickerPanelItem } from '@sheldrapps/ui-theme';
import { EpubMetadataWorkflowService } from '../../services/epub-metadata-workflow.service';
import type { CompletedMetadataFile } from '../../services/epub-metadata-workflow.service';

type EditMode = 'single' | 'multiple';

type MetadataSummaryRow = {
  labelKey: string;
  value: string;
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
    IonCol,
    IonGrid,
    IonRow,
    TranslateModule,
    ActionCardComponent,
    FilePickerPanelComponent,
    ProBadgeComponent,
    SectionCardComponent,
    WorkflowNavigationComponent,
    WorkflowStepperComponent,
  ],
})
export class EditPage {
  private readonly billing = inject(BillingService);
  private readonly i18n = inject(TranslateService);
  private readonly metadataWorkflow = inject(EpubMetadataWorkflowService);

  @ViewChild('singleEpubInput')
  private singleEpubInput?: ElementRef<HTMLInputElement>;
  @ViewChild('multipleEpubInput')
  private multipleEpubInput?: ElementRef<HTMLInputElement>;

  readonly adsRemoved = toSignal(this.billing.adsRemoved$, {
    initialValue: this.billing.isAdsRemoved(),
  });

  editMode: EditMode | null = null;
  workflowStep = 0;
  isSelectingFiles = false;
  selectionErrorKey: string | null = null;
  selectedFileNames: string[] = [];

  constructor() {
    addIcons({ fileTrayOutline, fileTrayStackedOutline });
  }

  get workflowSteps(): readonly WorkflowStep[] {
    return [
      { id: 'mode', label: 'EDIT.STEPPER.MODE' },
      { id: 'file', label: 'EDIT.STEPPER.FILE' },
      { id: 'edit', label: 'TABS.EDIT' },
    ].map((step) => ({
      ...step,
      label: this.i18n.instant(step.label),
    }));
  }

  get selectableWorkflowSteps(): readonly number[] {
    if (!this.editMode) return [0];
    return this.completedMetadata.length > 0 ? [0, 1, 2] : [0, 1];
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

  metadataSummaryRows(metadata: CompletedMetadataFile['metadata']): readonly MetadataSummaryRow[] {
    const rows: MetadataSummaryRow[] = [];
    this.addSummaryRow(rows, 'EPUB_METADATA.TITLE', metadata.title);
    this.addSummaryRow(rows, 'EPUB_METADATA.LANGUAGE', metadata.language);
    this.addSummaryRow(
      rows,
      'EPUB_METADATA.IDENTIFIER',
      [metadata.identifier.value, metadata.identifier.scheme]
        .filter((value): value is string => !!value?.trim())
        .join(' · '),
    );
    this.addSummaryRow(rows, 'EPUB_METADATA.PUBLISHER', metadata.publisher);
    this.addSummaryRow(rows, 'EPUB_METADATA.DATE', metadata.date);
    this.addSummaryRow(rows, 'EPUB_METADATA.DESCRIPTION', metadata.description);
    this.addSummaryRow(rows, 'EPUB_METADATA.AUTHORS', this.formatPeople(metadata.creators));
    this.addSummaryRow(rows, 'EPUB_METADATA.SUBJECTS', this.formatList(metadata.subjects));
    this.addSummaryRow(
      rows,
      'EPUB_METADATA.CONTRIBUTORS',
      this.formatPeople(metadata.contributors),
    );
    this.addSummaryRow(rows, 'EPUB_METADATA.RIGHTS', metadata.rights);
    this.addSummaryRow(rows, 'EPUB_METADATA.TYPE', metadata.type);
    this.addSummaryRow(rows, 'EPUB_METADATA.FORMAT', metadata.format);
    this.addSummaryRow(rows, 'EPUB_METADATA.SOURCE', metadata.source);
    this.addSummaryRow(rows, 'EPUB_METADATA.RELATION', metadata.relation);
    this.addSummaryRow(rows, 'EPUB_METADATA.COVERAGE', metadata.coverage);
    return rows;
  }

  get filePickerItems(): FilePickerPanelItem[] {
    return this.selectedFileNames.map((filename, index) => ({
      id: `${index}-${filename}`,
      title: filename,
    }));
  }

  get filePickerActionLabel(): string | null {
    if (this.selectedFileNames.length === 0) return null;
    return this.editMode === 'multiple'
      ? this.i18n.instant('EDIT.SELECTED_FILES_COUNT', {
          count: this.selectedFileNames.length,
        })
      : this.selectedFileNames[0];
  }

  selectEditMode(mode: EditMode): void {
    if (mode === 'multiple' && !this.canUseMultipleFiles) {
      return;
    }

    this.editMode = mode;
    this.workflowStep = 1;
    this.selectionErrorKey = null;
    this.selectedFileNames = [];
    void this.selectFiles();
  }

  async selectFiles(): Promise<void> {
    if (!this.editMode || this.isSelectingFiles) return;
    this.selectionErrorKey = null;

    if (this.metadataWorkflow.isNativeSupported) {
      await this.runFileSelection(() =>
        this.metadataWorkflow.startFromNativePicker(this.editMode === 'multiple'),
      );
      return;
    }

    const input =
      this.editMode === 'multiple'
        ? this.multipleEpubInput?.nativeElement
        : this.singleEpubInput?.nativeElement;
    if (!input) {
      this.selectionErrorKey = 'EDIT.SELECTION_ERROR';
      return;
    }

    input.click();
  }

  async onBrowserFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;

    this.selectedFileNames = files.map((file) => file.name);
    await this.runFileSelection(() =>
      this.metadataWorkflow.startFromBrowserFiles(files),
    );
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.workflowStep === 1 && this.metadataWorkflow.hasPendingFiles) {
      await this.runFileSelection(() => this.metadataWorkflow.resumePending());
      return;
    }

    if (this.completedMetadata.length > 0) {
      this.workflowStep = 2;
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
    if (this.workflowStep > 0) {
      this.workflowStep -= 1;
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

    this.workflowStep = step;
  }

  private addSummaryRow(
    rows: MetadataSummaryRow[],
    labelKey: string,
    value: string | undefined,
  ): void {
    const normalizedValue = value?.trim();
    if (normalizedValue) {
      rows.push({ labelKey, value: normalizedValue });
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
