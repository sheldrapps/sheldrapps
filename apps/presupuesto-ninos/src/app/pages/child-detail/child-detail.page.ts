import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  computed,
  effect,
  inject,
} from "@angular/core";
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
import {
  type CoverCropState,
  type CropFormatOption,
  type CropperResult,
  ImagePipelineService,
} from "@sheldrapps/image-workflow";
import { EditorSessionService } from "@sheldrapps/image-workflow/editor";
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
import { CreateExpenseGroupModalComponent } from "./create-expense-group-modal.component";
import { SelectExpensesModalComponent } from "./select-expenses-modal.component";

interface ExpenseGroup {
  groupName: string | null;
  expenses: Expense[];
  subtotal: number;
}

const AVATAR_FORMAT: CropFormatOption = {
  id: "avatar-square",
  label: "1:1",
  target: {
    // Keep enough detail for the circular UI while limiting persisted base64 size.
    width: 512,
    height: 512,
  },
};

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
  @ViewChild("imageInput") imageInput?: ElementRef<HTMLInputElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertController = inject(AlertController);
  private modalController = inject(ModalController);
  private actionSheetController = inject(ActionSheetController);
  private toastController = inject(ToastController);
  private editorSession = inject(EditorSessionService);
  private imagePipe = inject(ImagePipelineService);
  private zone = inject(NgZone);
  private changeDetector = inject(ChangeDetectorRef);

  readonly store = inject(BudgetStore);
  readonly childId = this.route.snapshot.paramMap.get("id") ?? "";
  readonly child = computed(
    () =>
      this.store.children().find((item) => item.id === this.childId) ?? null,
  );

  isOpeningCropper = false;
  private lastEditorSessionId?: string;
  private workingImageFile?: File;
  private editorSourceFile?: File;
  private cropState?: CoverCropState;

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

  async updateCreditAmount(value: string | null | undefined): Promise<void> {
    await this.store.setChildCreditAmount(this.childId, Number(value ?? 0));
  }

  selectImage(): void {
    this.imageInput?.nativeElement.click();
  }

  ionViewWillEnter(): void {
    void this.consumeEditorResult();
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    let shouldOpenEditor = false;
    this.setBusy(true);

    try {
      shouldOpenEditor = await this.applyImageSource(file);
    } catch (error) {
      console.error("Error in file change handler:", error);
    } finally {
      this.setBusy(false);
      await this.flushUi();
      input.value = "";
    }

    if (shouldOpenEditor) {
      await this.startCrop();
    }
  }

  private async applyImageSource(file: File): Promise<boolean> {
    this.cropState = undefined;
    let source = file;

    const basicErr = this.imagePipe.validateBasic(source);
    if (basicErr) {
      return false;
    }

    source = await this.imagePipe.materializeFile(source);

    let originalDims = await this.imagePipe.getDimensions(source);
    if (!originalDims) {
      const normalized = await this.imagePipe.normalizeFile(source);
      if (normalized) {
        source = normalized;
        originalDims = await this.imagePipe.getDimensions(source);
      }
    }

    if (!originalDims) {
      return false;
    }

    const working = await this.imagePipe.prepareWorkingImage(source);
    this.workingImageFile = working;
    this.editorSourceFile = working;
    return true;
  }

  private async startCrop(): Promise<void> {
    const sourceFile = this.editorSourceFile ?? this.workingImageFile;
    if (!sourceFile) return;

    const sid = this.editorSession.createSession({
      file: sourceFile,
      target: {
        width: AVATAR_FORMAT.target.width,
        height: AVATAR_FORMAT.target.height,
      },
      initialState: this.cropState,
      tools: {
        formats: {
          options: [AVATAR_FORMAT],
          selectedId: AVATAR_FORMAT.id,
        },
        fill: false,
        adjustments: false,
        text: false,
      },
      preview: {
        maskShape: "circle",
      },
      returnUrl: this.getEditorReturnUrl(),
    });

    this.lastEditorSessionId = sid;
    await this.router.navigate(["/editor/tools"], {
      queryParams: { sid },
    });
  }

  private getEditorReturnUrl(): string {
    const current = this.router.url;
    if (current.startsWith("/tabs/")) return current;
    return `/tabs/nino/${this.childId}`;
  }

  private async consumeEditorResult(): Promise<void> {
    let result: CropperResult | null = null;

    if (this.lastEditorSessionId) {
      result = this.editorSession.consumeResult(this.lastEditorSessionId);
      this.lastEditorSessionId = undefined;
    }

    if (!result) {
      result = this.editorSession.consumeLatestResult();
    }

    if (result) {
      await this.applyEditorResult(result);
    }
  }

  private async applyEditorResult(result: CropperResult): Promise<void> {
    if (result.state) {
      this.cropState = result.state;
    }
    this.workingImageFile = result.file;
    const imageSource = result.renderedBlob ?? result.file;
    await this.saveImageAsBase64(imageSource);

    const toast = await this.toastController.create({
      message: "Foto actualizada",
      duration: 2000,
      position: "bottom",
      color: "success",
    });
    await toast.present();
  }

  private async saveImageAsBase64(source: Blob): Promise<void> {
    try {
      const base64 = await this.readAsDataUrl(source);
      await this.store.setChildImage(this.childId, base64);
    } catch (error) {
      console.error("Error saving image:", error);
    }
  }

  private readAsDataUrl(source: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(source);
    });
  }

  private setBusy(next: boolean): void {
    this.isOpeningCropper = next;
  }

  private runInZone<T>(fn: () => T): T {
    return NgZone.isInAngularZone() ? fn() : this.zone.run(fn);
  }

  private async flushUi(): Promise<void> {
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }
    this.runInZone(() => {
      this.changeDetector.markForCheck();
      this.changeDetector.detectChanges();
    });
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
