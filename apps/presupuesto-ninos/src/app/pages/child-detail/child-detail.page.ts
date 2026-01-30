import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, createOutline, man, trash, woman, trashOutline } from 'ionicons/icons';
import { BudgetStore } from '../../core/budget.store';

@Component({
  standalone: true,
  selector: 'app-child-detail',
  templateUrl: './child-detail.page.html',
  styleUrls: ['./child-detail.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
  ],
})
export class ChildDetailPage {
  private route = inject(ActivatedRoute);
  private alertController = inject(AlertController);

  readonly store = inject(BudgetStore);
  readonly childId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly child = computed(() =>
    this.store.children().find((item) => item.id === this.childId) ?? null
  );

  nameValue = '';
  genderValue: 'nino' | 'nina' = 'nino';

  constructor() {
    addIcons({man,woman,add,createOutline,trashOutline,trash});

    effect(() => {
      const child = this.child();
      this.nameValue = child?.name ?? '';
      this.genderValue = child?.gender ?? 'nino';
    });
  }

  async saveName(): Promise<void> {
    await this.store.renameChild(this.childId, this.nameValue);
  }

  async updateCreditAmount(value: string | null): Promise<void> {
    await this.store.setChildCreditAmount(
      this.childId,
      Number(value ?? 0)
    );
  }

  async updateGender(value: 'nino' | 'nina'): Promise<void> {
    await this.store.setChildGender(this.childId, value);
  }

  async addExpense(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Agregar gasto',
      inputs: [
        {
          name: 'label',
          type: 'text',
          placeholder: 'Concepto',
        },
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Monto',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar',
          role: 'confirm',
          handler: async (data) => {
            await this.store.addExpense(
              this.childId,
              data?.label ?? '',
              Number(data?.amount ?? 0)
            );
          },
        },
      ],
    });

    await alert.present();
  }

  async updateExpenseLabel(expenseId: string, value: string | null): Promise<void> {
    await this.store.editExpense(this.childId, expenseId, {
      label: value ?? '',
    });
  }

  async updateExpenseAmount(expenseId: string, value: string | null): Promise<void> {
    const amount = Number(value ?? 0);
    await this.store.editExpense(this.childId, expenseId, { amount });
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await this.store.deleteExpense(this.childId, expenseId);
  }

  async editBalance(currentBalance: number): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Editar saldo',
      inputs: [
        {
          name: 'balance',
          type: 'number',
          value: currentBalance,
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar',
          role: 'confirm',
          handler: async (data) => {
            await this.store.setChildBalance(
              this.childId,
              Number(data?.balance ?? currentBalance)
            );
          },
        },
      ],
    });

    await alert.present();
  }

  getBalanceClass(balance: number): string {
    if (balance < 0) return 'pn-balance--negative';
    if (balance > 0) return 'pn-balance--positive';
    return 'pn-balance--zero';
  }

  async onAddExpense(): Promise<void> {
    await this.addExpense();
  }

  async onEditBalance(): Promise<void> {
    const child = this.child();
    if (child) {
      await this.editBalance(child.balance);
    }
  }
}