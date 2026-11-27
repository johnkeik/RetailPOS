import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { SearchFieldComponent } from '../../shared/ui/search-field.component';
import {
  InventoryRow,
  InventoryService,
  LOW_STOCK_ESSENCE_ML,
  LOW_STOCK_PERFUME_ML,
  LOW_STOCK_UNITS
} from './inventory.service';

type StockStatus = 'ok' | 'low' | 'empty';
type StockTab = 'PERFUME' | 'PACKAGED' | 'CONSUMABLE';
type StatusFilter = 'ALL' | 'LOW' | 'EMPTY';
export type SortKey = 'name' | 'perfume' | 'essence' | 'qty' | 'updated';
type SortDirection = 'asc' | 'desc';

/** One line per item: perfumes carry base and essence side by side. */
export type StockLine = {
  key: string;
  tab: StockTab;
  name: string;
  code: string;
  detail: string;
  perfume?: InventoryRow;
  essence?: InventoryRow;
  single?: InventoryRow;
  status: StockStatus;
  updatedAt: string;
};

const STATUS_RANK: Record<StockStatus, number> = { ok: 0, low: 1, empty: 2 };

@Component({
  selector: 'app-inventory-page',
  imports: [PageTitleComponent, SearchFieldComponent, RouterLink, NgTemplateOutlet],
  templateUrl: './inventory-page.component.html',
  styleUrl: './inventory-page.component.scss'
})
export class InventoryPageComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);

  protected readonly searchQuery = signal('');
  protected readonly lowStockPerfumeMl = signal(LOW_STOCK_PERFUME_ML);
  protected readonly lowStockEssenceMl = signal(LOW_STOCK_ESSENCE_ML);
  protected readonly lowStockUnits = signal(LOW_STOCK_UNITS);
  protected readonly thresholdsOpen = signal(false);
  protected readonly activeTab = signal<StockTab>('PERFUME');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly sortKey = signal<SortKey>('name');
  protected readonly sortDirection = signal<SortDirection>('asc');
  protected readonly pageSizeOptions = [25, 50, 100];
  protected readonly pageSize = signal(25);
  private readonly pageIndex = signal(0);

  protected readonly loading = this.inventoryService.loading;
  protected readonly error = this.inventoryService.error;

  protected readonly tabs: { id: StockTab; label: string }[] = [
    { id: 'PERFUME', label: 'Αρώματα' },
    { id: 'PACKAGED', label: 'Συσκευασμένα' },
    { id: 'CONSUMABLE', label: 'Αναλώσιμα' }
  ];

  ngOnInit(): void {
    void this.inventoryService.loadInventory();
  }

  private lowStockLimit(row: { isBulk: boolean; variantTemplateId: string }): number {
    if (!row.isBulk) return this.lowStockUnits();
    return row.variantTemplateId === 'essence'
      ? this.lowStockEssenceMl()
      : this.lowStockPerfumeMl();
  }

  protected stockStatus(row: InventoryRow | undefined): StockStatus {
    if (!row) return 'ok';
    if (row.quantity <= 0) return 'empty';
    if (row.quantity <= this.lowStockLimit(row)) return 'low';
    return 'ok';
  }

  /** All inventory rows folded into one line per perfume / packaged variant / consumable. */
  protected readonly lines = computed<StockLine[]>(() => {
    const perfumes = new Map<string, StockLine>();
    const others: StockLine[] = [];

    for (const row of this.inventoryService.inventoryRows()) {
      if (row.isConsumable) {
        others.push(this.toLine(row, 'CONSUMABLE', row.productName, row.productCode, ''));
      } else if (row.isBulk) {
        const line = perfumes.get(row.productId) ?? {
          key: `perfume-${row.productId}`,
          tab: 'PERFUME' as const,
          name: row.productName,
          code: row.productCode,
          detail: '',
          status: 'ok' as StockStatus,
          updatedAt: row.updatedAt as string
        };
        if (row.variantTemplateId === 'essence') line.essence = row;
        else line.perfume = row;
        if (String(row.updatedAt) > String(line.updatedAt)) line.updatedAt = row.updatedAt as string;
        perfumes.set(row.productId, line);
      } else {
        others.push(this.toLine(row, 'PACKAGED', row.productName, row.productCode, row.variantTemplateName));
      }
    }

    for (const line of perfumes.values()) {
      line.status = this.worst(this.stockStatus(line.perfume), this.stockStatus(line.essence));
    }

    return [...perfumes.values(), ...others].sort((left, right) => left.name.localeCompare(right.name));
  });

  private toLine(row: InventoryRow, tab: StockTab, name: string, code: string, detail: string): StockLine {
    return {
      key: row.id,
      tab,
      name,
      code,
      detail,
      single: row,
      status: this.stockStatus(row),
      updatedAt: row.updatedAt as string
    };
  }

  private worst(left: StockStatus, right: StockStatus): StockStatus {
    return STATUS_RANK[left] >= STATUS_RANK[right] ? left : right;
  }

  protected readonly tabCounts = computed(() => {
    const counts: Record<StockTab, number> = { PERFUME: 0, PACKAGED: 0, CONSUMABLE: 0 };
    for (const line of this.lines()) counts[line.tab]++;
    return counts;
  });

  /** Tabs with nothing in them are hidden, except the default one. */
  protected readonly visibleTabs = computed(() =>
    this.tabs.filter((tab) => tab.id === 'PERFUME' || this.tabCounts()[tab.id] > 0)
  );

  private readonly tabLines = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    return this.lines().filter((line) =>
      line.tab === this.activeTab() &&
      (!query ||
        line.name.toLowerCase().includes(query) ||
        line.code.toLowerCase().includes(query) ||
        line.detail.toLowerCase().includes(query))
    );
  });

  protected readonly statusCounts = computed(() => {
    const lines = this.tabLines();
    return {
      ALL: lines.length,
      LOW: lines.filter((line) => line.status === 'low').length,
      EMPTY: lines.filter((line) => line.status === 'empty').length
    };
  });

  protected readonly visibleLines = computed(() => {
    const filter = this.statusFilter();
    return this.tabLines().filter((line) =>
      filter === 'ALL' ||
      (filter === 'LOW' && line.status === 'low') ||
      (filter === 'EMPTY' && line.status === 'empty')
    );
  });

  /** Sorted client side; lines missing a value (e.g. no essence record) always go last. */
  protected readonly sortedLines = computed(() => {
    const key = this.sortKey();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    const value = (line: StockLine): number | string | null => {
      switch (key) {
        case 'name': return line.name.toLocaleLowerCase('el');
        case 'perfume': return line.perfume?.quantity ?? null;
        case 'essence': return line.essence?.quantity ?? null;
        case 'qty': return line.single?.quantity ?? null;
        case 'updated': return line.updatedAt ? new Date(line.updatedAt).getTime() : null;
      }
    };
    return [...this.visibleLines()].sort((left, right) => {
      const a = value(left);
      const b = value(right);
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      const order = typeof a === 'string' ? a.localeCompare(b as string, 'el') : a - (b as number);
      return order * direction || left.name.localeCompare(right.name, 'el');
    });
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.sortedLines().length / this.pageSize()))
  );

  // Clamped so a filter or threshold change never leaves an empty, out-of-range page.
  protected readonly currentPage = computed(() => Math.min(this.pageIndex(), this.totalPages() - 1));

  protected readonly pagedLines = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.sortedLines().slice(start, start + this.pageSize());
  });

  /** First click sorts ascending (lowest stock first), a second click on the same column reverses. */
  protected sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      // Newest movement first is the useful default for dates.
      this.sortDirection.set(key === 'updated' ? 'desc' : 'asc');
    }
    this.goToPage(0);
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected goToPage(page: number): void {
    this.pageIndex.set(Math.max(0, Math.min(page, this.totalPages() - 1)));
  }

  protected onPageSizeChange(value: string): void {
    this.pageSize.set(Number(value) || 25);
    this.goToPage(0);
  }

  protected setStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
    this.goToPage(0);
  }

  protected selectTab(tab: StockTab): void {
    this.activeTab.set(tab);
    this.statusFilter.set('ALL');
    // Base/essence columns exist only on the perfume tab, quantity only on the others.
    const key = this.sortKey();
    if ((tab === 'PERFUME' && key === 'qty') || (tab !== 'PERFUME' && (key === 'perfume' || key === 'essence'))) {
      this.sortKey.set('name');
      this.sortDirection.set('asc');
    }
    this.goToPage(0);
  }

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
    this.goToPage(0);
  }

  protected onPerfumeThreshold(value: string): void {
    const parsed = Number(value);
    this.lowStockPerfumeMl.set(Number.isFinite(parsed) ? parsed : 0);
  }

  protected onEssenceThreshold(value: string): void {
    const parsed = Number(value);
    this.lowStockEssenceMl.set(Number.isFinite(parsed) ? parsed : 0);
  }

  protected onUnitsThreshold(value: string): void {
    const parsed = Number(value);
    this.lowStockUnits.set(Number.isFinite(parsed) ? parsed : 0);
  }

  protected formatQty(row: InventoryRow | undefined): string {
    if (!row) return '—';
    if (!row.isBulk) return `${row.quantity.toLocaleString('el-GR')} τεμ.`;
    if (Math.abs(row.quantity) >= 1000) {
      return `${(row.quantity / 1000).toLocaleString('el-GR', { maximumFractionDigits: 2 })} L`;
    }
    return `${row.quantity.toLocaleString('el-GR', { maximumFractionDigits: 1 })} ml`;
  }

  protected statusLabel(status: StockStatus): string {
    return status === 'empty' ? 'Εξαντλήθηκε' : status === 'low' ? 'Χαμηλό' : '';
  }

  protected formatDate(value: Date | string): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
  }
}
