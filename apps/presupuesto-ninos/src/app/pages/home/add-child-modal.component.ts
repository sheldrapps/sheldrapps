import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
} from "@ionic/angular/standalone";

@Component({
  standalone: true,
  selector: "app-add-child-modal",
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
        <ion-title>Agregar</ion-title>
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
            placeholder="Ingresa el nombre"
            class="pn-text-input"
          />
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
      color: var(--app-text-primary);
    }

    .pn-text-input {
      padding: 12px;
      border: 1px solid var(--app-divider);
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      background-color: var(--app-control-background);
      color: var(--app-control-text);
    }

    .pn-text-input:focus {
      outline: none;
      border-color: var(--ion-color-primary);
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
  ],
})
export class AddChildModalComponent {
  private modalController = inject(ModalController);
  nameValue = "";

  cancel(): void {
    void this.modalController.dismiss();
  }

  save(): void {
    if (this.nameValue.trim()) {
      void this.modalController.dismiss(
        {
          name: this.nameValue.trim(),
        },
        "confirm",
      );
    }
  }
}
