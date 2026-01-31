import { CommonModule } from "@angular/common";
import { Component, Input, computed, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  ActionSheetController,
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
  IonListHeader,
  IonTitle,
  IonToolbar,
  IonLoading,
  ModalController,
  ToastController,
} from "@ionic/angular/standalone";
import { addIcons } from "ionicons";
import {
  add,
  createOutline,
  trash,
  trashOutline,
  bookmark,
  bookmarkOutline,
  personOutline,
  cameraOutline,
  timeOutline,
  checkmark,
  close,
} from "ionicons/icons";
import { BudgetStore } from "../../core/budget.store";
import { Expense } from "../../core/models";
import {
  CoverCropperModalComponent,
  CropTarget,
  CoverCropState,
} from "@sheldrapps/image-workflow";
import { CreateExpenseGroupModalComponent } from "./create-expense-group-modal.component";
import { SelectExpensesModalComponent } from "./select-expenses-modal.component";

@Component({
  selector: "app-child-cropper-modal",
  standalone: true,
  imports: [CoverCropperModalComponent],
  template: `
    <app-cover-cropper-modal
      [file]="file!"
      [model]="model!"
      [initialState]="initialState"
      [onReady]="onReady"
      [title]="title"
      [cancelLabel]="cancelLabel"
      [doneLabel]="doneLabel"
    ></app-cover-cropper-modal>
  `,
})
export class ChildCropperModalComponent {
  @Input() file?: File;
  @Input() model?: CropTarget;
  @Input() initialState?: CoverCropState;
  @Input() onReady?: () => void;
  @Input() title = "Editar imagen";
  @Input() cancelLabel = "Cancelar";
  @Input() doneLabel = "Guardar";
}

interface ExpenseGroup {
  groupName: string | null;
  expenses: Expense[];
  subtotal: number;
}

