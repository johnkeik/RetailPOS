import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PackagingCategory, ProductGender, ProductType, ProductVariantAssignment } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { ProductRow, ProductsService, VariantTemplateOption } from './products.service';

@Component({
  selector: 'app-products-page',
  imports: [ReactiveFormsModule, PageTitleComponent, EntityActionsComponent],
  templateUrl: './products-page.component.html',
  styleUrl: './products-page.component.scss'
})
export class ProductsPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);

  protected readonly searchQuery = signal('');
  protected readonly selectedCategoryId = signal('');
  protected readonly pageSize = signal(25);
  protected readonly pageIndex = signal(0);
  protected readonly pageSizeOptions = [25, 50, 100];
  protected readonly isDrawerOpen = signal(false);
  protected readonly editingProductId = signal<string | null>(null);
  protected readonly selectedProductIds = signal<string[]>([]);
  protected readonly bulkVariantTemplateId = signal('');
  protected readonly bulkApplying = signal(false);
  protected readonly bulkMessage = signal<string | null>(null);

  protected readonly loading = this.productsService.loading;
  protected readonly error = this.productsService.error;
  protected readonly brands = this.productsService.brands;
  protected readonly categories = this.productsService.categories;
  protected readonly variantTemplates = this.productsService.variantTemplates;

  protected readonly variantSelectionError = signal<string | null>(null);

  // templateId → { sellingPrice, costPrice? }
  protected readonly variantAssignments = signal<Record<string, ProductVariantAssignment>>({});
  protected readonly variantOrder = signal<string[]>([]);

  protected readonly productTypeOptions: ProductType[] = ['PERFUME', 'OTHER'];
  protected readonly genderOptions: ProductGender[] = ['M', 'F', 'UNISEX'];
  protected readonly packagingCategoryOptions: PackagingCategory[] = ['BULK', 'PACKAGED'];

  // All active variant templates
  protected readonly availableVariantTemplates = computed(() => {
    return this.variantTemplates().filter((t) => t.active);
  });

  // Filter templates based on product form packagingCategory
  protected readonly filteredVariantTemplates = computed(() => {
    const pkgCategory = this.productForm.controls.packagingCategory.value;
    return this.availableVariantTemplates().filter((t) => t.packagingType === pkgCategory);
  });

  protected readonly orderedAssignedVariants = computed(() => {
    const templatesById = new Map(this.filteredVariantTemplates().map((template) => [template.id, template]));
    return this.getOrderedVariantIds().flatMap((id) => {
      const template = templatesById.get(id);
      return template ? [template] : [];
    });
  });

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

  protected readonly productForm = this.formBuilder.nonNullable.group({
    productCode: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    brandId: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
    productType: ['PERFUME' as ProductType, [Validators.required]],
    packagingCategory: ['BULK' as PackagingCategory, [Validators.required]],
    gender: [''],
    active: [true]
  });

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

  protected openCreateDrawer(): void {
    this.resetForm();
    this.isDrawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.resetForm();
  }

  protected onPackagingCategoryChange(): void {
    // When switching packaging category (BULK <-> PACKAGED), clear previous assignments to prevent mixing
    this.variantAssignments.set({});
  }

  protected async saveProduct(): Promise<void> {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const form = this.productForm.getRawValue();
    const payload = {
      productCode: form.productCode.trim(),
      name: form.name.trim(),
      brandId: form.brandId,
      categoryId: form.categoryId,
      productType: form.productType,
      packagingCategory: form.packagingCategory,
      gender: (form.gender || undefined) as ProductGender | undefined,
      variantAssignments: this.variantAssignments(),
      variantOrder: this.getOrderedVariantIds(),
      active: form.active
    };

    if (!payload.productCode || !payload.name) {
      return;
    }

    if (Object.keys(payload.variantAssignments).length === 0) {
      this.variantSelectionError.set('Επιλέξτε τουλάχιστον μία παραλλαγή για αυτό το προϊόν.');
      return;
    }

    this.variantSelectionError.set(null);

    const activeId = this.editingProductId();
    if (activeId) {
      await this.productsService.updateProduct(activeId, payload);
    } else {
      await this.productsService.createProduct(payload);
    }

    this.resetForm();
  }

  protected startEdit(product: ProductRow): void {
    this.editingProductId.set(product.id);
    this.productForm.setValue({
      productCode: product.productCode,
      name: product.name,
      brandId: product.brandId,
      categoryId: product.categoryId,
      productType: product.productType,
      packagingCategory: product.packagingCategory,
      gender: product.gender ?? '',
      active: product.active
    });
    const assignments = { ...(product.variantAssignments ?? {}) };
    this.variantAssignments.set(assignments);
    const selectedIds = new Set(Object.keys(assignments));
    const savedOrder = [...new Set((product.variantOrder ?? []).filter((id) => selectedIds.has(id)))];
    const defaultOrder = this.getDefaultVariantOrder(assignments);
    this.variantOrder.set([...savedOrder, ...defaultOrder.filter((id) => !savedOrder.includes(id))]);
    this.variantSelectionError.set(null);
    this.isDrawerOpen.set(true);
  }

  protected async toggleActive(product: ProductRow): Promise<void> {
    await this.productsService.toggleProductActive(product.id, !product.active);
  }

  protected async deleteProduct(product: ProductRow): Promise<void> {
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά το προϊόν "${product.name}" (${product.productCode});`);
    if (!confirmed) return;
    const ok = await this.productsService.deleteProduct(product.id);
    if (ok && this.editingProductId() === product.id) {
      this.closeDrawer();
    }
  }

  protected async deleteCurrentEditingProduct(): Promise<void> {
    const id = this.editingProductId();
    if (!id) return;
    const name = this.productForm.controls.name.value;
    const code = this.productForm.controls.productCode.value;
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά το προϊόν "${name}" (${code});`);
    if (!confirmed) return;
    const ok = await this.productsService.deleteProduct(id);
    if (ok) {
      this.closeDrawer();
    }
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected isEditing(product: ProductRow): boolean {
    return this.editingProductId() === product.id;
  }

  protected hasCatalogDependencies(): boolean {
    return this.brands().length > 0 && this.categories().length > 0;
  }

  protected hasVariantTemplates(): boolean {
    return this.variantTemplates().length > 0;
  }

  protected toggleVariantTemplate(templateId: string, defaultPrice: number): void {
    const current = { ...this.variantAssignments() };
    if (current[templateId]) {
      delete current[templateId];
      this.variantAssignments.set(current);
      this.variantOrder.set(this.variantOrder().filter((id) => id !== templateId));
    } else {
      current[templateId] = { sellingPrice: defaultPrice };
      this.variantAssignments.set(current);
      this.variantOrder.set(this.getOrderedVariantIds());
    }
    const isEmpty = Object.keys(this.variantAssignments()).length === 0;
    if (!isEmpty) this.variantSelectionError.set(null);
  }

  protected setVariantSellingPrice(templateId: string, raw: string): void {
    const price = parseFloat(raw);
    if (!isFinite(price) || price < 0) return;
    const current = { ...this.variantAssignments() };
    current[templateId] = { ...current[templateId], sellingPrice: price };
    this.variantAssignments.set(current);
  }

  protected setVariantCostPrice(templateId: string, raw: string): void {
    const price = parseFloat(raw);
    const current = { ...this.variantAssignments() };
    const assignment = { ...current[templateId] };
    if (isFinite(price) && price > 0) {
      assignment.costPrice = price;
    } else {
      delete assignment.costPrice;
    }
    current[templateId] = assignment;
    this.variantAssignments.set(current);
  }

  protected isVariantTemplateSelected(templateId: string): boolean {
    return templateId in this.variantAssignments();
  }

  protected getVariantAssignment(templateId: string): ProductVariantAssignment | undefined {
    return this.variantAssignments()[templateId];
  }

  protected moveVariant(templateId: string, direction: -1 | 1): void {
    const order = this.getOrderedVariantIds();
    const index = order.indexOf(templateId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;

    const [variantId] = order.splice(index, 1);
    order.splice(nextIndex, 0, variantId);
    this.variantOrder.set(order);
  }

  protected getAssignedVariantsCount(product: ProductRow): number {
    return Object.keys(product.variantAssignments ?? {}).length;
  }

  protected async seedVariantTemplates(): Promise<void> {
    await this.productsService.seedDefaultVariantTemplates();
  }

  private resetForm(): void {
    this.isDrawerOpen.set(false);
    this.editingProductId.set(null);
    this.productForm.reset({
      productCode: '',
      name: '',
      brandId: '',
      categoryId: '',
      productType: 'PERFUME',
      packagingCategory: 'BULK',
      gender: '',
      active: true
    });
    this.variantAssignments.set({});
    this.variantOrder.set([]);
    this.variantSelectionError.set(null);
  }

  private getOrderedVariantIds(): string[] {
    const assignments = this.variantAssignments();
    const selectedIds = new Set(Object.keys(assignments));
    const orderedIds = [...new Set(this.variantOrder().filter((id) => selectedIds.has(id)))];
    return [...orderedIds, ...Object.keys(assignments).filter((id) => !orderedIds.includes(id))];
  }

  private getDefaultVariantOrder(assignments: Record<string, ProductVariantAssignment>): string[] {
    const selectedIds = new Set(Object.keys(assignments));
    const templates = this.variantTemplates()
      .filter((template) => selectedIds.has(template.id))
      .sort((left, right) => {
        const typeOrder = (left.packagingType === 'PACKAGED' ? 0 : 1) -
          (right.packagingType === 'PACKAGED' ? 0 : 1);
        if (typeOrder !== 0) return typeOrder;

        const leftLabel = this.variantSortLabel(left);
        const rightLabel = this.variantSortLabel(right);
        return leftLabel < rightLabel ? -1 : leftLabel > rightLabel ? 1 : 0;
      });
    const knownIds = templates.map((template) => template.id);
    return [...knownIds, ...Object.keys(assignments).filter((id) => !knownIds.includes(id))];
  }

  private variantSortLabel(template: VariantTemplateOption): string {
    const unit = template.unit.trim();
    if (template.size == null || !unit) return template.name.trim() || template.code || 'Variant';
    const size = Number.isInteger(template.size) ? String(template.size) : template.size.toFixed(1);
    return `${size}${unit}`;
  }
}
