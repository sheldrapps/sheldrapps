export type IsoDate = string;

export interface Expense {
  id: string;
  label: string;
  amount: number;
  createdAt: IsoDate;
  groupName?: string;
}

export type AccountEntryType = "income" | "expense" | "credit";

export interface AccountEntry {
  id: string;
  type: AccountEntryType;
  label: string;
  amount: number;
  createdAt: IsoDate;
  childId?: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  createdAt: IsoDate;
  entries: AccountEntry[];
}

export interface BudgetPeriod {
  id: string;
  startDate: IsoDate;
  endDate: IsoDate | null; // null si es período actual
  creditAmount: number; // Lo que se abonó en este período
  expenses: Expense[]; // Gastos de este período
}

export type ChildGender = "nino" | "nina";
export type CreditScheduleType =
  | "specific_days"
  | "biweekly"
  | "monthly"
  | "weekly";
export type BiweeklySecondPayDay = 30 | 31;

export interface ChildBudget {
  id: string;
  name: string;
  gender: ChildGender;
  accountId?: string;
  balance: number;
  creditAmount: number;
  createdAt: IsoDate;
  lastCreditAt: IsoDate | null;
  expenses: Expense[]; // Gastos del período actual
  periods: BudgetPeriod[]; // Histórico de períodos
  imageThumb?: string; // Base64 encoded image thumbnail
  groupName?: string; // Group for presupuestos
}

export interface AppSettings {
  defaultCreditAmount: number;
  creditScheduleType: CreditScheduleType;
  creditDays: number[];
  monthlyCreditDay: number;
  weeklyCreditDay: number;
  biweeklySecondPayDay: BiweeklySecondPayDay;
}
