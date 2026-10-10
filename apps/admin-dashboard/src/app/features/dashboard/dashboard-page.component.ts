import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { InventoryRow, InventoryService } from '../inventory/inventory.service';
import { SalesHistoryService } from '../sales-history/sales-history.service';
import { DashboardTempSeedService } from './dashboard-temp-seed.service';
import { mockCatalogData } from './temp-data/mock-catalog.data';

const LOW_STOCK_LITERS = 5;
const LOW_STOCK_UNITS = 5;

@Component({
  selector: 'app-dashboard-page',
  imports: [PageTitleComponent, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss'
})
export class DashboardPageComponent {
  private readonly tempSeedService = inject(DashboardTempSeedService);
  private readonly inventoryService = inject(InventoryService);
  private readonly salesHistoryService = inject(SalesHistoryService);

  protected readonly seedLoading = this.tempSeedService.loading;
  protected readonly seedStatus = this.tempSeedService.status;
  protected readonly seedError = this.tempSeedService.error;
  protected readonly productCategories = mockCatalogData.categories;
  protected readonly inventoryLoading = this.inventoryService.loading;
  protected readonly salesLoading = this.salesHistoryService.loading;
  protected readonly inventoryError = this.inventoryService.error;
  protected readonly salesError = this.salesHistoryService.error;
  protected readonly orders = this.salesHistoryService.orders;
  protected readonly loading = computed(
    () => this.inventoryLoading() || this.salesLoading()
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
        amount: total
      };
    });
    const maxAmount = Math.max(...days.map((day) => day.amount), 0);
    return days.map((day) => ({
      ...day,
      barPercent: maxAmount ? (day.amount / maxAmount) * 100 : 0
    }));
  });

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

  protected async refresh(): Promise<void> {
    await Promise.all([
      this.inventoryService.loadInventory(),
      this.salesHistoryService.loadOrders()
    ]);
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }

  protected formatOrderDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected isBelowStockThreshold(row: InventoryRow): boolean {
    const threshold = row.isBulk ? LOW_STOCK_LITERS * 1000 : LOW_STOCK_UNITS;
    return row.quantity <= threshold;
  }

  private stockRatio(row: InventoryRow): number {
    const threshold = row.isBulk ? LOW_STOCK_LITERS * 1000 : LOW_STOCK_UNITS;
    return row.quantity / threshold;
  }
}