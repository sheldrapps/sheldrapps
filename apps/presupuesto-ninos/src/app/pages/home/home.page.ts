import { Component, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
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
  IonListHeader,
  AlertController,
  ModalController,
  ActionSheetController,
} from "@ionic/angular/standalone";
import { Router } from "@angular/router";
import { addIcons } from "ionicons";
import {
  add,
  createOutline,
  settingsOutline,
  trash,
  trashOutline,
  personOutline,
  bookmark,
  bookmarkOutline,
  checkmark,
  close,
} from "ionicons/icons";
import { ChildBudget } from "../../core/models";
import { BudgetStore } from "../../core/budget.store";
import { AddChildModalComponent } from "./add-child-modal.component";
import { CreateGroupModalComponent } from "./create-group-modal.component";
import { SelectBudgetsModalComponent } from "./select-budgets-modal.component";

interface BudgetGroup {
  groupName: string | null;
  budgets: ChildBudget[];
  totalBalance: number;
}

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
  private actionSheetController = inject(ActionSheetController);

  readonly budgetGroups = computed(() => {
    const budgets = this.store.children();
    const grouped = new Map<string | null, ChildBudget[]>();

    for (const budget of budgets) {
      const key = budget.groupName ?? null;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(budget);
    }

    const groups: BudgetGroup[] = [];

    // Primero los sin grupo
    if (grouped.has(null)) {
      groups.push({
        groupName: null,
        budgets: grouped.get(null)!,
        totalBalance: grouped.get(null)!.reduce((sum, b) => sum + b.balance, 0),
      });
    }

    // Luego los agrupados (ordenados por nombre)
    const sortedKeys = Array.from(grouped.keys())
      .filter((key) => key !== null)
      .sort() as string[];

    for (const key of sortedKeys) {
      const budgets = grouped.get(key)!;
      groups.push({
        groupName: key,
        budgets,
        totalBalance: budgets.reduce((sum, b) => sum + b.balance, 0),
      });
    }

    return groups;
  });

  constructor() {
    addIcons({
      personOutline,
      trashOutline,
      add,
      settingsOutline,
      createOutline,
      trash,
      bookmark,
      bookmarkOutline,
      checkmark,
      close,
    });
  }

  async addBudget(): Promise<void> {
    const modal = await this.modalController.create({
      component: AddChildModalComponent,
      initialBreakpoint: 0.6,
      breakpoints: [0, 0.6, 1],
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role === "confirm" && data?.name) {
      await this.store.addChild(data.name);
    }
  }

  openSettings(): void {
    void this.router.navigateByUrl("/tabs/ajustes");
  }

  openBudget(budgetId: string): void {
    void this.router.navigate(["/tabs/nino", budgetId]);
  }

  async assignGroupToBudget(
    budgetId: string,
    currentGroup: string | undefined,
  ): Promise<void> {
    // Obtener grupos existentes
    const existingGroups = Array.from(
      new Set(
        this.store
          .children()
          .map((c) => c.groupName)
          .filter((g): g is string => !!g),
      ),
    ).sort();

    const buttons: any[] = [];

    // Agregar botón para cada grupo existente
    for (const group of existingGroups) {
      buttons.push({
        text: group,
        icon: currentGroup === group ? "checkmark" : undefined,
        handler: async () => {
          await this.store.assignGroupToChild(budgetId, group);
        },
      });
    }

    // Botón para crear nuevo grupo
    buttons.push({
      text: "Crear nuevo grupo...",
      icon: "add",
      handler: async () => {
        await this.createNewGroup(budgetId);
      },
    });

    // Botón para quitar grupo
    buttons.push({
      text: "Sin grupo",
      icon: currentGroup === undefined ? "checkmark" : "close",
      role: "destructive",
      handler: async () => {
        await this.store.assignGroupToChild(budgetId, null);
      },
    });

    // Botón cancelar
    buttons.push({
      text: "Cancelar",
      role: "cancel",
    });

    const actionSheet = await this.actionSheetController.create({
      header: "Asignar a grupo",
      buttons,
    });

    await actionSheet.present();
  }

  private async createNewGroup(budgetId: string): Promise<void> {
    // Primero mostrar lista de presupuestos para seleccionar
    const allBudgets = this.store.children();
    const budgetsWithoutGroup = allBudgets.filter(
      (b) =>
        !b.groupName ||
        b.groupName === allBudgets.find((c) => c.id === budgetId)?.groupName,
    );

    const selectModal = await this.modalController.create({
      component: SelectBudgetsModalComponent,
      componentProps: {
        budgets: budgetsWithoutGroup,
        currentBudgetId: budgetId,
      },
      initialBreakpoint: 0.8,
      breakpoints: [0, 0.8, 1],
    });

    await selectModal.present();

    const { data: selectedBudgetIds, role: selectRole } =
      await selectModal.onWillDismiss();
    if (
      selectRole !== "confirm" ||
      !selectedBudgetIds ||
      selectedBudgetIds.length === 0
    ) {
      return;
    }

    // Luego pedir el nombre del grupo
    const nameModal = await this.modalController.create({
      component: CreateGroupModalComponent,
      initialBreakpoint: 0.4,
      breakpoints: [0, 0.4],
    });

    await nameModal.present();

    const { data: groupName, role: nameRole } = await nameModal.onWillDismiss();
    if (nameRole === "confirm" && groupName) {
      await this.store.assignGroupToMultipleChildren(
        selectedBudgetIds,
        groupName,
      );
    }
  }

  getBalanceClass(balance: number): string {
    if (balance < 0) return "pn-balance--negative";
    if (balance > 0) return "pn-balance--positive";
    return "pn-balance--zero";
  }

  async deleteBudget(budgetId: string, budgetName: string): Promise<void> {
    const alert = await this.alertController.create({
      header: "Eliminar presupuesto",
      message: `¿Estás seguro de que quieres eliminar el presupuesto de ${budgetName}? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: "Cancelar",
          role: "cancel",
        },
        {
          text: "Eliminar",
          role: "destructive",
          handler: async () => {
            await this.store.deleteChild(budgetId);
          },
        },
      ],
    });

    await alert.present();
  }
}
