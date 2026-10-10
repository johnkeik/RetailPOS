import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { StockMovementType } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { StockMovementRow, StockMovementsService } from './stock-movements.service';

type StockMovementEvent = {
  id: string;
  createdAt: StockMovementRow['createdAt'];
  type: StockMovementType;
  orderId?: string;
  summary: string;
  movementCount: number;
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
    void this.service.loadMovements();
    // Clear the flag so a refresh does not show the banner again.
    if (this.justSaved()) history.replaceState({}, '');
  }

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const selectedType = this.selectedType();

    return this.service.movementRows().filter((row) => {
      const matchSearch =
        !query ||
        row.productName.toLowerCase().includes(query) ||
        row.productCode.toLowerCase().includes(query) ||
        row.variantTemplateName.toLowerCase().includes(query) ||
        row.orderId?.toLowerCase().includes(query) ||
        row.reason?.toLowerCase().includes(query);

      const matchType = selectedType === 'ALL' || row.type === selectedType;
      return matchSearch && matchType;
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
