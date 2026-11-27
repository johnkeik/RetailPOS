import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { StockMovementType } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { StockMovementRow, StockMovementsService } from './stock-movements.service';

function toInputDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

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
  imports: [DatePipe, RouterLink, PageTitleComponent],
  templateUrl: './stock-movements-page.component.html',
  styleUrl: './stock-movements-page.component.scss'
})
export class StockMovementsPageComponent implements OnInit {
  private readonly service = inject(StockMovementsService);

  protected readonly searchQuery = signal('');
  protected readonly selectedType = signal<StockMovementType | 'ALL'>('ALL');
  protected readonly dateFrom = signal(toInputDate(new Date()));
  protected readonly dateTo = signal(toInputDate(new Date()));
  protected readonly selectedPeriod = signal<'TODAY' | '7D' | '30D' | 'CUSTOM'>('TODAY');
  protected readonly viewMode = signal<'events' | 'movements'>('events');
  protected readonly expandedEventId = signal<string | null>(null);
  protected readonly justSaved = signal(history.state?.saved === true);

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;

  protected readonly types: Array<StockMovementType | 'ALL'> = [
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

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const selectedType = this.selectedType();
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

      const matchType = selectedType === 'ALL' || row.type === selectedType;
      return matchSearch && matchType && createdAt >= from && createdAt <= to;
    });
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

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected onTypeChange(value: string): void {
    this.selectedType.set(value as StockMovementType | 'ALL');
  }

  protected selectPeriod(period: 'TODAY' | '7D' | '30D'): void {
    this.selectedPeriod.set(period);
    const to = new Date();
    const from = new Date(to);
    const days = period === 'TODAY' ? 1 : period === '7D' ? 7 : 30;
    from.setDate(from.getDate() - days + 1);
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
   * The query is never unbounded: a cleared "Από" falls back to 30 days before "Έως" (or today).
   */
  private reload(): void {
    if (!this.dateFrom()) {
      const anchor = this.dateTo() ? new Date(`${this.dateTo()}T00:00:00`) : new Date();
      anchor.setDate(anchor.getDate() - 29);
      this.dateFrom.set(toInputDate(anchor));
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

  protected formatTypeLabel(type: StockMovementType | 'ALL'): string {
    switch (type) {
      case 'ALL': return 'Όλες';
      case 'PURCHASE': return 'ΠΑΡΑΛΑΒΗ';
      case 'SALE': return 'ΠΩΛΗΣΗ';
      case 'ADJUSTMENT': return 'ΔΙΟΡΘΩΣΗ';
      case 'RETURN': return 'ΕΠΙΣΤΡΟΦΗ';
      case 'LOSS': return 'ΑΠΩΛΕΙΑ';
    }
  }
}
