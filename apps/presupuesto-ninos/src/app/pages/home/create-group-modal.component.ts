import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
  selector: "app-create-group-modal",
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
        <ion-title>Nuevo grupo</ion-title>
        <ion-buttons slot="end">
          <ion-button
            (click)="save()"
            [disabled]="!groupValue.trim()"
            color="primary"
          >
            Crear
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="pn-modal-form">
        <div class="pn-form-group">
          <label for="group-input">Nombre del grupo</label>
          <input
            id="group-input"
            type="text"
            [(ngModel)]="groupValue"
            placeholder="Ej: Educación, Entretenimiento"
            class="pn-text-input"
            (keyup.enter)="save()"
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
      color: var(--ion-color-dark);
    }

    .pn-text-input {
      padding: 12px;
      border: 1px solid var(--ion-color-medium);
      border-radius: 4px;
      font-size: 16px;
      font-family: inherit;
    }

    .pn-text-input:focus {
      outline: none;
      border-color: var(--ion-color-primary);
      box-shadow: 0 0 0 3px rgba(0, 121, 255, 0.1);
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
export class CreateGroupModalComponent {
  groupValue = "";

  constructor(private modalController: ModalController) {}

  cancel(): void {
    void this.modalController.dismiss(null, "cancel");
  }

  save(): void {
    const trimmed = this.groupValue.trim();
    if (trimmed) {
      void this.modalController.dismiss(trimmed, "confirm");
    }
  }
}
