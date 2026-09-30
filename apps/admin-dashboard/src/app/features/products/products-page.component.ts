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
  protected readonly editingProductId = signal<string | null>(null);

  protected readonly loading = this.productsService.loading;
  protected readonly error = this.productsService.error;
  protected readonly brands = this.productsService.brands;
  protected readonly categories = this.productsService.categories;
  protected readonly variantTemplates = this.productsService.variantTemplates;

  protected readonly selectedVariantTemplateIds = signal<string[]>([]);
  protected readonly variantSelectionError = signal<string | null>(null);

  // templateId → { sellingPrice, costPrice? }
  protected readonly variantAssignments = signal<Record<string, ProductVariantAssignment>>({});

  protected readonly productTypeOptions: ProductType[] = ['PERFUME', 'OTHER'];
  protected readonly genderOptions: ProductGender[] = ['M', 'F', 'UNISEX'];
  protected readonly packagingCategoryOptions: PackagingCategory[] = ['PACKAGED', 'BULK'];

  // Only show variant templates that match the selected packaging category
  protected readonly filteredVariantTemplates = computed(() => {
    const pkgCategory = this.productForm.controls.packagingCategory.value;
    return this.variantTemplates().filter((t) => t.packagingType === pkgCategory);
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
    packagingCategory: ['PACKAGED' as PackagingCategory, [Validators.required]],
    gender: [''],
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
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
      active: form.active
    };

    if (!payload.productCode || !payload.name) {
      return;
    }

    if (Object.keys(payload.variantAssignments).length === 0) {
      this.variantSelectionError.set('Select at least one variant for this product.');
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
    this.selectedVariantTemplateIds.set([]);
    this.variantAssignments.set(product.variantAssignments ?? {});
    this.variantSelectionError.set(null);
  }

  protected async toggleActive(product: ProductRow): Promise<void> {
    await this.productsService.toggleProductActive(product.id, !product.active);
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
    const current = this.variantAssignments();
    if (current[templateId]) {
      const updated = { ...current };
      delete updated[templateId];
      this.variantAssignments.set(updated);
    } else {
      this.variantAssignments.set({ ...current, [templateId]: { sellingPrice: defaultPrice } });
    }
    const isEmpty = Object.keys(this.variantAssignments()).length === 0;
    if (!isEmpty) this.variantSelectionError.set(null);
  }

  protected setVariantSellingPrice(templateId: string, raw: string): void {
    const price = parseFloat(raw);
    if (!isFinite(price) || price < 0) return;
    const current = this.variantAssignments();
    this.variantAssignments.set({ ...current, [templateId]: { ...current[templateId], sellingPrice: price } });
  }

  protected setVariantCostPrice(templateId: string, raw: string): void {
    const price = parseFloat(raw);
    const current = this.variantAssignments();
    const assignment = { ...current[templateId] };
    if (isFinite(price) && price > 0) {
      assignment.costPrice = price;
    } else {
      delete assignment.costPrice;
    }
    this.variantAssignments.set({ ...current, [templateId]: assignment });
  }

  protected isVariantTemplateSelected(templateId: string): boolean {
    return templateId in this.variantAssignments();
  }

  protected getVariantAssignment(templateId: string): ProductVariantAssignment | undefined {
    return this.variantAssignments()[templateId];
  }

  protected async seedVariantTemplates(): Promise<void> {
    await this.productsService.seedDefaultVariantTemplates();
  }

  private resetForm(): void {
    this.editingProductId.set(null);
    this.productForm.reset({
      productCode: '',
      name: '',
      brandId: '',
      categoryId: '',
      productType: 'PERFUME',
      packagingCategory: 'PACKAGED',
      gender: '',
      active: true
    });
    this.selectedVariantTemplateIds.set([]);
    this.variantAssignments.set({});
    this.variantSelectionError.set(null);
  }
}
