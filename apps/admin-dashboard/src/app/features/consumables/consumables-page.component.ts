import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { ConsumableRow, ConsumablesService } from './consumables.service';

@Component({
  selector: 'app-consumables-page',
  imports: [ReactiveFormsModule, PageTitleComponent],
  templateUrl: './consumables-page.component.html',
  styleUrl: './consumables-page.component.scss'
})
export class ConsumablesPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly consumablesService = inject(ConsumablesService);

  protected readonly searchQuery = signal('');
  protected readonly isDrawerOpen = signal(false);
  protected readonly editingConsumableId = signal<string | null>(null);

  protected readonly loading = this.consumablesService.loading;
  protected readonly error = this.consumablesService.error;
  protected readonly formError = signal<string | null>(null);

  ngOnInit(): void {
    void this.consumablesService.loadAll();
  }

  protected readonly filteredConsumables = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const rows = this.consumablesService.consumables();

    if (!query) return rows;

    return rows.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        (item.code ?? '').toLowerCase().includes(query) ||
        item.unit.toLowerCase().includes(query)
      );
    });
  });

  protected readonly consumableForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    code: ['', [Validators.maxLength(60)]],
    unit: ['τεμ.', [Validators.required, Validators.maxLength(20)]],
    costPrice: [''],
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected async saveConsumable(): Promise<void> {
    if (this.consumableForm.invalid) {
      this.consumableForm.markAllAsTouched();
      this.formError.set('Παρακαλώ συμπληρώστε τα υποχρεωτικά πεδία.');
      return;
    }

    const form = this.consumableForm.getRawValue();
    const normalizedCost = String(form.costPrice ?? '').trim();
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      unit: form.unit.trim() || 'τεμ.',
      costPrice: normalizedCost ? Number(normalizedCost) : undefined,
      active: form.active
    };

    if (!payload.name) {
      this.formError.set('Το όνομα αναλωσίμου είναι υποχρεωτικό.');
      return;
    }

    this.formError.set(null);

    const activeId = this.editingConsumableId();
    if (activeId) {
      await this.consumablesService.updateConsumable(activeId, payload);
    } else {
      await this.consumablesService.createConsumable(payload);
    }

    this.resetForm();
  }

  protected openCreateDrawer(): void {
    this.resetForm();
    this.isDrawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.resetForm();
  }

  protected startEdit(item: ConsumableRow): void {
    this.editingConsumableId.set(item.id);
    this.consumableForm.setValue({
      name: item.name,
      code: item.code ?? '',
      unit: item.unit ?? 'τεμ.',
      costPrice: item.costPrice !== undefined ? String(item.costPrice) : '',
      active: item.active
    });
    this.isDrawerOpen.set(true);
  }

  protected async toggleActive(item: ConsumableRow): Promise<void> {
    await this.consumablesService.toggleConsumableActive(item.id, !item.active);
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected isEditing(item: ConsumableRow): boolean {
    return this.editingConsumableId() === item.id;
  }

  private resetForm(): void {
    this.isDrawerOpen.set(false);
    this.editingConsumableId.set(null);
    this.formError.set(null);
    this.consumableForm.reset({
      name: '',
      code: '',
      unit: 'τεμ.',
      costPrice: '',
      active: true
    });
  }
}
