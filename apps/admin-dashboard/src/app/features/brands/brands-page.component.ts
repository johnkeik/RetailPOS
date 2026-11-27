import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { BrandRow, BrandsService } from './brands.service';
import { ProductsService } from '../products/products.service';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { DrawerComponent } from '../../shared/ui/drawer.component';
import { SearchFieldComponent } from '../../shared/ui/search-field.component';

@Component({
  selector: 'app-brands-page',
  imports: [ReactiveFormsModule, RouterLink, PageTitleComponent, EntityActionsComponent, DrawerComponent, SearchFieldComponent],
  templateUrl: './brands-page.component.html',
  styleUrl: './brands-page.component.scss'
})
export class BrandsPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly brandsService = inject(BrandsService);

  private readonly productsService = inject(ProductsService);

  protected readonly searchQuery = signal('');

  /** How many products use each brand; shown in the list and checked before deleting. */
  protected readonly productCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const product of this.productsService.products()) {
      counts.set(product.brandId, (counts.get(product.brandId) ?? 0) + 1);
    }
    return counts;
  });

  constructor() {
    if (this.productsService.products().length === 0) void this.productsService.loadAll();
  }
  protected readonly editingBrandId = signal<string | null>(null);
  protected readonly drawerOpen = signal(false);

  protected readonly loading = this.brandsService.loading;
  protected readonly error = this.brandsService.error;

  protected readonly filteredBrands = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const rows = this.brandsService.brands();

    if (!query) {
      return rows;
    }

    return rows.filter((brand) => {
      const code = brand.code ?? '';
      return (
        brand.name.toLowerCase().includes(query) ||
        code.toLowerCase().includes(query)
      );
    });
  });

  protected readonly brandForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    code: ['', [Validators.maxLength(40)]],
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected async saveBrand(): Promise<void> {
    if (this.brandForm.invalid) {
      this.brandForm.markAllAsTouched();
      return;
    }

    const form = this.brandForm.getRawValue();
    const normalizedName = form.name.trim();
    const normalizedCode = form.code.trim().toLowerCase();
    const activeId = this.editingBrandId();

    if (!normalizedName) {
      this.brandForm.controls.name.setErrors({ required: true });
      return;
    }

    if (activeId) {
      await this.brandsService.updateBrand(activeId, {
        name: normalizedName,
        code: normalizedCode || undefined,
        active: form.active
      });
    } else {
      await this.brandsService.createBrand({
        name: normalizedName,
        code: normalizedCode || undefined,
        active: form.active
      });
    }

    this.resetForm();
  }

  protected openCreate(): void {
    this.resetForm();
    this.drawerOpen.set(true);
  }

  protected startEdit(brand: BrandRow): void {
    this.editingBrandId.set(brand.id);
    this.brandForm.setValue({
      name: brand.name,
      code: brand.code ?? '',
      active: brand.active
    });
    this.drawerOpen.set(true);
  }

  protected async toggleActive(brand: BrandRow): Promise<void> {
    await this.brandsService.toggleBrandActive(brand.id, !brand.active);
  }

  protected async deleteBrand(brand: BrandRow): Promise<void> {
    const inUse = this.productCounts().get(brand.id) ?? 0;
    const warning = inUse ? `\n\nΧρησιμοποιείται σε ${inUse} προϊόντα.` : '';
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά τη μάρκα "${brand.name}";${warning}`);
    if (!confirmed) return;
    const ok = await this.brandsService.deleteBrand(brand.id);
    if (ok && this.editingBrandId() === brand.id) {
      this.resetForm();
    }
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected isEditing(brand: BrandRow): boolean {
    return this.editingBrandId() === brand.id;
  }

  private resetForm(): void {
    this.drawerOpen.set(false);
    this.editingBrandId.set(null);
    this.brandForm.reset({
      name: '',
      code: '',
      active: true
    });
  }
}