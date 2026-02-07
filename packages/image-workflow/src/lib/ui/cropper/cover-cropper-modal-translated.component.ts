/**
 * Adapter component that wraps CoverCropperModalComponent with TranslateModule support
 * Use this in your app instead of the base component if you need i18n
 */

import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from "@ngx-translate/core";
import { CoverCropperModalComponent } from "./cover-cropper-modal.component";
import type {
  CoverCropState,
  CropTarget,
  CropFormatOption,
  CropperLabels,
} from "../../types";

/**
 * This is a convenience component that includes TranslateModule.
 * It's separated to keep the base component free from hard dependencies.
 */
@Component({
  selector: "app-cover-cropper-modal-translated",
  standalone: true,
  imports: [CommonModule, TranslateModule, CoverCropperModalComponent],
  template: `
    <app-cover-cropper-modal
      [file]="file"
      [model]="model"
      [formatOptions]="formatOptions"
      [formatId]="formatId"
      [initialState]="initialState"
      [onReady]="onReady"
      [locale]="locale"
      [labels]="labels"
      [showAdjustments]="showAdjustments"
      [showRotate]="showRotate"
      [showFormatSelector]="showFormatSelector"
      [showHint]="showHint"
      [showGrid]="showGrid"
    ></app-cover-cropper-modal>
  `,
})
export class CoverCropperModalTranslatedComponent {
  @Input() file!: File;
  @Input() model!: CropTarget;
  @Input() formatOptions?: CropFormatOption[];
  @Input() formatId?: string;
  @Input() initialState?: CoverCropState;
  @Input() onReady?: () => void;
  @Input() locale?: string;
  @Input() labels?: Partial<CropperLabels>;
  @Input() showAdjustments = true;
  @Input() showRotate = true;
  @Input() showFormatSelector = true;
  @Input() showHint = true;
  @Input() showGrid = true;
}
