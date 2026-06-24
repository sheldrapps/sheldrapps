import { Component, EventEmitter, Input, Output } from "@angular/core";

import {
  buildImageValidationIssues,
  type CropTarget,
  type ImageDims,
  type ImageValidationIssue,
} from "../../types";
import { getSmallWarnParams } from "../../core/pipeline";
import { CurrentCoverPreviewComponent } from "../current-cover-preview/current-cover-preview.component";
import { ImageValidationIssuesComponent } from "../image-validation-issues/image-validation-issues.component";

const DEFAULT_SMALL_WARNING_KEY = "IMAGE_WARN_SMALL";

@Component({
  selector: "sh-cover-image-state",
  standalone: true,
  imports: [CurrentCoverPreviewComponent, ImageValidationIssuesComponent],
  templateUrl: "./cover-image-state.component.html",
  styleUrls: ["./cover-image-state.component.scss"],
})
export class CoverImageStateComponent {
  @Input() titleKey = "COVERS.PREVIEW_TITLE";
  @Input() hintKey = "CREATE.TAP_TO_PREVIEW";
  @Input() ariaLabelKey = "COVERS.PREVIEW_TITLE";
  @Input() tourId: string | null = "cover-image-picker";
  @Input() previewUrl?: string;
  @Input() previewRevision = 0;
  @Input() errorKey?: string | null;
  @Input() errorParams: Record<string, unknown> = {};
  @Input() warningKey?: string | null;
  @Input() warningParams: Record<string, unknown> = {};
  @Input() smallWarningKey?: string | null;
  @Input() smallWarningSourceDims?: ImageDims | null;
  @Input() smallWarningTarget?: CropTarget | null;

  @Output() previewRequested = new EventEmitter<void>();

  get issues(): ImageValidationIssue[] {
    const issues = buildImageValidationIssues({
      errorKey: this.errorKey,
      errorParams: this.errorParams,
      warningKey: this.warningKey,
      warningParams: this.warningParams,
    });

    const smallWarningIssue = this.buildSmallWarningIssue();
    if (smallWarningIssue) {
      issues.push(smallWarningIssue);
    }

    return issues;
  }

  private buildSmallWarningIssue(): ImageValidationIssue | null {
    if (!this.previewUrl) return null;
    if (!this.smallWarningSourceDims || !this.smallWarningTarget) return null;

    const params = getSmallWarnParams(
      this.smallWarningSourceDims,
      this.smallWarningTarget,
    );
    if (!params) return null;

    return {
      severity: "warning",
      messageKey: this.smallWarningKey || DEFAULT_SMALL_WARNING_KEY,
      messageParams: params as unknown as Record<string, unknown>,
    };
  }

  onPreviewRequested(): void {
    this.previewRequested.emit();
  }
}
