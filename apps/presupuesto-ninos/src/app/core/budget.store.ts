import { Injectable, inject, signal } from '@angular/core';
import {
  Account,
  AccountEntry,
  AppSettings,
  BiweeklySecondPayDay,
  ChildBudget,
  ChildGender,
  CreditScheduleType,
  Expense,
} from './models';
import { StorageRepo } from './storage.repo';
import { getScheduledDatesBetween } from './credit-engine';
import { createUuid } from './uuid';

const DEFAULT_SETTINGS: AppSettings = {
  defaultCreditAmount: 20,
  creditScheduleType: 'biweekly',
  creditDays: [15, 30],
  monthlyCreditDay: 15,
  weeklyCreditDay: 1,
  biweeklySecondPayDay: 30,
};

@Injectable({
  providedIn: "root",
})
export class BudgetStore {
  private repo = inject(StorageRepo);
  private initialized = false;

  readonly settings = signal<AppSettings>({ ...DEFAULT_SETTINGS });
  readonly accounts = signal<Account[]>([]);
  readonly children = signal<ChildBudget[]>([]);

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    const loadedSettings = (await this.repo.loadSettings()) ?? {};
    const merged = this.normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...loadedSettings,
    });

    this.settings.set(merged);

    const accounts = await this.repo.loadAccounts();
    this.accounts.set(accounts.map((account) => this.normalizeAccount(account)));

    const children = await this.repo.loadChildren();
    this.children.set(children.map((child) => this.normalizeChild(child)));

    await this.persistSettings();
    await this.persistAccounts();
    await this.persistChildren();
    await this.runCreditSweep();
  }

  async runCreditSweep(now: Date = new Date()): Promise<void> {
    const settings = this.settings();
    const nextAccounts = new Map(
      this.accounts().map((account) => [
        account.id,
        {
          ...account,
          entries: [...(account.entries ?? [])],
        },
      ]),
    );
    const updated = this.children().map((child) => {
      const fromExclusive = child.lastCreditAt
        ? new Date(child.lastCreditAt)
        : new Date(child.createdAt);

      const scheduled = getScheduledDatesBetween(fromExclusive, now, settings);

      if (scheduled.length === 0) {
        return child;
      }

      // Guardar período actual en histórico
      const newPeriods = [...(child.periods ?? [])];
      if (child.expenses.length > 0 || child.balance !== child.creditAmount) {
        newPeriods.push({
          id: createUuid(),
          startDate: fromExclusive.toISOString(),
          endDate: scheduled[scheduled.length - 1].toISOString(),
          creditAmount: child.creditAmount * scheduled.length,
          expenses: child.expenses,
        });
      }

      const lastApplied = scheduled[scheduled.length - 1];
      if (child.accountId) {
        const account = nextAccounts.get(child.accountId);
        if (account) {
          for (const appliedAt of scheduled) {
            account.balance -= child.creditAmount;
            account.entries.push(
              this.createAccountEntry({
                type: 'credit',
                label: `Abono: ${child.name}`,
                amount: child.creditAmount,
                createdAt: appliedAt.toISOString(),
                childId: child.id,
              }),
            );
          }
        }
      }

      return {
        ...child,
        balance: child.balance + child.creditAmount * scheduled.length,
        expenses: [],
        periods: newPeriods,
        lastCreditAt: lastApplied.toISOString(),
      };
    });

    this.accounts.set(Array.from(nextAccounts.values()));
    this.children.set(updated);
    await this.persistAccounts();
    await this.persistChildren();
  }

  async addChild(name: string, gender: ChildGender = "nino"): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const now = new Date();
    const settings = this.settings();
    const next: ChildBudget = {
      id: createUuid(),
      name: trimmed,
      gender,
      balance: 0,
      creditAmount: settings.defaultCreditAmount,
      createdAt: now.toISOString(),
      lastCreditAt: now.toISOString(),
      expenses: [],
      periods: [],
    };

    this.children.set([...this.children(), next]);
    await this.persistChildren();
  }

  async renameChild(childId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    this.children.set(
      this.children().map((child) =>
        child.id === childId ? { ...child, name: trimmed } : child,
      ),
    );
    await this.persistChildren();
  }

  async setChildCreditAmount(childId: string, amount: number): Promise<void> {
    const normalized = Math.max(0, Number(amount) || 0);

    this.children.set(
      this.children().map((child) =>
        child.id === childId ? { ...child, creditAmount: normalized } : child,
      ),
    );
    await this.persistChildren();
  }

  async setChildBalance(childId: string, newBalance: number): Promise<void> {
    const normalized = Number(newBalance);
    if (!Number.isFinite(normalized)) {
      return;
    }

    this.children.set(
      this.children().map((child) =>
        child.id === childId ? { ...child, balance: normalized } : child,
      ),
    );
    await this.persistChildren();
  }

  async setChildGender(childId: string, gender: ChildGender): Promise<void> {
    this.children.set(
      this.children().map((child) =>
        child.id === childId ? { ...child, gender } : child,
      ),
    );
    await this.persistChildren();
  }

  async setChildImage(
    childId: string,
    imageThumb: string | undefined,
  ): Promise<void> {
    this.children.set(
      this.children().map((child) =>
        child.id === childId ? { ...child, imageThumb } : child,
      ),
    );
    await this.persistChildren();
  }

  async addAccount(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    const next: Account = {
      id: createUuid(),
      name: trimmed,
      balance: 0,
      createdAt: new Date().toISOString(),
      entries: [],
    };

    this.accounts.set([...this.accounts(), next]);
    await this.persistAccounts();
    return next.id;
  }

  async renameAccount(accountId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    this.accounts.set(
      this.accounts().map((account) =>
        account.id === accountId ? { ...account, name: trimmed } : account,
      ),
    );
    await this.persistAccounts();
  }

  async setAccountBalance(accountId: string, newBalance: number): Promise<void> {
    const normalized = Number(newBalance);
    if (!Number.isFinite(normalized)) {
      return;
    }

    this.accounts.set(
      this.accounts().map((account) =>
        account.id === accountId ? { ...account, balance: normalized } : account,
      ),
    );
    await this.persistAccounts();
  }

  async addAccountIncome(
    accountId: string,
    label: string,
    amount: number,
  ): Promise<void> {
    await this.appendAccountEntry(accountId, 'income', label, amount);
  }

  async addAccountExpense(
    accountId: string,
    label: string,
    amount: number,
  ): Promise<void> {
    await this.appendAccountEntry(accountId, 'expense', label, amount);
  }

  async assignAccountToChild(
    childId: string,
    accountId: string | null,
  ): Promise<void> {
    this.children.set(
      this.children().map((child) =>
        child.id === childId
          ? { ...child, accountId: accountId ?? undefined }
          : child,
      ),
    );
    await this.persistChildren();
  }

  async assignAccountToMultipleChildren(
    childIds: string[],
    accountId: string,
  ): Promise<void> {
    const idSet = new Set(childIds);
    this.children.set(
      this.children().map((child) =>
        idSet.has(child.id) ? { ...child, accountId } : child,
      ),
    );
    await this.persistChildren();
  }

  async assignGroupToChild(
    childId: string,
    groupName: string | null,
  ): Promise<void> {
    this.children.set(
      this.children().map((child) =>
        child.id === childId
          ? { ...child, groupName: groupName ?? undefined }
          : child,
      ),
    );
    await this.persistChildren();
  }

  async assignGroupToMultipleChildren(
    childIds: string[],
    groupName: string,
  ): Promise<void> {
    const idSet = new Set(childIds);
    this.children.set(
      this.children().map((child) =>
        idSet.has(child.id) ? { ...child, groupName } : child,
      ),
    );
    await this.persistChildren();
  }

  async deleteChild(childId: string): Promise<void> {
    this.children.set(this.children().filter((child) => child.id !== childId));
    await this.persistChildren();
  }

  async addExpense(
    childId: string,
    label: string,
    amount: number,
  ): Promise<void> {
    const trimmed = label.trim();
    if (!trimmed) {
      return;
    }

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      return;
    }

    const expense: Expense = {
      id: createUuid(),
      label: trimmed,
      amount: normalizedAmount,
      createdAt: new Date().toISOString(),
    };

    this.children.set(
      this.children().map((child) => {
        if (child.id !== childId) {
          return child;
        }

        return {
          ...child,
          balance: child.balance - normalizedAmount,
          expenses: [...child.expenses, expense],
        };
      }),
    );
    await this.persistChildren();
  }

  async editExpense(
    childId: string,
    expenseId: string,
    patch: Partial<Pick<Expense, "label" | "amount" | "groupName">>,
  ): Promise<void> {
    this.children.set(
      this.children().map((child) => {
        if (child.id !== childId) {
          return child;
        }

        const expenses = child.expenses.map((expense) => {
          if (expense.id !== expenseId) {
            return expense;
          }

          const nextLabel = patch.label ?? expense.label;
          const nextAmount =
            patch.amount !== undefined ? Number(patch.amount) : expense.amount;

          const normalizedAmount =
            Number.isFinite(nextAmount) && nextAmount >= 0
              ? nextAmount
              : expense.amount;

          const nextGroupName =
            patch.groupName !== undefined ? patch.groupName : expense.groupName;

          return {
            ...expense,
            label: nextLabel,
            amount: normalizedAmount,
            groupName: nextGroupName,
          };
        });

        const oldExpense = child.expenses.find((e) => e.id === expenseId);
        const newExpense = expenses.find((e) => e.id === expenseId);

        if (!oldExpense || !newExpense) {
          return child;
        }

        const delta = newExpense.amount - oldExpense.amount;

        return {
          ...child,
          balance: child.balance - delta,
          expenses,
        };
      }),
    );
    await this.persistChildren();
  }

  async assignGroupToMultipleExpenses(
    childId: string,
    expenseIds: string[],
    groupName: string,
  ): Promise<void> {
    const idSet = new Set(expenseIds);
    this.children.set(
      this.children().map((child) => {
        if (child.id !== childId) {
          return child;
        }

        return {
          ...child,
          expenses: child.expenses.map((expense) =>
            idSet.has(expense.id) ? { ...expense, groupName } : expense,
          ),
        };
      }),
    );
    await this.persistChildren();
  }

  async deleteExpense(childId: string, expenseId: string): Promise<void> {
    this.children.set(
      this.children().map((child) => {
        if (child.id !== childId) {
          return child;
        }

        const expense = child.expenses.find((item) => item.id === expenseId);
        const nextExpenses = child.expenses.filter(
          (item) => item.id !== expenseId,
        );

        if (!expense) {
          return child;
        }

        return {
          ...child,
          balance: child.balance + expense.amount,
          expenses: nextExpenses,
        };
      }),
    );
    await this.persistChildren();
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<void> {
    const merged = this.normalizeSettings({
      ...this.settings(),
      ...patch,
    });

    this.settings.set(merged);
    await this.persistSettings();
    await this.runCreditSweep();
  }

  private normalizeSettings(raw: Partial<AppSettings>): AppSettings {
    const creditDays = this.normalizeCreditDays(raw.creditDays);
    const creditScheduleType = this.normalizeCreditScheduleType(
      raw.creditScheduleType,
      creditDays,
    );

    return {
      defaultCreditAmount: Math.max(0, Number(raw.defaultCreditAmount) || 0),
      creditScheduleType,
      creditDays,
      monthlyCreditDay: this.normalizeMonthDay(raw.monthlyCreditDay),
      weeklyCreditDay: this.normalizeWeekday(raw.weeklyCreditDay),
      biweeklySecondPayDay: this.normalizeBiweeklySecondPayDay(
        raw.biweeklySecondPayDay,
        creditDays,
      ),
    };
  }

  private normalizeCreditDays(days: number[] | undefined): number[] {
    const unique = new Set<number>();
    for (const day of days ?? []) {
      const normalized = Math.max(1, Math.min(31, Math.floor(Number(day))));
      if (Number.isFinite(normalized)) {
        unique.add(normalized);
      }
    }

    const values = Array.from(unique.values()).sort((a, b) => a - b);
    return values.length > 0 ? values : [...DEFAULT_SETTINGS.creditDays];
  }

  private normalizeMonthDay(value: number | undefined): number {
    const normalized = Math.floor(Number(value));
    if (!Number.isFinite(normalized)) {
      return DEFAULT_SETTINGS.monthlyCreditDay;
    }

    return Math.max(1, Math.min(31, normalized));
  }

  private normalizeWeekday(value: number | undefined): number {
    const normalized = Math.floor(Number(value));
    if (!Number.isFinite(normalized)) {
      return DEFAULT_SETTINGS.weeklyCreditDay;
    }

    return Math.max(1, Math.min(7, normalized));
  }

  private normalizeBiweeklySecondPayDay(
    value: number | undefined,
    creditDays: number[],
  ): BiweeklySecondPayDay {
    if (Number(value) === 31) {
      return 31;
    }

    if (creditDays.length === 2 && creditDays[0] === 15 && creditDays[1] === 31) {
      return 31;
    }

    return 30;
  }

  private normalizeCreditScheduleType(
    value: CreditScheduleType | undefined,
    creditDays: number[],
  ): CreditScheduleType {
    if (
      value === 'specific_days' ||
      value === 'biweekly' ||
      value === 'monthly' ||
      value === 'weekly'
    ) {
      return value;
    }

    if (creditDays.length === 2 && creditDays[0] === 15 && creditDays[1] === 30) {
      return 'biweekly';
    }

    if (creditDays.length === 2 && creditDays[0] === 15 && creditDays[1] === 31) {
      return 'biweekly';
    }

    return 'specific_days';
  }

  private normalizeChild(child: ChildBudget): ChildBudget {
    const now = new Date().toISOString();
    return {
      ...child,
      accountId: child.accountId ?? undefined,
      gender: child.gender ?? "nino",
      creditAmount: child.creditAmount ?? this.settings().defaultCreditAmount,
      createdAt: child.createdAt ?? now,
      lastCreditAt: child.lastCreditAt ?? now,
      expenses: child.expenses ?? [],
      periods: child.periods ?? [],
    };
  }

  private normalizeAccount(account: Account): Account {
    const now = new Date().toISOString();
    return {
      ...account,
      name: (account.name ?? '').trim() || 'Cuenta',
      balance: Number(account.balance) || 0,
      createdAt: account.createdAt ?? now,
      entries: Array.isArray(account.entries)
        ? account.entries.map((entry) => this.normalizeAccountEntry(entry))
        : [],
    };
  }

  private normalizeAccountEntry(entry: AccountEntry): AccountEntry {
    return {
      ...entry,
      type:
        entry.type === 'income' || entry.type === 'expense' || entry.type === 'credit'
          ? entry.type
          : 'expense',
      label: (entry.label ?? '').trim() || 'Movimiento',
      amount: Math.max(0, Number(entry.amount) || 0),
      createdAt: entry.createdAt ?? new Date().toISOString(),
      childId: entry.childId ?? undefined,
    };
  }

  private createAccountEntry(
    entry: Omit<AccountEntry, 'id'>,
  ): AccountEntry {
    return {
      id: createUuid(),
      ...entry,
    };
  }

  private async appendAccountEntry(
    accountId: string,
    type: 'income' | 'expense',
    label: string,
    amount: number,
  ): Promise<void> {
    const trimmed = label.trim();
    const normalizedAmount = Number(amount);
    if (!trimmed || !Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      return;
    }

    this.accounts.set(
      this.accounts().map((account) => {
        if (account.id !== accountId) {
          return account;
        }

        const nextEntry = this.createAccountEntry({
          type,
          label: trimmed,
          amount: normalizedAmount,
          createdAt: new Date().toISOString(),
        });

        return {
          ...account,
          balance:
            type === 'income'
              ? account.balance + normalizedAmount
              : account.balance - normalizedAmount,
          entries: [...account.entries, nextEntry],
        };
      }),
    );
    await this.persistAccounts();
  }

  private async persistSettings(): Promise<void> {
    await this.repo.saveSettings(this.settings());
  }

  private async persistAccounts(): Promise<void> {
    await this.repo.saveAccounts(this.accounts());
  }

  private async persistChildren(): Promise<void> {
    await this.repo.saveChildren(this.children());
  }
}