@Component({
  standalone: true,
  selector: "app-child-detail",
  templateUrl: "./child-detail.page.html",
  styleUrls: ["./child-detail.page.scss"],
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
    IonListHeader,
    IonItem,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonLoading,
  ],
})
export class ChildDetailPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private modalController = inject(ModalController);
  private actionSheetController = inject(ActionSheetController);
  private toastController = inject(ToastController);

  readonly store = inject(BudgetStore);
  readonly childId = this.route.snapshot.paramMap.get("id") ?? "";
  readonly child = computed(
    () =>
      this.store.children().find((item) => item.id === this.childId) ?? null,
  );

  isOpeningCropper = false;

  readonly expenseGroups = computed(() => {
    const child = this.child();
    if (!child) return [];

    const groupMap = new Map<string | null, Expense[]>();

    for (const expense of child.expenses) {
      const groupKey = expense.groupName || null;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(expense);
    }

    const groups: ExpenseGroup[] = [];
    for (const [groupName, expenses] of groupMap.entries()) {
      const subtotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      groups.push({ groupName, expenses, subtotal });
    }

    // Sort: ungrouped items first, then alphabetically by group name
    groups.sort((a, b) => {
      if (a.groupName === null && b.groupName === null) return 0;
      if (a.groupName === null) return -1;
      if (b.groupName === null) return 1;
      return a.groupName.localeCompare(b.groupName);
    });

    return groups;
  });

  nameValue = "";

  constructor() {
    addIcons({
      personOutline,
      cameraOutline,
      add,
      createOutline,
      bookmarkOutline,
      trashOutline,
      trash,
      bookmark,
      checkmark,
      close,
    });

    effect(() => {
      const child = this.child();
      this.nameValue = child?.name ?? "";
    });
  }

  async saveName(): Promise<void> {
    await this.store.renameChild(this.childId, this.nameValue);
  }

  async updateCreditAmount(value: string | null): Promise<void> {
    await this.store.setChildCreditAmount(this.childId, Number(value ?? 0));
  }

  async selectImage(): Promise<void> {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = async (event: Event) => {
        try {
          const target = event.target as HTMLInputElement;
          const file = target.files?.[0];
          if (!file) {
            console.warn("No file selected");
            return;
          }
          console.log("File selected:", file.name, file.size, file.type);
          await this.openCropper(file);
        } catch (error) {
          console.error("Error in file change handler:", error);
        }
      };

      input.click();
    } catch (error) {
      console.error("Error selecting image:", error);
    }
  }

  async openCropper(file: File): Promise<void> {
    this.isOpeningCropper = true;

    let markReady!: () => void;
    const readyPromise = new Promise<void>((resolve) => (markReady = resolve));

    try {
      const modal = await this.modalController.create({
        component: ChildCropperModalComponent,
        componentProps: {
          file,
          model: { width: 256, height: 256 }, // 1:1 ratio for thumbnail
          title: "Editar imagen",
          cancelLabel: "Cancelar",
          doneLabel: "Guardar",
          onReady: () => markReady(),
        },
      });

      await modal.present();

      const dismissPromise = modal.onWillDismiss();

      // Esperar a que la imagen esté renderizada antes de ocultar el loading
      await Promise.race([readyPromise, dismissPromise.then(() => {})]);
      this.isOpeningCropper = false;

      const { data, role } = await dismissPromise;

      if (role === "done" && data?.file) {
        const croppedFile = data.file as File;
        await this.saveImageAsBase64(croppedFile);

        // Mostrar toast de éxito
        const toast = await this.toastController.create({
          message: "Foto actualizada",
          duration: 2000,
          position: "bottom",
          color: "success",
        });
        await toast.present();
      }
    } catch (error) {
      console.error("Error opening cropper:", error);
      this.isOpeningCropper = false;
    }
  }

  async saveImageAsBase64(file: File): Promise<void> {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          await this.store.setChildImage(this.childId, base64);
        } catch (error) {
          console.error("Error saving image:", error);
        }
      };
      reader.onerror = () => {
        console.error("Error reading file:", reader.error);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error in saveImageAsBase64:", error);
    }
  }

  async addExpense(): Promise<void> {
    const alert = await this.alertController.create({
      header: "Agregar gasto",
      inputs: [
        {
          name: "label",
          type: "text",
          placeholder: "Concepto",
        },
        {
          name: "amount",
          type: "number",
          placeholder: "Monto",
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
            await this.store.addExpense(
              this.childId,
              data?.label ?? "",
              Number(data?.amount ?? 0),
            );
          },
        },
      ],
    });

    await alert.present();
  }

  async updateExpenseLabel(
    expenseId: string,
    value: string | null,
  ): Promise<void> {
    await this.store.editExpense(this.childId, expenseId, {
      label: value ?? "",
    });
  }

  async updateExpenseAmount(
    expenseId: string,
    value: string | null,
  ): Promise<void> {
    const amount = Number(value ?? 0);
    await this.store.editExpense(this.childId, expenseId, { amount });
  }

  async deleteExpense(expenseId: string): Promise<void> {
    await this.store.deleteExpense(this.childId, expenseId);
  }

  async editBalance(currentBalance: number): Promise<void> {
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
              this.childId,
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

  async onAddExpense(): Promise<void> {
    await this.addExpense();
  }

  async onEditBalance(): Promise<void> {
    const child = this.child();
    if (child) {
      await this.editBalance(child.balance);
    }
  }

  async assignGroupToExpense(
    expenseId: string,
    currentGroupName?: string,
  ): Promise<void> {
    const child = this.child();
    if (!child) return;

    // Obtener grupos existentes de los gastos
    const existingGroups = Array.from(
      new Set(
        child.expenses.map((e) => e.groupName).filter((g): g is string => !!g),
      ),
    ).sort();

    const buttons: any[] = [];

    // Agregar botón para cada grupo existente
    for (const group of existingGroups) {
      buttons.push({
        text: group,
        icon: currentGroupName === group ? "checkmark" : undefined,
        handler: async () => {
          await this.store.editExpense(this.childId, expenseId, {
            groupName: group,
          });
        },
      });
    }

    // Botón para crear nuevo grupo
    buttons.push({
      text: "Crear nuevo grupo...",
      icon: "add",
      handler: async () => {
        await this.createNewExpenseGroup(expenseId);
      },
    });

    // Botón para quitar grupo
    buttons.push({
      text: "Sin grupo",
      icon: currentGroupName === undefined ? "checkmark" : "close",
      role: "destructive",
      handler: async () => {
        await this.store.editExpense(this.childId, expenseId, {
          groupName: undefined,
        });
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

  private async createNewExpenseGroup(expenseId: string): Promise<void> {
    const child = this.child();
    if (!child) return;

    // Obtener el grupo actual del gasto
    const currentExpense = child.expenses.find((e) => e.id === expenseId);

    // Primero mostrar lista de gastos para seleccionar
    const expensesWithoutGroup = child.expenses.filter(
      (e) => !e.groupName || e.groupName === currentExpense?.groupName,
    );

    const selectModal = await this.modalController.create({
      component: SelectExpensesModalComponent,
      componentProps: {
        expenses: expensesWithoutGroup,
        currentExpenseId: expenseId,
      },
      initialBreakpoint: 0.8,
      breakpoints: [0, 0.8, 1],
    });

    await selectModal.present();

    const { data: selectedExpenseIds, role: selectRole } =
      await selectModal.onWillDismiss();
    if (
      selectRole !== "confirm" ||
      !selectedExpenseIds ||
      selectedExpenseIds.length === 0
    ) {
      return;
    }

    // Luego pedir el nombre del grupo
    const nameModal = await this.modalController.create({
      component: CreateExpenseGroupModalComponent,
      initialBreakpoint: 0.4,
      breakpoints: [0, 0.4],
    });

    await nameModal.present();

    const { data: groupName, role: nameRole } = await nameModal.onWillDismiss();
    if (nameRole === "confirm" && groupName) {
      await this.store.assignGroupToMultipleExpenses(
        this.childId,
        selectedExpenseIds,
        groupName,
      );
    }
  }

  openHistory(): void {
    void this.router.navigate(["/tabs/history-period", this.childId]);
  }
}
