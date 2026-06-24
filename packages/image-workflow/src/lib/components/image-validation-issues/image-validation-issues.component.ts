import { Component, Input } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import {
  alertCircleOutline,
  closeCircleOutline,
  informationCircleOutline,
} from "ionicons/icons";

import type { ImageValidationIssue } from "../../types";

@Component({
  selector: "sh-image-validation-issues",
  standalone: true,
  imports: [TranslateModule, IonIcon],
  templateUrl: "./image-validation-issues.component.html",
  styleUrls: ["./image-validation-issues.component.scss"],
})
export class ImageValidationIssuesComponent {
  @Input() id?: string | null;
  @Input() issues: readonly ImageValidationIssue[] = [];
  @Input() embedded = false;

  constructor() {
    addIcons({
      alertCircleOutline,
      closeCircleOutline,
      informationCircleOutline,
    });
  }

  trackIssue(index: number, issue: ImageValidationIssue): string {
    return `${issue.severity}:${issue.messageKey}:${index}`;
  }

  iconName(issue: ImageValidationIssue): string {
    if (issue.severity === "error") return "close-circle-outline";
    if (issue.severity === "warning") return "alert-circle-outline";
    return "information-circle-outline";
  }
}
