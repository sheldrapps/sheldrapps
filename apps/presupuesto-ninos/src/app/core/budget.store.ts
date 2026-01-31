import { Injectable, signal } from '@angular/core';
import { AppSettings, ChildBudget, ChildGender, Expense } from './models';
import { StorageRepo } from './storage.repo';
import { getScheduledDatesBetween } from './credit-engine';
import { createUuid } from './uuid';

const DEFAULT_SETTINGS: AppSettings = {
  defaultCreditAmount: 20,
  creditDays: [15, 30],
  useFebruaryOverride: true,
  februaryDayOverride: 28,
};

@Injectable({
  providedIn: "root",
})
export class BudgetStore {
  private initialized = false;

  readonly settings = signal<AppSettings>({ ...DEFAULT_SETTINGS });
  readonly children = signal<ChildBudget[]>([]);

  constructor(private repo: StorageRepo) {}

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    const loadedSettings = (await this.repo.loadSettings()) ?? {};
    const merged = {
      ...DEFAULT_SETTINGS,
      ...loadedSettings,
    };

    merged.creditDays = this.normalizeCreditDays(merged.creditDays);
    merged.februaryDayOverride = this.normalizeFebruaryOverride(
      merged.februaryDayOverride,
    );

    this.settings.set(merged);

    const children = await this.repo.loadChildren();
    this.children.set(children.map((child) => this.normalizeChild(child)));

    await this.persistSettings();
    await this.persistChildren();
    await this.runCreditSweep();
  }

  async runCreditSweep(now: Date = new Date()): Promise<void> {
    const settings = this.settings();
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
      return {
        ...child,
        balance: child.balance + child.creditAmount * scheduled.length,
        expenses: [],
        periods: newPeriods,
        lastCreditAt: lastApplied.toISOString(),
      };
    });

    this.children.set(updated);
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
    const merged: AppSettings = {
      ...this.settings(),
      ...patch,
    };

    merged.defaultCreditAmount = Math.max(
      0,
      Number(merged.defaultCreditAmount) || 0,
    );

    merged.creditDays = this.normalizeCreditDays(merged.creditDays);
    merged.februaryDayOverride = this.normalizeFebruaryOverride(
      merged.februaryDayOverride,
    );

    this.settings.set(merged);
    await this.persistSettings();
    await this.runCreditSweep();
  }

  private normalizeCreditDays(days: number[]): number[] {
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

  private normalizeFebruaryOverride(value: number): number {
    const normalized = Math.floor(Number(value));
    if (!Number.isFinite(normalized)) {
      return DEFAULT_SETTINGS.februaryDayOverride;
    }

    return Math.max(1, Math.min(28, normalized));
  }

  private normalizeChild(child: ChildBudget): ChildBudget {
    const now = new Date().toISOString();
    return {
      ...child,
      gender: child.gender ?? "nino",
      creditAmount: child.creditAmount ?? this.settings().defaultCreditAmount,
      createdAt: child.createdAt ?? now,
      lastCreditAt: child.lastCreditAt ?? now,
      expenses: child.expenses ?? [],
      periods: child.periods ?? [],
    };
  }

  private async persistSettings(): Promise<void> {
    await this.repo.saveSettings(this.settings());
  }

  private async persistChildren(): Promise<void> {
    await this.repo.saveChildren(this.children());
  }
}