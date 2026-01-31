import { CommonModule, CurrencyPipe } from '@angular/common';
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
  IonList,
  ModalController,
} from "@ionic/angular/standalone";
import { Expense } from '../../core/models';

@Component({
  standalone: true,
  selector: "app-select-expenses-modal",
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
        <ion-title>Seleccionar gastos</ion-title>
        <ion-buttons slot="end">
          <ion-button
            (click)="save()"
            [disabled]="selectedExpenses.size === 0"
            color="primary"
          >
            Siguiente
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <p class="pn-select-info">Selecciona los gastos a agrupar:</p>
      
      <ion-list>
        <ion-item *ngFor="let expense of expenses" (click)="toggleExpense(expense.id)">
          <ion-label>
            <div class="pn-select-name">{{ expense.label || 'Sin concepto' }}</div>
            <div class="pn-select-sub">
              {{ expense.amount | currency:'MXN':'symbol':'1.2-2' }}
            </div>
          </ion-label>

          <ion-checkbox 
            slot="end"
            [checked]="selectedExpenses.has(expense.id)"
            (click)="$event.stopPropagation()"
            (ionChange)="toggleExpense(expense.id)"
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
    CurrencyPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonCheckbox,
    IonItem,
    IonLabel,
    IonList,
  ],
})
export class SelectExpensesModalComponent {
  @Input() expenses: Expense[] = [];
  @Input() currentExpenseId?: string;

  selectedExpenses = new Set<string>();

  constructor(private modalController: ModalController) {}

  ngOnInit(): void {
    // Preseleccionar el gasto actual si existe
    if (this.currentExpenseId) {
      this.selectedExpenses.add(this.currentExpenseId);
    }
  }

  toggleExpense(expenseId: string): void {
    if (expenseId === this.currentExpenseId) {
      // No permitir deseleccionar el gasto actual
      if (!this.selectedExpenses.has(expenseId)) {
        this.selectedExpenses.add(expenseId);
      }
      return;
    }

    if (this.selectedExpenses.has(expenseId)) {
      this.selectedExpenses.delete(expenseId);
    } else {
      this.selectedExpenses.add(expenseId);
    }
  }

  cancel(): void {
    void this.modalController.dismiss(null, "cancel");
  }

  save(): void {
    const selected = Array.from(this.selectedExpenses);
    if (selected.length > 0) {
      void this.modalController.dismiss(selected, "confirm");
    }
  }
}
