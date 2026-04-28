import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import {
  BiweeklySecondPayDay,
  CreditScheduleType,
} from '../../core/models';
import { BudgetStore } from '../../core/budget.store';

type WeekdayOption = {
  value: number;
  shortLabelKey: string;
  longLabelKey: string;
};

@Component({
  standalone: true,
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
  ],
})
export class SettingsPage {
  private store = inject(BudgetStore);

  readonly weekdays: readonly WeekdayOption[] = [
    {
      value: 1,
      shortLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY_SHORT.MON',
      longLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY.MON',
    },
    {
      value: 2,
      shortLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY_SHORT.TUE',
      longLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY.TUE',
    },
    {
      value: 3,
      shortLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY_SHORT.WED',
      longLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY.WED',
    },
    {
      value: 4,
      shortLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY_SHORT.THU',
      longLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY.THU',
    },
    {
      value: 5,
      shortLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY_SHORT.FRI',
      longLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY.FRI',
    },
    {
      value: 6,
      shortLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY_SHORT.SAT',
      longLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY.SAT',
    },
    {
      value: 7,
      shortLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY_SHORT.SUN',
      longLabelKey: 'SETTINGS.CREDIT_RULES.WEEKDAY.SUN',
    },
  ] as const;

  form = {
    defaultCreditAmount: 0,
    creditScheduleType: 'biweekly' as CreditScheduleType,
    creditDaysText: '',
    monthlyCreditDay: 15,
    weeklyCreditDay: 1,
    biweeklyUse31: false,
  };

  constructor() {
    this.syncFromStore();
  }

  get isSpecificDaysSchedule(): boolean {
    return this.form.creditScheduleType === 'specific_days';
  }

  get isBiweeklySchedule(): boolean {
    return this.form.creditScheduleType === 'biweekly';
  }

  get isMonthlySchedule(): boolean {
    return this.form.creditScheduleType === 'monthly';
  }

  get isWeeklySchedule(): boolean {
    return this.form.creditScheduleType === 'weekly';
  }

  syncFromStore(): void {
    const settings = this.store.settings();
    this.form = {
      defaultCreditAmount: settings.defaultCreditAmount,
      creditScheduleType: settings.creditScheduleType,
      creditDaysText: settings.creditDays.join(','),
      monthlyCreditDay: settings.monthlyCreditDay,
      weeklyCreditDay: settings.weeklyCreditDay,
      biweeklyUse31: settings.biweeklySecondPayDay === 31,
    };
  }

  async saveSettings(): Promise<void> {
    const creditDays = this.parseCreditDays(this.form.creditDaysText);
    const biweeklySecondPayDay: BiweeklySecondPayDay = this.form.biweeklyUse31
      ? 31
      : 30;

    await this.store.updateSettings({
      defaultCreditAmount: Math.max(
        0,
        Number(this.form.defaultCreditAmount ?? 0),
      ),
      creditScheduleType: this.form.creditScheduleType,
      creditDays,
      monthlyCreditDay: Number(this.form.monthlyCreditDay ?? 15),
      weeklyCreditDay: Number(this.form.weeklyCreditDay ?? 1),
      biweeklySecondPayDay,
    });
  }

  async recalculate(): Promise<void> {
    await this.store.runCreditSweep();
  }

  async onAdjustMonthlyCreditDay(delta: number): Promise<void> {
    const next = Math.max(
      1,
      Math.min(31, Number(this.form.monthlyCreditDay ?? 15) + delta),
    );
    this.form.monthlyCreditDay = next;
    await this.saveSettings();
  }

  async onWeeklyDaySelect(day: number): Promise<void> {
    if (this.form.weeklyCreditDay === day) {
      return;
    }

    this.form.weeklyCreditDay = day;
    await this.saveSettings();
  }

  private parseCreditDays(value: string): number[] {
    return value
      .split(',')
      .map((item) => Math.floor(Number(item.trim())))
      .filter((item) => Number.isFinite(item) && item > 0);
  }
}
