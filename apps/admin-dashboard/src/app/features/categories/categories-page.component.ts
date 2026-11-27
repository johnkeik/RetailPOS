import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProductsService } from '../products/products.service';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { DrawerComponent } from '../../shared/ui/drawer.component';
import { SearchFieldComponent } from '../../shared/ui/search-field.component';
import { CategoriesService, CategoryRow } from './categories.service';

@Component({
  selector: 'app-categories-page',
  imports: [ReactiveFormsModule, RouterLink, PageTitleComponent, EntityActionsComponent, DrawerComponent, SearchFieldComponent],
  templateUrl: './categories-page.component.html',
  styleUrl: './categories-page.component.scss'
})
export class CategoriesPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly categoriesService = inject(CategoriesService);

  private readonly productsService = inject(ProductsService);

  protected readonly searchQuery = signal('');

  /** How many products use each category; shown in the list and checked before deleting. */
  protected readonly productCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const product of this.productsService.products()) {
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
    return counts;
  });

  constructor() {
    if (this.productsService.products().length === 0) void this.productsService.loadAll();
  }
  protected readonly editingCategoryId = signal<string | null>(null);
  protected readonly drawerOpen = signal(false);

  protected readonly loading = this.categoriesService.loading;
  protected readonly error = this.categoriesService.error;

  protected readonly filteredCategories = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const rows = this.categoriesService.categories();

    if (!query) {
      return rows;
    }

    return rows.filter((category) => {
      const code = category.code ?? '';
      return (
        category.name.toLowerCase().includes(query) ||
        code.toLowerCase().includes(query)
      );
    });
  });

  protected readonly categoryForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    code: ['', [Validators.maxLength(40)]],
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected async saveCategory(): Promise<void> {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const form = this.categoryForm.getRawValue();
    const normalizedName = form.name.trim();
    const normalizedCode = form.code.trim().toLowerCase();
    const activeId = this.editingCategoryId();

    if (!normalizedName) {
      this.categoryForm.controls.name.setErrors({ required: true });
      return;
    }

    if (activeId) {
      await this.categoriesService.updateCategory(activeId, {
        name: normalizedName,
        code: normalizedCode || undefined,
        active: form.active
      });
    } else {
      await this.categoriesService.createCategory({
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

  protected startEdit(category: CategoryRow): void {
    this.editingCategoryId.set(category.id);
    this.categoryForm.setValue({
      name: category.name,
      code: category.code ?? '',
      active: category.active
    });
    this.drawerOpen.set(true);
  }

  protected async toggleActive(category: CategoryRow): Promise<void> {
    await this.categoriesService.toggleCategoryActive(category.id, !category.active);
  }

  protected async deleteCategory(category: CategoryRow): Promise<void> {
    const inUse = this.productCounts().get(category.id) ?? 0;
    const warning = inUse ? `\n\nΧρησιμοποιείται σε ${inUse} προϊόντα.` : '';
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά την κατηγορία "${category.name}";${warning}`);
    if (!confirmed) return;
    const ok = await this.categoriesService.deleteCategory(category.id);
    if (ok && this.editingCategoryId() === category.id) {
      this.resetForm();
    }
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected isEditing(category: CategoryRow): boolean {
    return this.editingCategoryId() === category.id;
  }

  private resetForm(): void {
    this.drawerOpen.set(false);
    this.editingCategoryId.set(null);
    this.categoryForm.reset({
      name: '',
      code: '',
      active: true
    });
  }
}
