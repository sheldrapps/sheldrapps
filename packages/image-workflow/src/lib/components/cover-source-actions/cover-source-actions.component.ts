import { Component, EventEmitter, Input, Output } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { IonButton, IonCol, IonGrid, IonRow } from "@ionic/angular/standalone";

@Component({
  selector: "sh-cover-source-actions",
  standalone: true,
  imports: [TranslateModule, IonGrid, IonRow, IonCol, IonButton],
  templateUrl: "./cover-source-actions.component.html",
})
export class CoverSourceActionsComponent {
  @Input() imageDisabled = false;
  @Input() scratchDisabled = false;
  @Input() tourId: string | null = "cover-source-actions";

  @Output() imageSelected = new EventEmitter<void>();
  @Output() scratchSelected = new EventEmitter<void>();

  onSelectImage(): void {
    if (this.imageDisabled) return;
    this.imageSelected.emit();
  }

  onSelectScratch(): void {
    if (this.scratchDisabled) return;
    this.scratchSelected.emit();
  }
}
