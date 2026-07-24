import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { CategoriesService, CategoryRow } from './categories.service';

@Component({
  selector: 'app-categories-page',
  imports: [ReactiveFormsModule, PageTitleComponent],
  templateUrl: './categories-page.component.html',
  styleUrl: './categories-page.component.scss'
})
export class CategoriesPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly categoriesService = inject(CategoriesService);

  protected readonly searchQuery = signal('');
  protected readonly editingCategoryId = signal<string | null>(null);

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

  protected startEdit(category: CategoryRow): void {
    this.editingCategoryId.set(category.id);
    this.categoryForm.setValue({
      name: category.name,
      code: category.code ?? '',
      active: category.active
    });
  }

  protected async toggleActive(category: CategoryRow): Promise<void> {
    await this.categoriesService.toggleCategoryActive(category.id, !category.active);
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected isEditing(category: CategoryRow): boolean {
    return this.editingCategoryId() === category.id;
  }

  private resetForm(): void {
    this.editingCategoryId.set(null);
    this.categoryForm.reset({
      name: '',
      code: '',
      active: true
    });
  }
}
