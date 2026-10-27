import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { SalesHistoryService } from './sales-history.service';

function toInputDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-sales-history-page',
  imports: [PageTitleComponent],
  templateUrl: './sales-history-page.component.html',
  styleUrl: './sales-history-page.component.scss'
})
export class SalesHistoryPageComponent implements OnInit {
  private readonly service = inject(SalesHistoryService);

  protected readonly searchQuery = signal('');
  protected readonly dateFrom = signal(toInputDate(new Date(Date.now() - 29 * 86_400_000)));
  protected readonly dateTo = signal(toInputDate(new Date()));
  protected readonly expandedOrderId = signal<string | null>(null);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  ngOnInit(): void {
    void this.service.loadOrders();
  }

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const from = new Date(`${this.dateFrom()}T00:00:00`).getTime();
    const to = new Date(`${this.dateTo()}T23:59:59.999`).getTime();

    return this.service.orders().filter((row) => {
      const createdAt = row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime();
      return (
        createdAt >= from &&
        createdAt <= to &&
        (!query ||
          row.employeeName.toLowerCase().includes(query) ||
          row.employeeId.toLowerCase().includes(query) ||
          row.id.toLowerCase().includes(query) ||
          (row.originalOrderId?.toLowerCase().includes(query) ?? false))
      );
    });
  });

  protected toggleDetails(orderId: string): void {
    this.expandedOrderId.update((current) => (current === orderId ? null : orderId));
  }

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected setFrom(value: string): void {
    this.dateFrom.set(value);
  }

  protected setTo(value: string): void {
    this.dateTo.set(value);
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
