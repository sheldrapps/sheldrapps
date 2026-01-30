import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRadio,
  IonRadioGroup,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { man, woman } from 'ionicons/icons';

@Component({
  standalone: true,
  selector: 'app-add-child-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
        <ion-title>Agregar niño</ion-title>
        <ion-buttons slot="end">
          <ion-button
            (click)="save()"
            [disabled]="!nameValue.trim()"
            color="primary"
          >
            Guardar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="pn-modal-form">
        <div class="pn-form-group">
          <label for="name-input">Nombre</label>
          <input
            id="name-input"
            type="text"
            [(ngModel)]="nameValue"
            placeholder="Ingresa el nombre del niño"
            class="pn-text-input"
          />
        </div>

        <div class="pn-form-group">
          <label>Género</label>
          <ion-radio-group [(ngModel)]="genderValue">
            <div class="pn-radio-option">
              <ion-radio value="nino">
                <div class="pn-radio-label">
                  <ion-icon name="man" aria-hidden="true"></ion-icon>
                  <span>Niño</span>
                </div>
              </ion-radio>
            </div>

            <div class="pn-radio-option">
              <ion-radio value="nina">
                <div class="pn-radio-label">
                  <ion-icon name="woman" aria-hidden="true"></ion-icon>
                  <span>Niña</span>
                </div>
              </ion-radio>
            </div>
          </ion-radio-group>
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .pn-modal-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 16px 0;
    }

    .pn-form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pn-form-group label {
      font-weight: 600;
      font-size: 14px;
      color: var(--ion-text-color);
    }

    .pn-text-input {
      padding: 12px;
      border: 1px solid var(--ion-border-color);
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      background-color: var(--ion-background-color);
      color: var(--ion-text-color);
    }

    .pn-text-input:focus {
      outline: none;
      border-color: var(--ion-color-primary);
    }

    .pn-radio-option {
      display: flex;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--ion-border-color);
      border-radius: 8px;
      margin-bottom: 12px;
      transition: border-color 0.2s;
    }

    .pn-radio-option ion-radio {
      margin-right: 12px;
    }

    .pn-radio-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
    }

    ion-radio-group {
      display: flex;
      flex-direction: column;
    }
  `,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonRadioGroup,
    IonRadio,
    IonIcon,
  ],
})
export class AddChildModalComponent {
  nameValue = '';
  genderValue: 'nino' | 'nina' = 'nino';

  constructor(private modalController: ModalController) {
    addIcons({ man, woman });
  }

  cancel(): void {
    void this.modalController.dismiss();
  }

  save(): void {
    if (this.nameValue.trim()) {
      void this.modalController.dismiss(
        {
          name: this.nameValue.trim(),
          gender: this.genderValue,
        },
        'confirm',
      );
    }
  }
}
