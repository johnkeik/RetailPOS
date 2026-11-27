import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { firebaseConfig } from '../../core/firebase/firebase.config';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { PeriodTotalsComponent, splitByPayment } from '../../shared/ui/period-totals.component';
import {
  InventoryRow,
  InventoryService,
  LOW_STOCK_ESSENCE_LITERS,
  LOW_STOCK_PERFUME_LITERS,
  LOW_STOCK_UNITS
} from '../inventory/inventory.service';
import { ExpensesService } from '../expenses/expenses.service';
import { SalesHistoryService } from '../sales-history/sales-history.service';
import { DashboardTempSeedService } from './dashboard-temp-seed.service';
import { mockCatalogData } from './temp-data/mock-catalog.data';

@Component({
  selector: 'app-dashboard-page',
  imports: [PageTitleComponent, RouterLink, PeriodTotalsComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss'
})
export class DashboardPageComponent implements OnInit {
  private readonly tempSeedService = inject(DashboardTempSeedService);
  private readonly inventoryService = inject(InventoryService);
  private readonly salesHistoryService = inject(SalesHistoryService);
  private readonly expensesService = inject(ExpensesService);

  protected readonly seedLoading = this.tempSeedService.loading;
  protected readonly seedStatus = this.tempSeedService.status;
  protected readonly seedError = this.tempSeedService.error;
  protected readonly productCategories = mockCatalogData.categories;
  /** Test-data tools only make sense against the local emulators, never on the live shop. */
  protected readonly showSeedTools = firebaseConfig.useEmulators;
  protected readonly stockThresholdDescription =
    `Όριο αναπλήρωσης: ${LOW_STOCK_PERFUME_LITERS.toLocaleString('el-GR')} L για βάσεις, ` +
    `${LOW_STOCK_ESSENCE_LITERS.toLocaleString('el-GR')} L για εσάνς, ${LOW_STOCK_UNITS} τεμάχια για συσκευασμένα.`;
  protected readonly inventoryLoading = this.inventoryService.loading;
  protected readonly salesLoading = this.salesHistoryService.loading;
  protected readonly inventoryError = this.inventoryService.error;
  protected readonly salesError = this.salesHistoryService.error;
  protected readonly orders = this.salesHistoryService.orders;
  protected readonly loading = computed(
    () => this.inventoryLoading() || this.salesLoading() || this.expensesService.loading()
  );

  protected readonly todayOrders = computed(() => {
    const today = new Date();
    return this.salesHistoryService.orders().filter((order) => {
      const createdAt = new Date(order.createdAt);
      return (
        order.status === 'COMPLETED' &&
        createdAt.getFullYear() === today.getFullYear() &&
        createdAt.getMonth() === today.getMonth() &&
        createdAt.getDate() === today.getDate()
      );
    });
  });

  protected readonly todaySales = computed(() =>
    this.todayOrders().reduce((sum, order) => sum + order.total, 0)
  );

  protected readonly averageOrder = computed(() => {
    const orders = this.todayOrders();
    return orders.length ? this.todaySales() / orders.length : 0;
  });

  protected readonly stockSummary = computed(() => {
    const rows = this.inventoryService.inventoryRows();
    const outOfStock = rows.filter((row) => row.quantity <= 0).length;
    const lowStock = rows.filter(
      (row) => row.quantity > 0 && this.isBelowStockThreshold(row)
    ).length;
    return { outOfStock, lowStock, needsAttention: outOfStock + lowStock };
  });

  protected readonly attentionRows = computed(() =>
    this.inventoryService
      .inventoryRows()
      .filter((row) => row.quantity <= 0 || this.isBelowStockThreshold(row))
      .sort((left, right) => {
        const leftEmpty = left.quantity <= 0;
        const rightEmpty = right.quantity <= 0;
        if (leftEmpty !== rightEmpty) return leftEmpty ? -1 : 1;
        return this.stockRatio(left) - this.stockRatio(right);
      })
      .slice(0, 6)
  );

  protected readonly recentOrders = computed(() =>
    this.salesHistoryService.orders().slice(0, 5)
  );

  protected readonly weeklySales = computed(() => {
    const orders = this.salesHistoryService.orders();
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
      const total = orders
        .filter((order) => {
          const createdAt = new Date(order.createdAt);
          return (
            order.status === 'COMPLETED' &&
            createdAt.getFullYear() === date.getFullYear() &&
            createdAt.getMonth() === date.getMonth() &&
            createdAt.getDate() === date.getDate()
          );
        })
        .reduce((sum, order) => sum + order.total, 0);
      return {
        label: date.toLocaleDateString('el-GR', { weekday: 'short' }),
        fullLabel: date.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' }),
        isToday: index === 6,
        amount: total
      };
    });
    const maxAmount = Math.max(...days.map((day) => day.amount), 0);
    return days.map((day) => ({
      ...day,
      // Keep a sliver visible for small but non-zero days.
      barPercent: maxAmount && day.amount ? Math.max((day.amount / maxAmount) * 100, 3) : 0
    }));
  });

  protected readonly weeklyTotal = computed(() =>
    this.weeklySales().reduce((sum, day) => sum + day.amount, 0)
  );

  protected readonly weeklyChartLabel = computed(() =>
    'Τζίρος τελευταίων 7 ημερών: ' +
    this.weeklySales()
      .map((day) => `${day.fullLabel} ${this.formatCurrency(day.amount)}`)
      .join(', ')
  );

  protected readonly currentDate = new Date().toLocaleDateString('el-GR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  protected async seedMockBrands(): Promise<void> {
    await this.tempSeedService.seedMockBrands();
  }

  protected async seedMockCategories(): Promise<void> {
    await this.tempSeedService.seedMockCategories();
  }

  protected async seedMockConsumables(): Promise<void> {
    await this.tempSeedService.seedMockConsumables();
  }

  protected async seedMockVariantTemplates(): Promise<void> {
    await this.tempSeedService.seedMockVariantTemplates();
  }

  protected async seedMockProducts(categoryCode: string): Promise<void> {
    await this.tempSeedService.seedMockProducts(categoryCode);
  }

  protected async seedMockInventory(): Promise<void> {
    await this.tempSeedService.seedMockInventory();
  }

  protected async seedMockSalesHistory(): Promise<void> {
    await this.tempSeedService.seedMockSalesHistory();
  }

  private readonly monthStart = (() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  })();

  protected readonly monthLabel = this.monthStart.toLocaleDateString('el-GR', { month: 'long' });

  /** This month's completed sales, split by payment method. */
  protected readonly monthIncome = computed(() => {
    const start = this.monthStart.getTime();
    const orders = this.salesHistoryService.orders().filter(
      (order) => order.status === 'COMPLETED' && new Date(order.createdAt).getTime() >= start
    );
    return splitByPayment(orders.map((order) => ({ amount: order.total, method: order.paymentMethod })));
  });

  /** This month's expenses; voided ones never count. */
  protected readonly monthExpenses = computed(() => {
    const start = this.monthStart.getTime();
    const expenses = this.expensesService.expenses().filter(
      (expense) => !expense.voided && expense.createdAt.getTime() >= start
    );
    return splitByPayment(expenses.map((expense) => ({ amount: expense.amount, method: expense.paymentMethod })));
  });

  protected readonly monthLoading = computed(() => this.salesLoading() || this.expensesService.loading());
  protected readonly expensesError = this.expensesService.error;

  ngOnInit(): void {
    void this.loadSales();
  }

  /**
   * Fetches only what the page shows: this month (for the month totals) and the last 7 days
   * (for the chart), whichever starts earlier. Never the whole order history.
   */
  private loadSales(): Promise<unknown> {
    const today = new Date();
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const from = weekStart < this.monthStart ? weekStart : this.monthStart;
    return Promise.all([
      this.salesHistoryService.loadOrders({ from }),
      this.expensesService.load({ from: this.monthStart, to: null })
    ]);
  }

  protected async refresh(): Promise<void> {
    await Promise.all([
      this.inventoryService.loadInventory(),
      this.loadSales()
    ]);
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }

  /** Short label above each day's bar: no cents on round amounts, so seven labels fit side by side. */
  protected formatBarAmount(value: number): string {
    const whole = Number.isInteger(value);
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2
    }).format(value);
  }

  protected formatOrderTime(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    const today = new Date();
    const sameDay =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
    return sameDay
      ? date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      : this.formatOrderDate(date);
  }

  protected paymentLabel(method: string | null | undefined): string {
    if (method === 'CARD') return 'Κάρτα';
    if (method === 'CASH') return 'Μετρητά';
    return '';
  }

  /** How full the "bottle" is relative to its reorder threshold, 0–100. */
  protected stockFill(row: InventoryRow): number {
    if (row.quantity <= 0) return 0;
    return Math.min(100, Math.max(4, this.stockRatio(row) * 100));
  }

  protected formatOrderDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
  }

  protected isBelowStockThreshold(row: InventoryRow): boolean {
    const threshold = this.lowStockLimit(row);
    return row.quantity <= threshold;
  }

  private stockRatio(row: InventoryRow): number {
    const threshold = this.lowStockLimit(row);
    return row.quantity / threshold;
  }

  private lowStockLimit(row: InventoryRow): number {
    if (!row.isBulk) return LOW_STOCK_UNITS;
    const liters = row.variantTemplateId === 'essence'
      ? LOW_STOCK_ESSENCE_LITERS
      : LOW_STOCK_PERFUME_LITERS;
    return liters * 1000;
  }
}