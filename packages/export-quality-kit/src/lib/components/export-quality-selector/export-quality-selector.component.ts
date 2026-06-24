import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import type { ExportQualityMode } from '@sheldrapps/image-workflow';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  diamondOutline,
  documentOutline,
  starOutline,
} from 'ionicons/icons';
import { EXPORT_QUALITY_SELECTOR_MODES } from "../../models/export-quality-kit.types";

@Component({
  selector: "app-export-quality-selector",
  standalone: true,
  imports: [CommonModule, TranslateModule, IonIcon],
  templateUrl: "./export-quality-selector.component.html",
  styleUrls: ["./export-quality-selector.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportQualitySelectorComponent {
  @Input({ required: true }) selectedMode!: ExportQualityMode;
  @Input() isPro = false;
  @Input() proOnlyKey = "COMMON.PRO_ONLY";
  @Input() modes: readonly ExportQualityMode[] = EXPORT_QUALITY_SELECTOR_MODES;
  @Output() modeSelect = new EventEmitter<ExportQualityMode>();

  constructor() {
    addIcons({
      diamondOutline,
      documentOutline,
      starOutline,
    });
  }

  get titleKey(): string {
    return "EXPORT_OPTIONS.TITLE";
  }

  isModeSelected(mode: ExportQualityMode): boolean {
    return this.selectedMode === mode;
  }

  isModeLocked(mode: ExportQualityMode): boolean {
    return mode !== "compressed" && !this.isPro;
  }

  getModeIconName(mode: ExportQualityMode): string {
    if (mode === "compressed") {
      return "star-outline";
    }

    if (mode === "best") {
      return "diamond-outline";
    }

    return "document-outline";
  }

  getModeLabelKey(mode: ExportQualityMode): string {
    if (mode === "compressed") {
      return "EXPORT_OPTIONS.OPTIMIZED_TITLE";
    }

    if (mode === "best") {
      return "EXPORT_OPTIONS.LOSSLESS_TITLE";
    }

    return "EXPORT_OPTIONS.THUMBNAIL_TITLE";
  }

  onModeSelect(mode: ExportQualityMode): void {
    this.modeSelect.emit(mode);
  }
}
