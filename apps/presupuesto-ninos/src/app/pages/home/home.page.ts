import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonFab,
  IonFabButton,
  AlertController,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { add, createOutline, man, settingsOutline, woman } from 'ionicons/icons';
import { BudgetStore } from '../../core/budget.store';

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonFab,
    IonFabButton,
  ],
})
export class HomePage {
  readonly store = inject(BudgetStore);
  private router = inject(Router);
  private alertController = inject(AlertController);

  constructor() {
    addIcons({ add, settingsOutline, createOutline, man, woman });
  }

  async addChild(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Agregar niño',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Nombre',
        },
        {
          name: 'gender',
          type: 'radio',
          label: 'Niño',
          value: 'nino',
          checked: true,
        },
        {
          name: 'gender',
          type: 'radio',
          label: 'Niña',
          value: 'nina',
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
            await this.store.addChild(
              data?.name ?? '',
              data?.gender ?? 'nino'
            );
          },
        },
      ],
    });

    await alert.present();
  }

  openSettings(): void {
    void this.router.navigateByUrl('/tabs/ajustes');
  }

  openChild(childId: string): void {
    void this.router.navigate(['/tabs/nino', childId]);
  }

  async editBalance(childId: string, currentBalance: number): Promise<void> {
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
              childId,
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
}
