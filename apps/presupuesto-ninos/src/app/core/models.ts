export type IsoDate = string;

export interface Expense {
  id: string;
  label: string;
  amount: number;
  createdAt: IsoDate;
  groupName?: string;
}

export interface BudgetPeriod {
  id: string;
  startDate: IsoDate;
  endDate: IsoDate | null; // null si es período actual
  creditAmount: number; // Lo que se abonó en este período
  expenses: Expense[]; // Gastos de este período
}

export type ChildGender = "nino" | "nina";

export interface ChildBudget {
  id: string;
  name: string;
  gender: ChildGender;
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
  creditDays: number[];
  useFebruaryOverride: boolean;
  februaryDayOverride: number;
}