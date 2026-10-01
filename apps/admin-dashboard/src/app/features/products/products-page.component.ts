import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PackagingCategory, ProductGender, ProductType, ProductVariantAssignment } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { ProductRow, ProductsService } from './products.service';

@Component({
  selector: 'app-products-page',
  imports: [ReactiveFormsModule, PageTitleComponent],
  templateUrl: './products-page.component.html',
  styleUrl: './products-page.component.scss'
})
export class ProductsPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);

  protected readonly searchQuery = signal('');
  protected readonly isDrawerOpen = signal(false);
  protected readonly editingProductId = signal<string | null>(null);

  protected readonly loading = this.productsService.loading;
  protected readonly error = this.productsService.error;
  protected readonly brands = this.productsService.brands;
  protected readonly categories = this.productsService.categories;
  protected readonly variantTemplates = this.productsService.variantTemplates;

  protected readonly variantSelectionError = signal<string | null>(null);

  // templateId → { sellingPrice, costPrice? }
  protected readonly variantAssignments = signal<Record<string, ProductVariantAssignment>>({});

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

  protected readonly filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const rows = this.productsService.products();

    if (!query) {
      return rows;
    }

    return rows.filter((product) => {
      return (
        product.productCode.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query) ||
        product.brandName.toLowerCase().includes(query)
      );
    });
  });

  protected readonly productForm = this.formBuilder.nonNullable.group({
    productCode: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    brandId: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
    productType: ['PERFUME' as ProductType, [Validators.required]],
    packagingCategory: ['BULK' as PackagingCategory, [Validators.required]],
    perfumeBaseCode: [''],
    essenceCode: [''],
    gender: [''],
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
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
      perfumeBaseCode: form.perfumeBaseCode?.trim() || undefined,
      essenceCode: form.essenceCode?.trim() || undefined,
      gender: (form.gender || undefined) as ProductGender | undefined,
      variantAssignments: this.variantAssignments(),
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
      perfumeBaseCode: product.perfumeBaseCode ?? '',
      essenceCode: product.essenceCode ?? '',
      gender: product.gender ?? '',
      active: product.active
    });
    this.variantAssignments.set({ ...(product.variantAssignments ?? {}) });
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
    } else {
      current[templateId] = { sellingPrice: defaultPrice };
      this.variantAssignments.set(current);
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
      perfumeBaseCode: '',
      essenceCode: '',
      gender: '',
      active: true
    });
    this.variantAssignments.set({});
    this.variantSelectionError.set(null);
  }
}
