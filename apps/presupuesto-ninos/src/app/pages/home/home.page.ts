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
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  AlertController,
  ModalController,
} from "@ionic/angular/standalone";
import { Router } from "@angular/router";
import { addIcons } from "ionicons";
import {
  add,
  createOutline,
  man,
  settingsOutline,
  trash,
  trashOutline,
  woman,
} from "ionicons/icons";
import { BudgetStore } from "../../core/budget.store";
import { AddChildModalComponent } from "./add-child-modal.component";

@Component({
  standalone: true,
  selector: "app-home",
  templateUrl: "./home.page.html",
  styleUrls: ["./home.page.scss"],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonFab,
    IonFabButton,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
  ],
})
export class HomePage {
  readonly store = inject(BudgetStore);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private modalController = inject(ModalController);

  constructor() {
    addIcons({
      add,
      settingsOutline,
      createOutline,
      man,
      woman,
      trash,
      trashOutline,
    });
  }

  async addChild(): Promise<void> {
    const modal = await this.modalController.create({
      component: AddChildModalComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 1],
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === "confirm" && data) {
      await this.store.addChild(data.name, data.gender);
    }
  }

  openSettings(): void {
    void this.router.navigateByUrl("/tabs/ajustes");
  }

  openChild(childId: string): void {
    void this.router.navigate(["/tabs/nino", childId]);
  }

  async editBalance(childId: string, currentBalance: number): Promise<void> {
    const alert = await this.alertController.create({
      header: "Editar saldo",
      inputs: [
        {
          name: "balance",
          type: "number",
          value: currentBalance,
        },
      ],
      buttons: [
        {
          text: "Cancelar",
          role: "cancel",
        },
        {
          text: "Guardar",
          role: "confirm",
          handler: async (data) => {
            await this.store.setChildBalance(
              childId,
              Number(data?.balance ?? currentBalance),
            );
          },
        },
      ],
    });

    await alert.present();
  }

  getBalanceClass(balance: number): string {
    if (balance < 0) return "pn-balance--negative";
    if (balance > 0) return "pn-balance--positive";
    return "pn-balance--zero";
  }

  async deleteChild(childId: string, childName: string): Promise<void> {
    const alert = await this.alertController.create({
      header: "Eliminar niño",
      message: `¿Estás seguro de que quieres eliminar a ${childName}? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: "Cancelar",
          role: "cancel",
        },
        {
          text: "Eliminar",
          role: "destructive",
          handler: async () => {
            await this.store.deleteChild(childId);
          },
        },
      ],
    });

    await alert.present();
  }
}
