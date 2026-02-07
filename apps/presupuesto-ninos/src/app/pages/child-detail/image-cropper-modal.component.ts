import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { CoverCropperModalComponent, CropTarget, CropperResult } from '@sheldrapps/image-workflow';

@Component({
  selector: "app-image-cropper-modal",
  standalone: true,
  imports: [CoverCropperModalComponent],
  template: `
    <app-cover-cropper-modal
      [file]="file"
      [model]="model"
      [initialState]="initialState"
      [onReady]="onReady"
      [locale]="locale"
    ></app-cover-cropper-modal>
  `,
})
export class ImageCropperModalComponent implements OnInit {
  @Input() file!: File;
  @Input() model: CropTarget = { width: 256, height: 256 };
  @Input() initialState?: any;
  @Input() onReady?: () => void;
  @Input() locale?: string;

  constructor(private modalController: ModalController) {}

  ngOnInit() {
    // Component will render and handle the modal
  }
}
