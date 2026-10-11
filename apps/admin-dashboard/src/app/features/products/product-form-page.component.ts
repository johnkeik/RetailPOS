import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';

import { PackagingCategory, ProductGender, ProductType, ProductVariantAssignment } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { ProductRow, ProductsService, VariantTemplateOption } from './products.service';

@Component({
  selector: 'app-product-form-page',
  imports: [ReactiveFormsModule, RouterLink, PageTitleComponent, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './product-form-page.component.html',
  styleUrl: './product-form-page.component.scss'
})
export class ProductFormPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly productId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditing = computed(() => this.productId !== null);
  protected readonly loading = this.productsService.loading;
  protected readonly error = this.productsService.error;
  protected readonly brands = this.productsService.brands;
  protected readonly categories = this.productsService.categories;
  protected readonly variantTemplates = this.productsService.variantTemplates;
  protected readonly productLoadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly variantSelectionError = signal<string | null>(null);
  protected readonly variantSearch = signal('');
  protected readonly variantAssignments = signal<Record<string, ProductVariantAssignment>>({});
  protected readonly variantOrder = signal<string[]>([]);
  protected readonly variantOrderExpanded = signal(false);

  protected readonly productTypeOptions: ProductType[] = ['PERFUME', 'OTHER'];
  protected readonly genderOptions: ProductGender[] = ['M', 'F', 'UNISEX'];
  protected readonly packagingCategoryOptions: PackagingCategory[] = ['BULK', 'PACKAGED'];

  protected readonly availableVariantTemplates = computed(() =>
    this.variantTemplates().filter((template) => template.active)
  );

  protected readonly filteredVariantTemplates = computed(() => {
    const packagingCategory = this.productForm.controls.packagingCategory.value;
    return this.availableVariantTemplates().filter((template) => template.packagingType === packagingCategory);
  });

  protected readonly visibleVariantTemplates = computed(() => {
    const query = this.variantSearch().trim().toLocaleLowerCase();
    return this.filteredVariantTemplates().filter((template) =>
      !query || template.name.toLocaleLowerCase().includes(query) || template.code?.toLocaleLowerCase().includes(query)
    );
  });

  protected readonly orderedAssignedVariants = computed(() => {
    const templatesById = new Map(this.filteredVariantTemplates().map((template) => [template.id, template]));
    return this.getOrderedVariantIds().flatMap((id) => {
      const template = templatesById.get(id);
      return template ? [template] : [];
    });
  });

  protected readonly productForm = this.formBuilder.nonNullable.group({
    productCode: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    brandId: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
    productType: ['PERFUME' as ProductType, [Validators.required]],
    packagingCategory: ['BULK' as PackagingCategory, [Validators.required]],
    gender: [''],
    ingredients: ['', [Validators.maxLength(500)]],
    active: [true]
  });

  async ngOnInit(): Promise<void> {
    await this.productsService.loadAll();
    if (!this.productId) return;

    const product = this.productsService.products().find((item) => item.id === this.productId);
    if (!product) {
      this.productLoadError.set('Το προϊόν δεν βρέθηκε.');
      return;
    }

    this.loadProduct(product);
  }

  protected onBack(): void {
    void this.router.navigateByUrl('/products');
  }

  protected onPackagingCategoryChange(): void {
    this.variantAssignments.set({});
    this.variantOrder.set([]);
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
      ingredients: form.ingredients.trim(),
      variantAssignments: this.variantAssignments(),
      variantOrder: this.getOrderedVariantIds(),
      active: form.active
    };

    if (Object.keys(payload.variantAssignments).length === 0) {
      this.variantSelectionError.set('Επιλέξτε τουλάχιστον μία παραλλαγή για αυτό το προϊόν.');
      return;
    }

    this.variantSelectionError.set(null);
    this.saving.set(true);
    try {
      if (this.productId) {
        await this.productsService.updateProduct(this.productId, payload);
      } else {
        await this.productsService.createProduct(payload);
      }

      if (!this.productsService.error()) {
        await this.router.navigateByUrl('/products');
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteProduct(): Promise<void> {
    const product = this.productsService.products().find((item) => item.id === this.productId);
    if (!product) return;

    const confirmed = window.confirm(
      `Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά το προϊόν "${product.name}" (${product.productCode});`
    );
    if (confirmed && await this.productsService.deleteProduct(product.id)) {
      await this.router.navigateByUrl('/products');
    }
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

    if (Object.keys(this.variantAssignments()).length > 0) {
      this.variantSelectionError.set(null);
    }
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

  protected reorderVariants(event: CdkDragDrop<VariantTemplateOption[]>): void {
    const order = this.orderedAssignedVariants().map((template) => template.id);
    moveItemInArray(order, event.previousIndex, event.currentIndex);
    this.variantOrder.set(order);
  }

  protected toggleVariantOrder(): void {
    this.variantOrderExpanded.update((expanded) => !expanded);
  }

  protected getOrderedVariantIds(): string[] {
    const assignments = this.variantAssignments();
    const selectedIds = new Set(Object.keys(assignments));
    const orderedIds = [...new Set(this.variantOrder().filter((id) => selectedIds.has(id)))];
    return [...orderedIds, ...Object.keys(assignments).filter((id) => !orderedIds.includes(id))];
  }

  private loadProduct(product: ProductRow): void {
    this.productForm.setValue({
      productCode: product.productCode,
      name: product.name,
      brandId: product.brandId,
      categoryId: product.categoryId,
      productType: product.productType,
      packagingCategory: product.packagingCategory,
      gender: product.gender ?? '',
      ingredients: product.ingredients ?? '',
      active: product.active
    });

    const assignments = { ...(product.variantAssignments ?? {}) };
    this.variantAssignments.set(assignments);
    const selectedIds = new Set(Object.keys(assignments));
    const savedOrder = [...new Set((product.variantOrder ?? []).filter((id) => selectedIds.has(id)))];
    const defaultOrder = this.getDefaultVariantOrder(assignments);
    this.variantOrder.set([...savedOrder, ...defaultOrder.filter((id) => !savedOrder.includes(id))]);
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