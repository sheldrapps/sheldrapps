import { Component, EventEmitter, Input, Output } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import {
  IonCol,
  IonGrid,
  IonRow,
} from "@ionic/angular/standalone";
import { ActionCardComponent } from "@sheldrapps/ui-theme";
import { addIcons } from "ionicons";
import { closeCircleOutline, imageOutline, pencilOutline } from "ionicons/icons";

@Component({
  selector: "sh-cover-source-actions",
  standalone: true,
  imports: [
    TranslateModule,
    IonGrid,
    IonRow,
    IonCol,
    ActionCardComponent,
  ],
  templateUrl: "./cover-source-actions.component.html",
  styleUrls: ["./cover-source-actions.component.scss"],
})
export class CoverSourceActionsComponent {
  @Input() imageDisabled = false;
  @Input() scratchDisabled = false;
  @Input() imageHidden = false;
  @Input() scratchHidden = false;
  @Input() noneHidden = true;
  @Input() tourId: string | null = "cover-source-actions";
  @Input() titleKey: string | null = null;
  @Input() showTitle = true;
  @Input() currentImageUrl: string | null = null;
  @Input() currentHidden = true;
  @Input() currentDisabled = false;
  @Input() noneDisabled = false;
  @Input() suggestedAction: "image" | "current" | "scratch" | "none" | null = null;
  @Input() suggestedActions: Array<"image" | "current" | "scratch" | "none"> = [];

  @Output() imageSelected = new EventEmitter<void>();
  @Output() currentSelected = new EventEmitter<void>();
  @Output() scratchSelected = new EventEmitter<void>();
  @Output() noneSelected = new EventEmitter<void>();

  get resolvedTitleKey(): string {
    return this.titleKey?.trim() || "COVER_SOURCE.TITLE";
  }

  get visibleActionCount(): number {
    return (
      Number(!this.imageHidden) +
      Number(!this.currentHidden) +
      Number(!this.scratchHidden) +
      Number(!this.noneHidden)
    );
  }

  isSuggestedAction(action: "image" | "current" | "scratch" | "none"): boolean {
    if (this.suggestedActions.length > 0) {
      return this.suggestedActions.includes(action);
    }

    return this.suggestedAction === action;
  }

  constructor() {
    addIcons({
      closeCircleOutline,
      imageOutline,
      pencilOutline,
    });
  }

  onSelectImage(): void {
    if (this.imageHidden) return;
    if (this.imageDisabled) return;
    this.imageSelected.emit();
  }

  onSelectScratch(): void {
    if (this.scratchHidden) return;
    if (this.scratchDisabled) return;
    this.scratchSelected.emit();
  }

  onSelectCurrent(): void {
    if (this.currentHidden) return;
    if (this.currentDisabled) return;
    this.currentSelected.emit();
  }

  onSelectNone(): void {
    if (this.noneHidden) return;
    if (this.noneDisabled) return;
    this.noneSelected.emit();
  }
}
