import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OrderStatus, PaymentMethod } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { SearchFieldComponent } from '../../shared/ui/search-field.component';
import { SalesHistoryService } from './sales-history.service';

function toInputDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

type Period = 'MONTH' | 'TODAY' | '7D' | '30D';
type StatusFilter = OrderStatus | 'ALL';

@Component({
  selector: 'app-sales-history-page',
  imports: [RouterLink, PageTitleComponent, SearchFieldComponent],
  templateUrl: './sales-history-page.component.html',
  styleUrl: './sales-history-page.component.scss'
})
export class SalesHistoryPageComponent implements OnInit {
  private readonly service = inject(SalesHistoryService);

  protected readonly searchQuery = signal('');
  // Current month so far; other periods are fetched only when picked.
  protected readonly dateFrom = signal(toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  protected readonly dateTo = signal(toInputDate(new Date()));
  protected readonly selectedPeriod = signal<Period | 'CUSTOM'>('MONTH');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly periodOptions: Array<{ id: Period; label: string }> = [
    { id: 'MONTH', label: 'Αυτός ο μήνας' },
    { id: 'TODAY', label: 'Σήμερα' },
    { id: '7D', label: 'Τελευταίες 7 ημέρες' },
    { id: '30D', label: 'Τελευταίες 30 ημέρες' }
  ];
  protected readonly expandedOrderId = signal<string | null>(null);
  protected readonly pageSizeOptions = [25, 50, 100];
  protected readonly pageSize = signal(25);
  private readonly pageIndex = signal(0);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  ngOnInit(): void {
    this.reload();
  }

  /** Fetches only the chosen days (local time, "to" inclusive). A cleared "from" falls back to the start of that month. */
  private reload(): void {
    if (!this.dateFrom()) {
      const anchor = this.dateTo() ? new Date(`${this.dateTo()}T00:00:00`) : new Date();
      this.dateFrom.set(toInputDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1)));
    }
    const from = new Date(`${this.dateFrom()}T00:00:00`);
    let to: Date | null = null;
    if (this.dateTo()) {
      to = new Date(`${this.dateTo()}T00:00:00`);
      to.setDate(to.getDate() + 1);
    }
    void this.service.loadOrders({ from, to });
  }

  /** Orders matching the search and dates; the status chips count from these. */
  private readonly searchedRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const from = this.dateFrom() ? new Date(`${this.dateFrom()}T00:00:00`).getTime() : -Infinity;
    const to = this.dateTo() ? new Date(`${this.dateTo()}T23:59:59.999`).getTime() : Infinity;

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

  protected readonly filteredRows = computed(() => {
    const status = this.statusFilter();
    return status === 'ALL' ? this.searchedRows() : this.searchedRows().filter((row) => row.status === status);
  });

  protected readonly statusCounts = computed(() => {
    const counts: Record<StatusFilter, number> = { ALL: 0, COMPLETED: 0, CANCELLED: 0, DELETED: 0 };
    for (const row of this.searchedRows()) {
      counts[row.status] += 1;
      counts.ALL += 1;
    }
    return counts;
  });

  /** "Διαγραμμένες" is rare, so its chip appears only when there are some (or it is the active filter). */
  protected readonly statusFilters = computed<StatusFilter[]>(() => {
    const filters: StatusFilter[] = ['ALL', 'COMPLETED', 'CANCELLED'];
    if (this.statusCounts().DELETED > 0 || this.statusFilter() === 'DELETED') filters.push('DELETED');
    return filters;
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize()))
  );

  // Clamped so a reload with fewer orders never leaves an empty, out-of-range page.
  protected readonly currentPage = computed(() => Math.min(this.pageIndex(), this.totalPages() - 1));

  /** Pagination is client side: the selected period is already loaded, this only limits what is drawn. */
  protected readonly pagedRows = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  protected goToPage(page: number): void {
    this.pageIndex.set(Math.max(0, Math.min(page, this.totalPages() - 1)));
    this.expandedOrderId.set(null);
  }

  protected onPageSizeChange(value: string): void {
    this.pageSize.set(Number(value) || 25);
    this.goToPage(0);
  }

  protected toggleDetails(orderId: string): void {
    this.expandedOrderId.update((current) => (current === orderId ? null : orderId));
  }

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
    this.goToPage(0);
  }

  protected setStatusFilter(status: StatusFilter): void {
    this.statusFilter.set(status);
    this.goToPage(0);
  }

  protected onPeriodChange(value: string): void {
    if (value === 'CUSTOM') return;
    const period = value as Period;
    const to = new Date();
    let from = new Date(to);
    if (period === 'MONTH') {
      from = new Date(to.getFullYear(), to.getMonth(), 1);
    } else {
      const days = period === 'TODAY' ? 1 : period === '7D' ? 7 : 30;
      from.setDate(from.getDate() - days + 1);
    }
    this.selectedPeriod.set(period);
    this.dateFrom.set(toInputDate(from));
    this.dateTo.set(toInputDate(to));
    this.goToPage(0);
    this.reload();
  }

  protected setFrom(value: string): void {
    this.selectedPeriod.set('CUSTOM');
    this.dateFrom.set(value);
    this.goToPage(0);
    this.reload();
  }

  protected setTo(value: string): void {
    this.selectedPeriod.set('CUSTOM');
    this.dateTo.set(value);
    this.goToPage(0);
    this.reload();
  }

  protected statusFilterLabel(status: StatusFilter): string {
    switch (status) {
      case 'ALL': return 'Όλες';
      case 'COMPLETED': return 'Ολοκληρωμένες';
      case 'CANCELLED': return 'Ακυρωμένες';
      case 'DELETED': return 'Διαγραμμένες';
    }
  }

  protected paymentLabel(method?: PaymentMethod): string {
    return method === 'CARD' ? 'Κάρτα' : method === 'CASH' ? 'Μετρητά' : '—';
  }

  protected formatDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }
}
