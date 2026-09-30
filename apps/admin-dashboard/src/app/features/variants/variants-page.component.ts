import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ConsumablePart, PackagingType } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { VariantTemplateRow, VariantsService } from './variants.service';

@Component({
  selector: 'app-variants-page',
  imports: [ReactiveFormsModule, PageTitleComponent],
  templateUrl: './variants-page.component.html',
  styleUrl: './variants-page.component.scss'
})
export class VariantsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly variantsService = inject(VariantsService);

  protected readonly searchQuery = signal('');
  protected readonly editingVariantId = signal<string | null>(null);
  protected readonly editingConsumableParts = signal<ConsumablePart[]>([]);
  protected readonly newConsumableTemplateId = signal('');
  protected readonly newConsumableQty = signal(1);

  protected readonly loading = this.variantsService.loading;
  protected readonly error = this.variantsService.error;
  protected readonly formError = signal<string | null>(null);

  protected readonly packagingOptions: PackagingType[] = ['PACKAGED', 'BULK'];

  protected readonly isFormBulk = computed(
    () => this.variantForm.controls.packagingType.value === 'BULK'
  );

  protected readonly consumablePartRows = computed(() => {
    const templates = this.variantsService.variants();
    return this.editingConsumableParts().map((part) => ({
      ...part,
      templateName: templates.find((t) => t.id === part.variantTemplateId)?.name ?? part.variantTemplateId
    }));
  });

  protected readonly availableConsumableTemplates = computed(() => {
    const editingId = this.editingVariantId();
    const used = new Set(this.editingConsumableParts().map((p) => p.variantTemplateId));
    return this.variantsService.variants().filter((t) => t.id !== editingId && !used.has(t.id));
  });

  ngOnInit(): void {
    void this.variantsService.loadAll();
  }

  protected readonly filteredVariants = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const rows = this.variantsService.variants();

    if (!query) {
      return rows;
    }

    return rows.filter((variant) => {
      return (
        variant.name.toLowerCase().includes(query) ||
        (variant.code ?? '').toLowerCase().includes(query) ||
        variant.packagingType.toLowerCase().includes(query) ||
        variant.unit.toLowerCase().includes(query)
      );
    });
  });

  protected readonly variantForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    code: ['', [Validators.maxLength(60)]],
    size: [''],
    unit: ['ml', [Validators.required, Validators.maxLength(10)]],
    packagingType: ['PACKAGED' as PackagingType, [Validators.required]],
    costPrice: [''],
    sellingPrice: [0, [Validators.required, Validators.min(0)]],
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected async saveVariant(): Promise<void> {
    if (this.variantForm.invalid) {
      this.variantForm.markAllAsTouched();
      this.formError.set('Συμπληρώστε τα υποχρεωτικά πεδία πριν την αποθήκευση.');
      return;
    }

    const form = this.variantForm.getRawValue();
    const normalizedSize = String(form.size ?? '').trim();
    const normalizedCost = String(form.costPrice ?? '').trim();
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      size: normalizedSize ? Number(normalizedSize) : undefined,
      unit: form.unit.trim().toLowerCase(),
      packagingType: form.packagingType,
      costPrice: normalizedCost ? Number(normalizedCost) : undefined,
      sellingPrice: Number(form.sellingPrice),
      consumableParts: form.packagingType === 'BULK' ? this.editingConsumableParts() : [],
      active: form.active
    };

    if (!payload.name) {
      this.formError.set('Το όνομα προτύπου είναι υποχρεωτικό.');
      return;
    }

    if (!payload.unit) {
      this.formError.set('Η μονάδα μέτρησης είναι υποχρεωτική.');
      return;
    }

    this.formError.set(null);

    const activeId = this.editingVariantId();
    if (activeId) {
      await this.variantsService.updateVariant(activeId, payload);
    } else {
      await this.variantsService.createVariant(payload);
    }

    this.resetForm();
  }

  protected startEdit(variant: VariantTemplateRow): void {
    this.editingVariantId.set(variant.id);
    this.editingConsumableParts.set([...(variant.consumableParts ?? [])]);
    this.newConsumableTemplateId.set('');
    this.newConsumableQty.set(1);
    this.variantForm.setValue({
      name: variant.name,
      code: variant.code ?? '',
      size: variant.size !== undefined ? String(variant.size) : '',
      unit: variant.unit,
      packagingType: variant.packagingType,
      costPrice: variant.costPrice !== undefined ? String(variant.costPrice) : '',
      sellingPrice: variant.sellingPrice,
      active: variant.active
    });
  }

  protected async toggleActive(variant: VariantTemplateRow): Promise<void> {
    await this.variantsService.toggleVariantActive(variant.id, !variant.active);
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected addConsumablePart(): void {
    const templateId = this.newConsumableTemplateId().trim();
    const qty = Number(this.newConsumableQty());
    if (!templateId || qty <= 0) { return; }
    this.editingConsumableParts.update((parts) => [...parts, { variantTemplateId: templateId, quantity: qty }]);
    this.newConsumableTemplateId.set('');
    this.newConsumableQty.set(1);
  }

  protected removeConsumablePart(variantTemplateId: string): void {
    this.editingConsumableParts.update((parts) => parts.filter((p) => p.variantTemplateId !== variantTemplateId));
  }

  protected isEditing(variant: VariantTemplateRow): boolean {
    return this.editingVariantId() === variant.id;
  }

  private resetForm(): void {
    this.editingVariantId.set(null);
    this.formError.set(null);
    this.editingConsumableParts.set([]);
    this.newConsumableTemplateId.set('');
    this.newConsumableQty.set(1);
    this.variantForm.reset({
      name: '',
      code: '',
      size: '',
      unit: 'ml',
      packagingType: 'PACKAGED',
      costPrice: '',
      sellingPrice: 0,
      active: true
    });
  }
}
