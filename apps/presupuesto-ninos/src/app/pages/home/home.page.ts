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
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  AlertController,
  ModalController,
  ActionSheetController,
} from "@ionic/angular/standalone";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { Router } from "@angular/router";
import { addIcons } from "ionicons";
import {
  add,
  addCircleOutline,
  bookmarkOutline,
  cardOutline,
  cashOutline,
  checkmark,
  close,
  createOutline,
  personOutline,
  removeCircleOutline,
  trashOutline,
} from "ionicons/icons";
import { Account, ChildBudget } from "../../core/models";
import { BudgetStore } from "../../core/budget.store";
import { AddChildModalComponent } from "./add-child-modal.component";
import { CreateGroupModalComponent } from "./create-group-modal.component";
import { SelectBudgetsModalComponent } from "./select-budgets-modal.component";

interface BudgetGroup {
  groupName: string | null;
  budgets: ChildBudget[];
  totalBalance: number;
}

interface AccountBudgetGroup {
  accountId: string | null;
  accountName: string | null;
  accountBalance: number | null;
  budgetsTotalBalance: number;
  budgetGroups: BudgetGroup[];
}

@Component({
  standalone: true,
  selector: "app-home",
  templateUrl: "./home.page.html",
  styleUrls: ["./home.page.scss"],
  imports: [
    CommonModule,
    TranslateModule,
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
  private translate = inject(TranslateService);

  readonly budgetAccountGroups = computed(() => {
    const accounts = [...this.store.accounts()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const knownAccountIds = new Set(accounts.map((account) => account.id));
    const grouped = new Map<string | null, ChildBudget[]>();

    for (const budget of this.store.children()) {
      const key =
        budget.accountId && knownAccountIds.has(budget.accountId)
          ? budget.accountId
          : null;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(budget);
    }

    const groups: AccountBudgetGroup[] = [];

    if (grouped.has(null)) {
      const budgetGroups = this.groupBudgets(grouped.get(null)!);
      groups.push({
        accountId: null,
        accountName: null,
        accountBalance: null,
        budgetsTotalBalance: this.sumBudgetGroupBalances(budgetGroups),
        budgetGroups,
      });
    }

    for (const account of accounts) {
      const budgetGroups = this.groupBudgets(grouped.get(account.id) ?? []);
      groups.push({
        accountId: account.id,
        accountName: account.name,
        accountBalance: account.balance,
        budgetsTotalBalance: this.sumBudgetGroupBalances(budgetGroups),
        budgetGroups,
      });
    }

    return groups;
  });

  constructor() {
    addIcons({
      personOutline,
      trashOutline,
      add,
      addCircleOutline,
      createOutline,
      bookmarkOutline,
      cardOutline,
      cashOutline,
      removeCircleOutline,
      checkmark,
      close,
    });
  }

  async openAddMenu(): Promise<void> {
    const actionSheet = await this.actionSheetController.create({
      header: this.t("HOME.ADD_MENU.TITLE"),
      buttons: [
        {
          text: this.t("HOME.ADD_MENU.BUDGET"),
          icon: "add",
          handler: async () => {
            await this.addBudget();
          },
        },
        {
          text: this.t("HOME.ADD_MENU.ACCOUNT"),
          icon: "card-outline",
          handler: async () => {
            await this.promptCreateAccount();
          },
        },
        {
          text: this.t("COMMON.CANCEL"),
          role: "cancel",
        },
      ],
    });

    await actionSheet.present();
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

  openBudget(budgetId: string): void {
    void this.router.navigate(["/tabs/nino", budgetId]);
  }

  async assignAccountToBudget(
    budgetId: string,
    currentAccountId: string | undefined,
  ): Promise<void> {
    const accounts = [...this.store.accounts()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    const buttons: any[] = accounts.map((account) => ({
      text: account.name,
      icon: currentAccountId === account.id ? "checkmark" : undefined,
      handler: async () => {
        await this.store.assignAccountToChild(budgetId, account.id);
      },
    }));

    buttons.push({
      text: this.t("HOME.ACCOUNT.CREATE_NEW"),
      icon: "add",
      handler: async () => {
        await this.promptCreateAccount(budgetId);
      },
    });

    buttons.push({
      text: this.t("HOME.ACCOUNT.NONE"),
      icon: currentAccountId === undefined ? "checkmark" : "close",
      role: "destructive" as const,
      handler: async () => {
        await this.store.assignAccountToChild(budgetId, null);
      },
    });

    buttons.push({
      text: this.t("COMMON.CANCEL"),
      role: "cancel" as const,
    });

    const actionSheet = await this.actionSheetController.create({
      header: this.t("HOME.ACCOUNT.ASSIGN_TITLE"),
      buttons,
    });

    await actionSheet.present();
  }

  async assignGroupToBudget(
    budgetId: string,
    currentGroup: string | undefined,
  ): Promise<void> {
    const existingGroups = Array.from(
      new Set(
        this.store
          .children()
          .map((child) => child.groupName)
          .filter((group): group is string => !!group),
      ),
    ).sort();

    const buttons: any[] = existingGroups.map((group) => ({
      text: group,
      icon: currentGroup === group ? "checkmark" : undefined,
      handler: async () => {
        await this.store.assignGroupToChild(budgetId, group);
      },
    }));

    buttons.push({
      text: this.t("HOME.GROUP.CREATE_NEW"),
      icon: "add",
      handler: async () => {
        await this.createNewGroup(budgetId);
      },
    });

    buttons.push({
      text: this.t("HOME.GROUP.NONE"),
      icon: currentGroup === undefined ? "checkmark" : "close",
      role: "destructive" as const,
      handler: async () => {
        await this.store.assignGroupToChild(budgetId, null);
      },
    });

    buttons.push({
      text: this.t("COMMON.CANCEL"),
      role: "cancel" as const,
    });

    const actionSheet = await this.actionSheetController.create({
      header: this.t("HOME.GROUP.ASSIGN_TITLE"),
      buttons,
    });

    await actionSheet.present();
  }

  async openAccountActions(accountId: string | null): Promise<void> {
    if (!accountId) {
      return;
    }

    const account = this.store.accounts().find((item) => item.id === accountId);
    if (!account) {
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: account.name,
      buttons: [
        {
          text: this.t("HOME.ACCOUNT.ADD_INCOME"),
          icon: "add-circle-outline",
          handler: async () => {
            await this.promptAccountMovement(account, "income");
          },
        },
        {
          text: this.t("HOME.ACCOUNT.ADD_EXPENSE"),
          icon: "remove-circle-outline",
          handler: async () => {
            await this.promptAccountMovement(account, "expense");
          },
        },
        {
          text: this.t("HOME.ACCOUNT.EDIT_BALANCE"),
          icon: "cash-outline",
          handler: async () => {
            await this.promptEditAccountBalance(account);
          },
        },
        {
          text: this.t("HOME.ACCOUNT.RENAME"),
          icon: "create-outline",
          handler: async () => {
            await this.promptRenameAccount(account);
          },
        },
        {
          text: this.t("COMMON.CANCEL"),
          role: "cancel",
        },
      ],
    });

    await actionSheet.present();
  }

  getBalanceClass(balance: number): string {
    if (balance < 0) return "pn-balance--negative";
    if (balance > 0) return "pn-balance--positive";
    return "pn-balance--zero";
  }

  async deleteBudget(budgetId: string, budgetName: string): Promise<void> {
    const alert = await this.alertController.create({
      header: this.t("HOME.DELETE_BUDGET.TITLE"),
      message: this.t("HOME.DELETE_BUDGET.MESSAGE", { name: budgetName }),
      buttons: [
        {
          text: this.t("COMMON.CANCEL"),
          role: "cancel",
        },
        {
          text: this.t("HOME.DELETE_BUDGET.CONFIRM"),
          role: "destructive",
          handler: async () => {
            await this.store.deleteChild(budgetId);
          },
        },
      ],
    });

    await alert.present();
  }

  private groupBudgets(budgets: ChildBudget[]): BudgetGroup[] {
    const grouped = new Map<string | null, ChildBudget[]>();

    for (const budget of budgets) {
      const key = budget.groupName ?? null;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(budget);
    }

    const groups: BudgetGroup[] = [];

    if (grouped.has(null)) {
      const ungrouped = grouped.get(null)!;
      groups.push({
        groupName: null,
        budgets: ungrouped,
        totalBalance: ungrouped.reduce((sum, item) => sum + item.balance, 0),
      });
    }

    const sortedKeys = Array.from(grouped.keys())
      .filter((key) => key !== null)
      .sort() as string[];

    for (const key of sortedKeys) {
      const groupBudgets = grouped.get(key)!;
      groups.push({
        groupName: key,
        budgets: groupBudgets,
        totalBalance: groupBudgets.reduce((sum, item) => sum + item.balance, 0),
      });
    }

    return groups;
  }

  private sumBudgetGroupBalances(groups: BudgetGroup[]): number {
    return groups.reduce((sum, group) => sum + group.totalBalance, 0);
  }

  private async createNewGroup(budgetId: string): Promise<void> {
    const allBudgets = this.store.children();
    const currentBudget = allBudgets.find((child) => child.id === budgetId);
    const budgetsWithoutGroup = allBudgets.filter(
      (budget) =>
        !budget.groupName || budget.groupName === currentBudget?.groupName,
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

  private async promptCreateAccount(assignBudgetId?: string): Promise<void> {
    const alert = await this.alertController.create({
      header: this.t("HOME.ACCOUNT.NEW_TITLE"),
      inputs: [
        {
          name: "name",
          type: "text",
          placeholder: this.t("HOME.ACCOUNT.NAME_PLACEHOLDER"),
        },
      ],
      buttons: [
        {
          text: this.t("COMMON.CANCEL"),
          role: "cancel",
        },
        {
          text: this.t("COMMON.SAVE"),
          handler: async (data) => {
            const accountId = await this.store.addAccount(data?.name ?? "");
            if (assignBudgetId && accountId) {
              await this.store.assignAccountToChild(assignBudgetId, accountId);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  private async promptRenameAccount(account: Account): Promise<void> {
    const alert = await this.alertController.create({
      header: this.t("HOME.ACCOUNT.RENAME"),
      inputs: [
        {
          name: "name",
          type: "text",
          value: account.name,
          placeholder: this.t("HOME.ACCOUNT.NAME_PLACEHOLDER"),
        },
      ],
      buttons: [
        {
          text: this.t("COMMON.CANCEL"),
          role: "cancel",
        },
        {
          text: this.t("COMMON.SAVE"),
          handler: async (data) => {
            await this.store.renameAccount(account.id, data?.name ?? "");
          },
        },
      ],
    });

    await alert.present();
  }

  private async promptEditAccountBalance(account: Account): Promise<void> {
    const alert = await this.alertController.create({
      header: this.t("HOME.ACCOUNT.EDIT_BALANCE"),
      inputs: [
        {
          name: "balance",
          type: "number",
          value: String(account.balance),
          placeholder: this.t("HOME.ACCOUNT.BALANCE_PLACEHOLDER"),
        },
      ],
      buttons: [
        {
          text: this.t("COMMON.CANCEL"),
          role: "cancel",
        },
        {
          text: this.t("COMMON.SAVE"),
          handler: async (data) => {
            await this.store.setAccountBalance(
              account.id,
              Number(data?.balance ?? account.balance),
            );
          },
        },
      ],
    });

    await alert.present();
  }

  private async promptAccountMovement(
    account: Account,
    type: "income" | "expense",
  ): Promise<void> {
    const alert = await this.alertController.create({
      header:
        type === "income"
          ? this.t("HOME.ACCOUNT.ADD_INCOME")
          : this.t("HOME.ACCOUNT.ADD_EXPENSE"),
      inputs: [
        {
          name: "label",
          type: "text",
          placeholder: this.t("HOME.ACCOUNT.MOVEMENT_LABEL_PLACEHOLDER"),
        },
        {
          name: "amount",
          type: "number",
          placeholder: this.t("HOME.ACCOUNT.MOVEMENT_AMOUNT_PLACEHOLDER"),
        },
      ],
      buttons: [
        {
          text: this.t("COMMON.CANCEL"),
          role: "cancel",
        },
        {
          text: this.t("COMMON.SAVE"),
          handler: async (data) => {
            const amount = Number(data?.amount ?? 0);
            const label = String(data?.label ?? "");
            if (type === "income") {
              await this.store.addAccountIncome(account.id, label, amount);
              return;
            }
            await this.store.addAccountExpense(account.id, label, amount);
          },
        },
      ],
    });

    await alert.present();
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params);
  }
}
