import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { StockMovementType } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { SearchFieldComponent } from '../../shared/ui/search-field.component';
import { StockMovementRow, StockMovementsService } from './stock-movements.service';

function toInputDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

type Period = 'MONTH' | 'TODAY' | '7D' | '30D';
type MovementFilter = StockMovementType | 'ALL';

type StockMovementEvent = {
  id: string;
  createdAt: StockMovementRow['createdAt'];
  type: StockMovementType;
  orderId?: string;
  summary: string;
  movementCount: number;
  employeeName: string;
  rows: StockMovementRow[];
};

@Component({
  selector: 'app-stock-movements-page',
  imports: [DatePipe, NgTemplateOutlet, RouterLink, PageTitleComponent, SearchFieldComponent],
  templateUrl: './stock-movements-page.component.html',
  styleUrl: './stock-movements-page.component.scss'
})
export class StockMovementsPageComponent implements OnInit {
  private readonly service = inject(StockMovementsService);

  protected readonly searchQuery = signal('');
  protected readonly selectedType = signal<MovementFilter>('ALL');
  // Default: the current month so far (1st to today), like every other dated list.
  protected readonly dateFrom = signal(toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  protected readonly dateTo = signal(toInputDate(new Date()));
  protected readonly selectedPeriod = signal<Period | 'CUSTOM'>('MONTH');
  protected readonly viewMode = signal<'events' | 'movements'>('events');
  protected readonly expandedEventId = signal<string | null>(null);
  protected readonly pageSizeOptions = [25, 50, 100];
  protected readonly pageSize = signal(25);
  private readonly pageIndex = signal(0);
  protected readonly justSaved = signal(history.state?.saved === true);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  protected readonly periodOptions: Array<{ id: Period; label: string }> = [
    { id: 'MONTH', label: 'Αυτός ο μήνας' },
    { id: 'TODAY', label: 'Σήμερα' },
    { id: '7D', label: 'Τελευταίες 7 ημέρες' },
    { id: '30D', label: 'Τελευταίες 30 ημέρες' }
  ];

  protected readonly types: MovementFilter[] = [
    'ALL',
    'PURCHASE',
    'SALE',
    'ADJUSTMENT',
    'RETURN',
    'LOSS'
  ];

  ngOnInit(): void {
    this.reload();
    // Clear the flag so a refresh does not show the banner again.
    if (this.justSaved()) history.replaceState({}, '');
  }

  /** Rows matching the search and dates; the type chips count from these. */
  private readonly searchedRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const from = this.dateFrom()
      ? new Date(`${this.dateFrom()}T00:00:00`).getTime()
      : Number.NEGATIVE_INFINITY;
    const to = this.dateTo()
      ? new Date(`${this.dateTo()}T23:59:59.999`).getTime()
      : Number.POSITIVE_INFINITY;

    return this.service.movementRows().filter((row) => {
      const createdAt = new Date(row.createdAt).getTime();
      const matchSearch =
        !query ||
        row.productName.toLowerCase().includes(query) ||
        row.productCode.toLowerCase().includes(query) ||
        row.variantTemplateName.toLowerCase().includes(query) ||
        row.performedByName?.toLowerCase().includes(query) ||
        row.orderId?.toLowerCase().includes(query) ||
        row.reason?.toLowerCase().includes(query);
      return matchSearch && createdAt >= from && createdAt <= to;
    });
  });

  protected readonly filteredRows = computed(() => {
    const selectedType = this.selectedType();
    return selectedType === 'ALL'
      ? this.searchedRows()
      : this.searchedRows().filter((row) => row.type === selectedType);
  });

  protected readonly typeCounts = computed(() => {
    const counts = Object.fromEntries(this.types.map((type) => [type, 0])) as Record<MovementFilter, number>;
    for (const row of this.searchedRows()) {
      counts[row.type] += 1;
      counts.ALL += 1;
    }
    return counts;
  });

  protected readonly filteredEvents = computed(() => {
    const groups = new Map<string, StockMovementRow[]>();

    for (const row of this.filteredRows()) {
      const isOrderSale = row.type === 'SALE' && Boolean(row.orderId);
      const key = isOrderSale ? `order:${row.orderId}` : `movement:${row.id}`;
      const rows = groups.get(key) ?? [];
      rows.push(row);
      groups.set(key, rows);
    }

    return [...groups.entries()].map(([id, rows]) => {
      const first = rows[0];
      const isOrderSale = first.type === 'SALE' && Boolean(first.orderId);
      const products = [...new Set(
        rows.filter((row) => !row.isConsumable).map((row) => row.productName)
      )];

      return {
        id,
        createdAt: first.createdAt,
        type: first.type,
        orderId: first.orderId,
        summary: isOrderSale
          ? products.join(' · ') || `Παραγγελία ${first.orderId}`
          : `${first.productCode} · ${first.productName}`,
        movementCount: rows.length,
        employeeName: first.performedByName || 'Μη διαθέσιμος',
        rows
      } satisfies StockMovementEvent;
    });
  });

  /** Number of lines in the current view: transactions or single movements. */
  protected readonly visibleCount = computed(() =>
    this.viewMode() === 'events' ? this.filteredEvents().length : this.filteredRows().length
  );

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.visibleCount() / this.pageSize())));

  // Clamped so a reload with fewer movements never leaves an empty, out-of-range page.
  protected readonly currentPage = computed(() => Math.min(this.pageIndex(), this.totalPages() - 1));

  /** Pagination is client side: the selected period is already loaded, this only limits what is drawn. */
  protected readonly pagedEvents = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredEvents().slice(start, start + this.pageSize());
  });

  protected readonly pagedRows = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  protected goToPage(page: number): void {
    this.pageIndex.set(Math.max(0, Math.min(page, this.totalPages() - 1)));
    this.expandedEventId.set(null);
  }

  protected onPageSizeChange(value: string): void {
    this.pageSize.set(Number(value) || 25);
    this.goToPage(0);
  }

  protected setViewMode(mode: 'events' | 'movements'): void {
    this.viewMode.set(mode);
    this.goToPage(0);
  }

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
    this.goToPage(0);
  }

  protected onTypeChange(value: MovementFilter): void {
    this.selectedType.set(value);
    this.goToPage(0);
  }

  protected onPeriodChange(value: string): void {
    if (value !== 'CUSTOM') this.selectPeriod(value as Period);
  }

  protected selectPeriod(period: Period): void {
    this.selectedPeriod.set(period);
    const to = new Date();
    let from = new Date(to);
    if (period === 'MONTH') {
      from = new Date(to.getFullYear(), to.getMonth(), 1);
    } else {
      const days = period === 'TODAY' ? 1 : period === '7D' ? 7 : 30;
      from.setDate(from.getDate() - days + 1);
    }
    this.dateFrom.set(toInputDate(from));
    this.dateTo.set(toInputDate(to));
    this.reload();
  }

  protected onDateFromChange(value: string): void {
    this.dateFrom.set(value);
    this.selectedPeriod.set('CUSTOM');
    this.reload();
  }

  protected onDateToChange(value: string): void {
    this.dateTo.set(value);
    this.selectedPeriod.set('CUSTOM');
    this.reload();
  }

  /**
   * Fetch only the selected range from Firestore (local days: from 00:00 to the day after `to`).
   * The query is never unbounded: a cleared "Από" falls back to the 1st of the "Έως" month (or of this month).
   */
  private reload(): void {
    this.goToPage(0);
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
    void this.service.loadMovements({ from, to });
  }

  protected toggleEvent(eventId: string): void {
    this.expandedEventId.update((current) => (current === eventId ? null : eventId));
  }

  /** Sentence-case label shown on each row's tag. */
  protected formatTypeLabel(type: StockMovementType): string {
    switch (type) {
      case 'PURCHASE': return 'Παραλαβή';
      case 'SALE': return 'Πώληση';
      case 'ADJUSTMENT': return 'Διόρθωση';
      case 'RETURN': return 'Επιστροφή';
      case 'LOSS': return 'Απώλεια';
    }
  }

  /** Plural label for the filter chips. */
  protected formatTypeFilter(type: MovementFilter): string {
    switch (type) {
      case 'ALL': return 'Όλες';
      case 'PURCHASE': return 'Παραλαβές';
      case 'SALE': return 'Πωλήσεις';
      case 'ADJUSTMENT': return 'Διορθώσεις';
      case 'RETURN': return 'Επιστροφές';
      case 'LOSS': return 'Απώλειες';
    }
  }

  /** Tags stay quiet; only corrections and losses stand out. */
  protected typeTagClass(type: StockMovementType): string {
    return type === 'LOSS' ? 'alert' : type === 'ADJUSTMENT' ? 'warn' : '';
  }
}
