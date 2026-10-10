import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { SalesHistoryService } from './sales-history.service';

@Component({
  selector: 'app-sales-history-page',
  imports: [PageTitleComponent],
  templateUrl: './sales-history-page.component.html',
  styleUrl: './sales-history-page.component.scss'
})
export class SalesHistoryPageComponent implements OnInit {
  private readonly service = inject(SalesHistoryService);

  protected readonly searchQuery = signal('');
  protected readonly expandedOrderId = signal<string | null>(null);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  ngOnInit(): void {
    void this.service.loadOrders();
  }

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();

    return this.service.orders().filter((row) => {
      return (
        !query ||
        row.employeeName.toLowerCase().includes(query) ||
        row.employeeId.toLowerCase().includes(query) ||
        row.id.toLowerCase().includes(query)
      );
    });
  });

  protected toggleDetails(orderId: string): void {
    this.expandedOrderId.update((current) => (current === orderId ? null : orderId));
  }

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected formatDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }
}
