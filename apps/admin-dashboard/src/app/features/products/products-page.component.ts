import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { ProductRow, ProductsService } from './products.service';

@Component({
  selector: 'app-products-page',
  imports: [RouterLink, PageTitleComponent, EntityActionsComponent],
  templateUrl: './products-page.component.html',
  styleUrl: './products-page.component.scss'
})
export class ProductsPageComponent {
  private readonly productsService = inject(ProductsService);
  private readonly router = inject(Router);

  protected readonly searchQuery = signal('');
  protected readonly selectedCategoryId = signal('');
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

  protected readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const categoryId = this.selectedCategoryId();
    const rows = this.productsService.products();

    return rows.filter((product) => {
      const matchesCategory = !categoryId || product.categoryId === categoryId;
      const matchesQuery = !query ||
        product.productCode.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query) ||
        product.brandName.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  });

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

  protected async bulkAssignVariant(): Promise<void> {
    const productIds = this.selectedProductIds();
    const templateId = this.bulkVariantTemplateId();
    if (!productIds.length || !templateId || this.bulkApplying()) return;

    this.bulkApplying.set(true);
    this.bulkMessage.set(null);
    try {
      const result = await this.productsService.assignVariantToProducts(productIds, templateId);
      if (!result) return;

      const messages = [
        result.assignedCount > 0
          ? `Η παραλλαγή προστέθηκε σε ${result.assignedCount} προϊόντα.`
          : 'Δεν έγινε νέα ανάθεση.'
      ];
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

  protected getAssignedVariantsCount(product: ProductRow): number {
    return Object.keys(product.variantAssignments ?? {}).length;
  }

}
