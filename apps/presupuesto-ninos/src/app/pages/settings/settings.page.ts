import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { BudgetStore } from '../../core/budget.store';

@Component({
  standalone: true,
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
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
    IonToggle,
    IonButton,
  ],
})
export class SettingsPage {
  private store = inject(BudgetStore);

  form = {
    defaultCreditAmount: 0,
    creditDaysText: '',
    useFebruaryOverride: true,
    februaryDayOverride: 28,
  };

  constructor() {
    this.syncFromStore();
  }

  syncFromStore(): void {
    const settings = this.store.settings();
    this.form = {
      defaultCreditAmount: settings.defaultCreditAmount,
      creditDaysText: settings.creditDays.join(','),
      useFebruaryOverride: settings.useFebruaryOverride,
      februaryDayOverride: settings.februaryDayOverride,
    };
  }

  async saveSettings(): Promise<void> {
    const creditDays = this.parseCreditDays(this.form.creditDaysText);

    await this.store.updateSettings({
      defaultCreditAmount: Math.max(
        0,
        Number(this.form.defaultCreditAmount ?? 0)
      ),
      creditDays,
      useFebruaryOverride: this.form.useFebruaryOverride,
      februaryDayOverride: Number(this.form.februaryDayOverride ?? 28),
    });
  }

  async recalculate(): Promise<void> {
    await this.store.runCreditSweep();
  }

  private parseCreditDays(value: string): number[] {
    return value
      .split(',')
      .map((item) => Math.floor(Number(item.trim())))
      .filter((item) => Number.isFinite(item) && item > 0);
  }
}