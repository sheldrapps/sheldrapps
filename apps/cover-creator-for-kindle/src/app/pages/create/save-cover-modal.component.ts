import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-save-cover-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">{{ 'COMMON.CANCEL' | translate }}</ion-button>
        </ion-buttons>
        <ion-title>{{ 'CREATE.SAVE_RENAME_TITLE' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            (click)="save()"
            [disabled]="!filenameValue.trim()"
            color="primary"
          >
            {{ 'COMMON.DONE' | translate }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="cc-modal-form">
        <div class="cc-form-group">
          <label for="filename-input">{{ 'CREATE.SAVE_RENAME_MESSAGE' | translate }}</label>
          <input
            id="filename-input"
            type="text"
            [(ngModel)]="filenameValue"
            [placeholder]="'CREATE.SAVE_RENAME_PLACEHOLDER' | translate"
            class="cc-text-input"
            (keyup.enter)="save()"
            autofocus
          />
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .cc-modal-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 16px 0;
    }

    .cc-form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .cc-form-group label {
      font-weight: 600;
      font-size: 14px;
      color: var(--ion-color-dark);
    }

    .cc-text-input {
      padding: 12px;
      border: 1px solid var(--ion-color-medium);
      border-radius: 4px;
      font-size: 16px;
      font-family: inherit;
    }

    .cc-text-input:focus {
      outline: none;
      border-color: var(--ion-color-primary);
      box-shadow: 0 0 0 3px rgba(0, 121, 255, 0.1);
    }
  `,
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
  ],
})
export class SaveCoverModalComponent {
  @Input() initialFilename = '';
  filenameValue = '';

  constructor(private modalController: ModalController) {}

  ngOnInit(): void {
    this.filenameValue = this.initialFilename;
    setTimeout(() => {
      const input = document.getElementById('filename-input') as HTMLInputElement;
      if (input) {
        input.select();
      }
    }, 100);
  }

  cancel(): void {
    void this.modalController.dismiss(null, 'cancel');
  }

  save(): void {
    const trimmed = this.filenameValue.trim();
    if (trimmed) {
      void this.modalController.dismiss(trimmed, 'confirm');
    }
  }
}
