import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { BrandRow, BrandsService } from './brands.service';
import { PageTitleComponent } from '../../shared/ui/page-title.component';

@Component({
  selector: 'app-brands-page',
  imports: [ReactiveFormsModule, PageTitleComponent],
  templateUrl: './brands-page.component.html',
  styleUrl: './brands-page.component.scss'
})
export class BrandsPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly brandsService = inject(BrandsService);

  protected readonly searchQuery = signal('');
  protected readonly editingBrandId = signal<string | null>(null);

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

  protected startEdit(brand: BrandRow): void {
    this.editingBrandId.set(brand.id);
    this.brandForm.setValue({
      name: brand.name,
      code: brand.code ?? '',
      active: brand.active
    });
  }

  protected async toggleActive(brand: BrandRow): Promise<void> {
    await this.brandsService.toggleBrandActive(brand.id, !brand.active);
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected isEditing(brand: BrandRow): boolean {
    return this.editingBrandId() === brand.id;
  }

  private resetForm(): void {
    this.editingBrandId.set(null);
    this.brandForm.reset({
      name: '',
      code: '',
      active: true
    });
  }
}