import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { PackagingType } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { InventoryService } from './inventory.service';

@Component({
  selector: 'app-inventory-page',
  imports: [PageTitleComponent],
  templateUrl: './inventory-page.component.html',
  styleUrl: './inventory-page.component.scss'
})
export class InventoryPageComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);

  protected readonly searchQuery = signal('');
  protected readonly lowStockThreshold = signal(5);
  protected readonly showLowStockOnly = signal(false);
  protected readonly packagingFilter = signal<PackagingType | 'ALL'>('ALL');

  protected readonly loading = this.inventoryService.loading;
  protected readonly error = this.inventoryService.error;

  ngOnInit(): void {
    void this.inventoryService.loadInventory();
  }

  /**
   * For BULK rows the quantity is in ml; the threshold is in liters.
   * For PACKAGED rows the quantity is in units; the threshold is in units.
   */
  protected stockStatus(row: { quantity: number; isBulk: boolean }): 'ok' | 'low' | 'empty' {
    const qty = row.quantity;
    if (qty === 0) return 'empty';
    const threshold = this.lowStockThreshold();
    const effective = row.isBulk ? threshold * 1000 : threshold; // convert L → ml for BULK
    if (qty <= effective) return 'low';
    return 'ok';
  }

  protected readonly summary = computed(() => {
    const rows = this.inventoryService.inventoryRows();
    const threshold = this.lowStockThreshold();
    return {
      total: rows.length,
      lowStock: rows.filter((r) => {
        if (r.quantity === 0) return false;
        const effective = r.isBulk ? threshold * 1000 : threshold;
        return r.quantity <= effective;
      }).length,
      outOfStock: rows.filter((r) => r.quantity === 0).length
    };
  });

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const threshold = this.lowStockThreshold();
    const onlyLow = this.showLowStockOnly();
    const pkgFilter = this.packagingFilter();

    return this.inventoryService.inventoryRows().filter((row) => {
      const matchesSearch =
        !query ||
        row.productName.toLowerCase().includes(query) ||
        row.productCode.toLowerCase().includes(query) ||
        row.variantTemplateName.toLowerCase().includes(query);

      const effective = row.isBulk ? threshold * 1000 : threshold;
      const matchesLowStock = !onlyLow || row.quantity <= effective;
      const matchesPackaging = pkgFilter === 'ALL' || row.packagingType === pkgFilter;

      return matchesSearch && matchesLowStock && matchesPackaging;
    });
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected onThreshold(value: string): void {
    const parsed = Number(value);
    this.lowStockThreshold.set(Number.isFinite(parsed) ? parsed : 0);
  }

  protected formatDate(value: Date | string): string {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
