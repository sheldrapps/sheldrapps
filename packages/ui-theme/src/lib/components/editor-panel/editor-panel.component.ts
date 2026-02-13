import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { IonButton, IonIcon } from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import { closeOutline, refresh } from "ionicons/icons";

@Component({
  selector: "sh-editor-panel",
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  templateUrl: "./editor-panel.component.html",
  styleUrls: ["./editor-panel.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPanelComponent {
  constructor() {
    addIcons({ closeOutline, refresh });
  }

  @Input() title?: string;

  @Input() ariaLabel?: string;

  @Input() resetAriaLabel?: string;

  @Input() closeAriaLabel?: string;

  @Input() showClose = true;

  @Input() showReset = false;

  @Input() showGrabber = false;

  @Output() close = new EventEmitter<void>();

  @Output() reset = new EventEmitter<void>();
}
