export type IsoDate = string;

export interface Expense {
  id: string;
  label: string;
  amount: number;
  createdAt: IsoDate;
}

export type ChildGender = 'nino' | 'nina';

export interface ChildBudget {
  id: string;
  name: string;
  gender: ChildGender;
  balance: number;
  creditAmount: number;
  createdAt: IsoDate;
  lastCreditAt: IsoDate | null;
  expenses: Expense[];
}

export interface AppSettings {
  defaultCreditAmount: number;
  creditDays: number[];
  useFebruaryOverride: boolean;
  februaryDayOverride: number;
}