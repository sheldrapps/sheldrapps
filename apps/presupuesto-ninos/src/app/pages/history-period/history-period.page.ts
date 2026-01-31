import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonList,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDown, chevronForward } from 'ionicons/icons';
import { BudgetStore } from '../../core/budget.store';
import { BudgetPeriod } from '../../core/models';
import { signal } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-history-period',
  templateUrl: './history-period.page.html',
  styleUrls: ['./history-period.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonIcon,
  ],
})
export class HistoryPeriodPage {
  private store = inject(BudgetStore);
  private route = inject(ActivatedRoute);

  childId = this.route.snapshot.paramMap.get('id') ?? '';
  
  child = computed(() => 
    this.store.children().find((c) => c.id === this.childId) ?? null
  );
  
  expandedPeriods = signal<Set<string>>(new Set());

  // Incluye el período actual y los históricos
  allPeriods = computed(() => {
    const current = this.child();
    if (!current) return [];

    const periods: BudgetPeriod[] = [];

    // Período actual (en curso)
    if (current.expenses.length > 0 || current.balance > 0) {
      periods.push({
        id: 'current',
        startDate: current.lastCreditAt ?? current.createdAt,
        endDate: null,
        creditAmount: current.creditAmount,
        expenses: current.expenses,
      });
    }

    // Períodos históricos
    periods.push(...(current.periods ?? []));

    return periods;
  });

  constructor() {
    addIcons({ chevronDown, chevronForward });
  }

  togglePeriod(periodId: string): void {
    const expanded = new Set(this.expandedPeriods());
    if (expanded.has(periodId)) {
      expanded.delete(periodId);
    } else {
      expanded.add(periodId);
    }
    this.expandedPeriods.set(expanded);
  }

  isPeriodExpanded(periodId: string): boolean {
    return this.expandedPeriods().has(periodId);
  }

  formatDate(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  calculatePeriodBalance(period: BudgetPeriod): number {
    const totalExpenses = period.expenses.reduce((sum, exp) => sum + exp.amount, 0);
    return period.creditAmount - totalExpenses;
  }

  calculateTotalExpenses(period: BudgetPeriod): number {
    return period.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  }

  getBalanceClass(balance: number): string {
    if (balance < 0) return 'pn-balance--negative';
    if (balance > 0) return 'pn-balance--positive';
    return 'pn-balance--zero';
  }
}
