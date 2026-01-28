/**
 * Adapter component that wraps CoverCropperModalComponent with TranslateModule support
 * Use this in your app instead of the base component if you need i18n
 */

import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon, IonToggle, IonRange, IonItem, IonLabel, IonSpinner } from '@ionic/angular/standalone';
import { CoverCropperModalComponent } from './cover-cropper-modal.component';
import type { CoverCropState, CropTarget, CropperResult } from '../../types';

/**
 * This is a convenience component that includes TranslateModule.
 * It's separated to keep the base component free from hard dependencies.
 */
@Component({
  selector: 'app-cover-cropper-modal-translated',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonRange,
    IonToggle,
    IonSpinner,
    CoverCropperModalComponent,
  ],
  template: `
    <app-cover-cropper-modal
      [file]="file"
      [model]="model"
      [initialState]="initialState"
      [onReady]="onReady"
    ></app-cover-cropper-modal>
  `,
})
export class CoverCropperModalTranslatedComponent {
  @Input() file!: File;
  @Input() model!: CropTarget;
  @Input() initialState?: CoverCropState;
  @Input() onReady?: () => void;
}
