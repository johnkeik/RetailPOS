import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PackagingType } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import {
  InventoryService,
  LOW_STOCK_ESSENCE_LITERS,
  LOW_STOCK_PERFUME_LITERS,
  LOW_STOCK_UNITS
} from './inventory.service';

@Component({
  selector: 'app-inventory-page',
  imports: [PageTitleComponent],
  templateUrl: './inventory-page.component.html',
  styleUrl: './inventory-page.component.scss'
})
export class InventoryPageComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);

  protected readonly searchQuery = signal('');
  protected readonly lowStockPerfumeLiters = signal(LOW_STOCK_PERFUME_LITERS);
  protected readonly lowStockEssenceLiters = signal(LOW_STOCK_ESSENCE_LITERS);
  protected readonly lowStockUnits = signal(LOW_STOCK_UNITS);
  protected readonly showLowStockOnly = signal(false);
  protected readonly packagingFilter = signal<PackagingType | 'ALL'>('ALL');

  protected readonly loading = this.inventoryService.loading;
  protected readonly error = this.inventoryService.error;

  ngOnInit(): void {
    void this.inventoryService.loadInventory();
  }

  private lowStockLimit(row: { isBulk: boolean; variantTemplateId: string }): number {
    if (!row.isBulk) return this.lowStockUnits();
    const liters = row.variantTemplateId === 'essence'
      ? this.lowStockEssenceLiters()
      : this.lowStockPerfumeLiters();
    return liters * 1000;
  }

  protected stockStatus(row: { quantity: number; isBulk: boolean; variantTemplateId: string }): 'ok' | 'low' | 'empty' {
    const qty = row.quantity;
    if (qty <= 0) return 'empty';
    if (qty <= this.lowStockLimit(row)) return 'low';
    return 'ok';
  }

  protected getStatusLabel(status: 'ok' | 'low' | 'empty'): string {
    switch (status) {
      case 'ok':
        return 'ΕΠΑΡΚΕΣ';
      case 'low':
        return 'ΧΑΜΗΛΟ';
      case 'empty':
        return 'ΕΞΑΝΤΛΗΜΕΝΟ';
    }
  }

  protected readonly summary = computed(() => {
    const rows = this.inventoryService.inventoryRows();
    return {
      total: rows.length,
      lowStock: rows.filter((r) => {
        if (r.quantity === 0) return false;
        return r.quantity <= this.lowStockLimit(r);
      }).length,
      outOfStock: rows.filter((r) => r.quantity === 0).length
    };
  });

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const onlyLow = this.showLowStockOnly();
    const pkgFilter = this.packagingFilter();

    return this.inventoryService.inventoryRows().filter((row) => {
      const matchesSearch =
        !query ||
        row.productName.toLowerCase().includes(query) ||
        row.productCode.toLowerCase().includes(query) ||
        row.variantTemplateName.toLowerCase().includes(query);

      const matchesLowStock = !onlyLow || row.quantity <= this.lowStockLimit(row);
      const matchesPackaging = pkgFilter === 'ALL' || row.packagingType === pkgFilter;

      return matchesSearch && matchesLowStock && matchesPackaging;
    });
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected onPerfumeThreshold(value: string): void {
    const parsed = Number(value);
    this.lowStockPerfumeLiters.set(Number.isFinite(parsed) ? parsed : 0);
  }

  protected onEssenceThreshold(value: string): void {
    const parsed = Number(value);
    this.lowStockEssenceLiters.set(Number.isFinite(parsed) ? parsed : 0);
  }

  protected onUnitsThreshold(value: string): void {
    const parsed = Number(value);
    this.lowStockUnits.set(Number.isFinite(parsed) ? parsed : 0);
  }

  protected formatDate(value: Date | string): string {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
