import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { SearchFieldComponent } from '../../shared/ui/search-field.component';
import { ProductGender } from '../../core/types/domain.models';
import { InventoryService } from '../inventory/inventory.service';
import { ProductRow, ProductsService } from './products.service';

type StatusFilter = '' | 'ACTIVE' | 'INACTIVE' | 'NO_VARIANTS';
type ProductStock = { perfumeMl: number | null; essenceMl: number | null; units: number | null };

@Component({
  selector: 'app-products-page',
  imports: [RouterLink, PageTitleComponent, EntityActionsComponent, SearchFieldComponent],
  templateUrl: './products-page.component.html',
  styleUrl: './products-page.component.scss'
})
export class ProductsPageComponent {
  private readonly productsService = inject(ProductsService);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);

  protected readonly searchQuery = signal('');
  protected readonly selectedCategoryId = signal('');
  protected readonly selectedBrandId = signal('');
  protected readonly selectedGender = signal<ProductGender | ''>('');
  protected readonly statusFilter = signal<StatusFilter>('');
  protected readonly genderOptions: { value: ProductGender; label: string }[] = [
    { value: 'M', label: 'Ανδρικά' },
    { value: 'F', label: 'Γυναικεία' },
    { value: 'UNISEX', label: 'Unisex' }
  ];
  protected readonly pageSize = signal(25);
  protected readonly pageIndex = signal(0);
  protected readonly pageSizeOptions = [25, 50, 100];
  protected readonly selectedProductIds = signal<string[]>([]);
  protected readonly bulkVariantTemplateId = signal('');
  protected readonly bulkApplying = signal(false);
  protected readonly bulkMessage = signal<string | null>(null);

  protected readonly loading = this.productsService.loading;
  protected readonly error = this.productsService.error;
  protected readonly categories = this.productsService.categories;
  protected readonly variantTemplates = this.productsService.variantTemplates;


  protected readonly productCategoryOptions = computed(() => {
    const categoriesById = new Map(this.categories().map((category) => [category.id, category.name]));
    for (const product of this.productsService.products()) {
      if (product.categoryId && product.categoryName !== '-') {
        categoriesById.set(product.categoryId, product.categoryName);
      }
    }
    return [...categoriesById]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  });

  protected readonly brandOptions = computed(() => {
    const brandsById = new Map(this.productsService.brands().map((brand) => [brand.id, brand.name]));
    for (const product of this.productsService.products()) {
      if (product.brandId && product.brandName !== '-') brandsById.set(product.brandId, product.brandName);
    }
    return [...brandsById]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  });

  protected readonly hasActiveFilters = computed(() =>
    !!(this.searchQuery() || this.selectedCategoryId() || this.selectedBrandId() || this.selectedGender() || this.statusFilter())
  );

  protected readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const categoryId = this.selectedCategoryId();
    const brandId = this.selectedBrandId();
    const gender = this.selectedGender();
    const status = this.statusFilter();
    const rows = this.productsService.products();

    return rows.filter((product) => {
      const matchesCategory = !categoryId || product.categoryId === categoryId;
      const matchesBrand = !brandId || product.brandId === brandId;
      const matchesGender = !gender || product.gender === gender;
      const matchesStatus =
        !status ||
        (status === 'ACTIVE' && product.active) ||
        (status === 'INACTIVE' && !product.active) ||
        (status === 'NO_VARIANTS' && this.getAssignedVariantsCount(product) === 0);
      const matchesQuery = !query ||
        product.productCode.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query) ||
        product.brandName.toLowerCase().includes(query);
      return matchesCategory && matchesBrand && matchesGender && matchesStatus && matchesQuery;
    });
  });

  /** Current stock per product, from the inventory snapshots already loaded for the dashboard. */
  protected readonly stockByProduct = computed(() => {
    const stock = new Map<string, ProductStock>();
    for (const row of this.inventoryService.inventoryRows()) {
      if (row.isConsumable) continue;
      const entry = stock.get(row.productId) ?? { perfumeMl: null, essenceMl: null, units: null };
      if (row.variantTemplateId === 'essence') entry.essenceMl = (entry.essenceMl ?? 0) + row.quantity;
      else if (row.isBulk) entry.perfumeMl = (entry.perfumeMl ?? 0) + row.quantity;
      else entry.units = (entry.units ?? 0) + row.quantity;
      stock.set(row.productId, entry);
    }
    return stock;
  });

  protected readonly bulkToggling = signal(false);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredProducts().length / this.pageSize()))
  );

  // Clamped so deleting/filtering never leaves an out-of-range page.
  protected readonly currentPage = computed(() => Math.min(this.pageIndex(), this.totalPages() - 1));

  protected readonly pagedProducts = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredProducts().slice(start, start + this.pageSize());
  });


  constructor() {
    // Brands/Categories link here with ?brand= or ?category= to show the products that use them.
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    this.selectedBrandId.set(params.get('brand') ?? '');
    this.selectedCategoryId.set(params.get('category') ?? '');
    void this.productsService.loadAll();
  }

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
    this.pageIndex.set(0);
  }

  protected onCategoryFilterChange(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    this.pageIndex.set(0);
  }

  protected onBrandFilterChange(brandId: string): void {
    this.selectedBrandId.set(brandId);
    this.pageIndex.set(0);
  }

  protected onGenderFilterChange(gender: string): void {
    this.selectedGender.set(gender as ProductGender | '');
    this.pageIndex.set(0);
  }

  protected onStatusFilterChange(status: string): void {
    this.statusFilter.set(status as StatusFilter);
    this.pageIndex.set(0);
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.selectedCategoryId.set('');
    this.selectedBrandId.set('');
    this.selectedGender.set('');
    this.statusFilter.set('');
    this.pageIndex.set(0);
  }

  protected openProduct(product: ProductRow, event: MouseEvent): void {
    // Clicks on the checkbox, links or row actions keep their own behaviour.
    if ((event.target as HTMLElement).closest('input, button, a, .check-col, .actions-col')) return;
    this.startEdit(product);
  }

  protected async bulkSetActive(active: boolean): Promise<void> {
    const productIds = this.selectedProductIds();
    if (!productIds.length || this.bulkToggling()) return;
    this.bulkToggling.set(true);
    this.bulkMessage.set(null);
    try {
      const failed = await this.productsService.setProductsActive(productIds, active);
      const done = productIds.length - failed;
      this.bulkMessage.set(`${done} προϊόντα ${active ? 'ενεργοποιήθηκαν' : 'απενεργοποιήθηκαν'}.`);
    } finally {
      this.bulkToggling.set(false);
    }
  }

  protected formatVolume(ml: number | null | undefined): string {
    if (ml == null) return '—';
    if (Math.abs(ml) >= 1000) {
      return `${(ml / 1000).toLocaleString('el-GR', { maximumFractionDigits: 2 })} L`;
    }
    return `${ml.toLocaleString('el-GR', { maximumFractionDigits: 1 })} ml`;
  }

  protected goToPage(page: number): void {
    this.pageIndex.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  protected onPageSizeChange(size: string): void {
    this.pageSize.set(Number(size));
    this.pageIndex.set(0);
  }

  protected isProductSelected(productId: string): boolean {
    return this.selectedProductIds().includes(productId);
  }

  protected areAllFilteredProductsSelected(): boolean {
    const products = this.filteredProducts();
    const selected = new Set(this.selectedProductIds());
    return products.length > 0 && products.every((product) => selected.has(product.id));
  }

  protected hasPartialFilteredSelection(): boolean {
    const products = this.filteredProducts();
    const selected = new Set(this.selectedProductIds());
    const selectedCount = products.filter((product) => selected.has(product.id)).length;
    return selectedCount > 0 && selectedCount < products.length;
  }

  protected setProductSelected(productId: string, checked: boolean): void {
    const selected = new Set(this.selectedProductIds());
    if (checked) {
      selected.add(productId);
    } else {
      selected.delete(productId);
    }
    this.selectedProductIds.set([...selected]);
    this.bulkMessage.set(null);
  }

  protected setFilteredProductSelection(checked: boolean): void {
    const selected = new Set(this.selectedProductIds());
    for (const product of this.filteredProducts()) {
      if (checked) {
        selected.add(product.id);
      } else {
        selected.delete(product.id);
      }
    }
    this.selectedProductIds.set([...selected]);
    this.bulkMessage.set(null);
  }

  protected clearProductSelection(): void {
    this.selectedProductIds.set([]);
    this.bulkMessage.set(null);
  }

  protected async bulkAssignVariant(operation: 'ADD' | 'UPDATE_PRICE' = 'ADD'): Promise<void> {
    const productIds = this.selectedProductIds();
    const templateId = this.bulkVariantTemplateId();
    if (!productIds.length || !templateId || this.bulkApplying()) return;

    this.bulkApplying.set(true);
    this.bulkMessage.set(null);
    try {
      const result = await this.productsService.assignVariantToProducts(productIds, templateId, operation);
      if (!result) return;

      const messages = operation === 'UPDATE_PRICE' ? [
        `Η τιμή ενημερώθηκε σε ${result.updatedCount} προϊόντα.`
      ] : [
        result.assignedCount > 0
          ? `Η παραλλαγή προστέθηκε σε ${result.assignedCount} προϊόντα.`
          : 'Δεν έγινε νέα ανάθεση.'
      ];
      if (result.unchangedCount > 0) {
        messages.push(`${result.unchangedCount} είχαν ήδη την τρέχουσα τιμή.`);
      }
      if (result.unassignedCount > 0) {
        messages.push(`${result.unassignedCount} δεν είχαν την παραλλαγή και παραλείφθηκαν.`);
      }
      if (result.alreadyAssignedCount > 0) {
        messages.push(`${result.alreadyAssignedCount} είχαν ήδη την παραλλαγή.`);
      }
      if (result.incompatibleCount > 0) {
        messages.push(`${result.incompatibleCount} είχαν ασύμβατη συσκευασία.`);
      }
      if (result.missingCount > 0) {
        messages.push(`${result.missingCount} δεν βρέθηκαν.`);
      }
      this.bulkMessage.set(messages.join(' '));
    } finally {
      this.bulkApplying.set(false);
    }
  }

  protected startEdit(product: ProductRow): void {
    void this.router.navigate(['/products', product.id, 'edit']);
  }

  protected async toggleActive(product: ProductRow): Promise<void> {
    await this.productsService.toggleProductActive(product.id, !product.active);
  }

  protected async deleteProduct(product: ProductRow): Promise<void> {
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά το προϊόν "${product.name}" (${product.productCode});`);
    if (!confirmed) return;
    await this.productsService.deleteProduct(product.id);
  }

  protected formatPrice(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(value);
  }

  protected getAssignedVariantsCount(product: ProductRow): number {
    return Object.keys(product.variantAssignments ?? {}).length;
  }

}
