import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { IonIcon, IonItem, IonLabel } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { checkmarkCircle } from "ionicons/icons";

import { ImageValidationIssue } from "../../types";
import { ImageValidationIssuesComponent } from "../image-validation-issues/image-validation-issues.component";
import { SpinnerComponent } from "@sheldrapps/ui-theme";

@Component({
  selector: "sh-current-cover-preview",
  standalone: true,
  imports: [
    TranslateModule,
    IonItem,
    IonLabel,
    IonIcon,
    SpinnerComponent,
    ImageValidationIssuesComponent,
  ],
  templateUrl: "./current-cover-preview.component.html",
  styleUrls: ["./current-cover-preview.component.scss"],
})
export class CurrentCoverPreviewComponent implements OnChanges {
  @Input() titleKey = "IMAGE_WORKFLOW.PREVIEW_TITLE";
  @Input() hintKey = "IMAGE_WORKFLOW.TAP_TO_PREVIEW";
  @Input() ariaLabelKey = "IMAGE_WORKFLOW.PREVIEW_TITLE";
  @Input() tourId: string | null = "cover-image-picker";
  @Input() previewUrl?: string;
  @Input() previewRevision = 0;
  @Input() issues: readonly ImageValidationIssue[] = [];

  @Output() previewRequested = new EventEmitter<void>();

  private previewRenderNonce = 0;
  private readonly previewLoadingState = signal(false);

  get isPreviewLoading(): boolean {
    return this.previewLoadingState();
  }

  set isPreviewLoading(value: boolean) {
    this.previewLoadingState.set(value);
  }

  get previewUrlWithNonce(): string | null {
    return this.previewUrl
      ? `${this.previewUrl}#v=${this.previewRenderNonce}`
      : null;
  }

  constructor() {
    addIcons({ checkmarkCircle });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.previewUrl) {
      this.previewRenderNonce = 0;
      this.isPreviewLoading = false;
      return;
    }

    if (!changes["previewUrl"] && !changes["previewRevision"]) return;

    this.previewRenderNonce += 1;
    this.isPreviewLoading = true;
  }

  onPreviewLoad(): void {
    this.isPreviewLoading = false;
  }

  onPreviewError(): void {
    this.isPreviewLoading = false;
  }

  onPreviewRequested(): void {
    if (!this.previewUrl) return;
    this.previewRequested.emit();
  }
}
