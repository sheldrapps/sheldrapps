import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonIcon,
  IonList,
  ModalController,
} from "@ionic/angular/standalone";
import { addIcons } from 'ionicons';
import { personOutline } from 'ionicons/icons';
import { ChildBudget } from '../../core/models';

@Component({
  standalone: true,
  selector: "app-select-budgets-modal",
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
        <ion-title>Seleccionar presupuestos</ion-title>
        <ion-buttons slot="end">
          <ion-button
            (click)="save()"
            [disabled]="selectedBudgets.size === 0"
            color="primary"
          >
            Siguiente
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p class="pn-select-info">Selecciona los presupuestos a agrupar:</p>
      
      <ion-list>
        <ion-item *ngFor="let budget of budgets" (click)="toggleBudget(budget.id)">
          <div slot="start" class="pn-select-avatar">
            <img *ngIf="budget.imageThumb" [src]="budget.imageThumb" alt="" />
            <ion-icon *ngIf="!budget.imageThumb" name="person-outline" aria-hidden="true"></ion-icon>
          </div>
          
          <ion-label>
            <div class="pn-select-name">{{ budget.name }}</div>
            <div class="pn-select-sub">
              Saldo: {{ budget.balance | currency:'MXN':'symbol':'1.2-2' }}
            </div>
          </ion-label>

          <ion-checkbox 
            slot="end"
            [checked]="selectedBudgets.has(budget.id)"
            (click)="$event.stopPropagation()"
            (ionChange)="toggleBudget(budget.id)"
          ></ion-checkbox>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: `
    .pn-select-info {
      font-size: 14px;
      color: var(--ion-color-medium);
      margin-bottom: 16px;
    }

    .pn-select-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
      background: var(--ion-color-light);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-right: 8px;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      ion-icon {
        font-size: 24px;
        color: var(--ion-color-medium);
      }
    }

    .pn-select-name {
      font-weight: 600;
      font-size: 15px;
    }

    .pn-select-sub {
      opacity: 0.65;
      font-size: 13px;
      margin-top: 4px;
    }

    ion-item {
      cursor: pointer;
    }
  `,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonCheckbox,
    IonItem,
    IonLabel,
    IonIcon,
    IonList,
  ],
})
export class SelectBudgetsModalComponent {
  @Input() budgets: ChildBudget[] = [];
  @Input() currentBudgetId?: string;

  selectedBudgets = new Set<string>();

  constructor(private modalController: ModalController) {
    addIcons({ personOutline });
  }

  toggleBudget(budgetId: string): void {
    if (budgetId === this.currentBudgetId) {
      // No permitir deseleccionar el presupuesto actual
      if (!this.selectedBudgets.has(budgetId)) {
        this.selectedBudgets.add(budgetId);
      }
      return;
    }

    if (this.selectedBudgets.has(budgetId)) {
      this.selectedBudgets.delete(budgetId);
    } else {
      this.selectedBudgets.add(budgetId);
    }
  }

  cancel(): void {
    void this.modalController.dismiss(null, "cancel");
  }

  save(): void {
    const selected = Array.from(this.selectedBudgets);
    if (selected.length > 0) {
      void this.modalController.dismiss(selected, "confirm");
    }
  }
}
