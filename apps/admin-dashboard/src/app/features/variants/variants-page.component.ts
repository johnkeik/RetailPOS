import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PackagingType, VariantRecipeConsumable } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { ConsumablesService } from '../consumables/consumables.service';
import { VariantTemplateRow, VariantsService } from './variants.service';

@Component({
  selector: 'app-variants-page',
  imports: [ReactiveFormsModule, PageTitleComponent, EntityActionsComponent],
  templateUrl: './variants-page.component.html',
  styleUrl: './variants-page.component.scss'
})
export class VariantsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly variantsService = inject(VariantsService);
  private readonly consumablesService = inject(ConsumablesService);

  protected readonly searchQuery = signal('');
  protected readonly isDrawerOpen = signal(false);
  protected readonly editingVariantId = signal<string | null>(null);

  // Map of consumableId -> quantity
  protected readonly selectedConsumablesMap = signal<Record<string, number>>({});

  protected readonly loading = this.variantsService.loading;
  protected readonly error = this.variantsService.error;
  protected readonly formError = signal<string | null>(null);

  protected readonly consumables = this.consumablesService.consumables;

  protected readonly packagingOptions: PackagingType[] = ['BULK', 'PACKAGED'];

  protected readonly isFormBulk = computed(
    () => this.variantForm.controls.packagingType.value === 'BULK'
  );

  protected readonly activeConsumables = computed(() => {
    return this.consumables().filter((c) => c.active);
  });

  protected readonly recipeTotalMl = computed(() => {
    const perfume = Number(this.variantForm.controls.perfumeMl.value) || 0;
    const essence = Number(this.variantForm.controls.essenceMl.value) || 0;
    return perfume + essence;
  });

  ngOnInit(): void {
    void this.variantsService.loadAll();
    void this.consumablesService.loadAll();
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
    packagingType: ['BULK' as PackagingType, [Validators.required]],
    costPrice: [''],
    sellingPrice: [0, [Validators.required, Validators.min(0)]],
    perfumeMl: [''],
    essenceMl: [''],
    hasSpecialBottle: [false],
    specialBottleConsumableId: [''],
    specialBottleExtraPrice: [''],
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected isConsumableSelected(consumableId: string): boolean {
    return consumableId in this.selectedConsumablesMap();
  }

  protected getConsumableQty(consumableId: string): number {
    return this.selectedConsumablesMap()[consumableId] ?? 1;
  }

  protected toggleConsumable(consumableId: string): void {
    const current = { ...this.selectedConsumablesMap() };
    if (consumableId in current) {
      delete current[consumableId];
    } else {
      current[consumableId] = 1;
    }
    this.selectedConsumablesMap.set(current);
  }

  protected setConsumableQty(consumableId: string, quantity: number): void {
    const current = { ...this.selectedConsumablesMap() };
    if (consumableId in current) {
      current[consumableId] = Math.max(1, Math.floor(quantity || 1));
      this.selectedConsumablesMap.set(current);
    }
  }

  protected onRecipeInputBlur(): void {
    // If size is empty, auto-calculate size from perfumeMl + essenceMl
    const currentSize = String(this.variantForm.controls.size.value ?? '').trim();
    const totalMl = this.recipeTotalMl();
    if (!currentSize && totalMl > 0) {
      this.variantForm.controls.size.setValue(String(totalMl));
    }
  }

  protected async saveVariant(): Promise<void> {
    if (this.variantForm.invalid) {
      this.variantForm.markAllAsTouched();
      this.formError.set('Παρακαλώ συμπληρώστε τα υποχρεωτικά πεδία.');
      return;
    }

    const form = this.variantForm.getRawValue();
    const normalizedCost = String(form.costPrice ?? '').trim();
    const normalizedPerfume = String(form.perfumeMl ?? '').trim();
    const normalizedEssence = String(form.essenceMl ?? '').trim();
    const normalizedSpecialExtra = String(form.specialBottleExtraPrice ?? '').trim();

    const isBulk = form.packagingType === 'BULK';

    // Auto-fill size from recipe if bulk and size empty
    let sizeNumber: number | undefined = undefined;
    const rawSize = String(form.size ?? '').trim();
    if (rawSize) {
      sizeNumber = Number(rawSize);
    } else if (isBulk && (normalizedPerfume || normalizedEssence)) {
      sizeNumber = (Number(normalizedPerfume) || 0) + (Number(normalizedEssence) || 0);
    }

    // Build recipe consumables array from selected map
    const recipeConsumables: VariantRecipeConsumable[] = isBulk
      ? Object.entries(this.selectedConsumablesMap()).map(([consumableId, quantity]) => ({
          consumableId,
          quantity: Math.max(1, Math.floor(quantity))
        }))
      : [];

    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      size: sizeNumber,
      unit: form.unit.trim().toLowerCase(),
      packagingType: form.packagingType,
      costPrice: normalizedCost ? Number(normalizedCost) : undefined,
      sellingPrice: Number(form.sellingPrice),
      perfumeMl: isBulk && normalizedPerfume ? Number(normalizedPerfume) : undefined,
      essenceMl: isBulk && normalizedEssence ? Number(normalizedEssence) : undefined,
      recipeConsumables,
      hasSpecialBottle: isBulk ? Boolean(form.hasSpecialBottle) : false,
      specialBottleConsumableId: isBulk && form.hasSpecialBottle && form.specialBottleConsumableId ? form.specialBottleConsumableId : undefined,
      specialBottleExtraPrice: isBulk && form.hasSpecialBottle && normalizedSpecialExtra ? Number(normalizedSpecialExtra) : undefined,
      active: form.active
    };

    if (!payload.name) {
      this.formError.set('Το όνομα παραλλαγής είναι υποχρεωτικό.');
      return;
    }

    if (!payload.unit) {
      this.formError.set('Η μονάδα είναι υποχρεωτική.');
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

  protected openCreateDrawer(): void {
    this.resetForm();
    this.isDrawerOpen.set(true);
  }

  protected startEdit(variant: VariantTemplateRow): void {
    this.editingVariantId.set(variant.id);
    const map: Record<string, number> = {};
    for (const item of variant.recipeConsumables ?? []) {
      map[item.consumableId] = item.quantity;
    }
    this.selectedConsumablesMap.set(map);

    this.variantForm.setValue({
      name: variant.name,
      code: variant.code ?? '',
      size: variant.size !== undefined ? String(variant.size) : '',
      unit: variant.unit,
      packagingType: variant.packagingType,
      costPrice: variant.costPrice !== undefined ? String(variant.costPrice) : '',
      sellingPrice: variant.sellingPrice,
      perfumeMl: variant.perfumeMl !== undefined ? String(variant.perfumeMl) : '',
      essenceMl: variant.essenceMl !== undefined ? String(variant.essenceMl) : '',
      hasSpecialBottle: Boolean(variant.hasSpecialBottle),
      specialBottleConsumableId: variant.specialBottleConsumableId ?? '',
      specialBottleExtraPrice: variant.specialBottleExtraPrice !== undefined ? String(variant.specialBottleExtraPrice) : '',
      active: variant.active
    });
    this.isDrawerOpen.set(true);
  }

  protected async toggleActive(variant: VariantTemplateRow): Promise<void> {
    await this.variantsService.toggleVariantActive(variant.id, !variant.active);
  }

  protected async deleteVariant(variant: VariantTemplateRow): Promise<void> {
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά την παραλλαγή "${variant.name}";`);
    if (!confirmed) return;
    const ok = await this.variantsService.deleteVariant(variant.id);
    if (ok && this.editingVariantId() === variant.id) {
      this.closeDrawer();
    }
  }

  protected async deleteCurrentEditingVariant(): Promise<void> {
    const id = this.editingVariantId();
    if (!id) return;
    const name = this.variantForm.controls.name.value;
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά την παραλλαγή "${name}";`);
    if (!confirmed) return;
    const ok = await this.variantsService.deleteVariant(id);
    if (ok) {
      this.closeDrawer();
    }
  }

  protected closeDrawer(): void {
    this.resetForm();
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected isEditing(variant: VariantTemplateRow): boolean {
    return this.editingVariantId() === variant.id;
  }

  protected formatRecipeSummary(variant: VariantTemplateRow): string {
    if (variant.packagingType !== 'BULK') return '-';
    const parts: string[] = [];
    if (variant.perfumeMl) parts.push(`${variant.perfumeMl}ml βάση`);
    if (variant.essenceMl) parts.push(`${variant.essenceMl}ml εσάνς`);
    if (variant.recipeConsumables?.length) {
      parts.push(`${variant.recipeConsumables.length} αναλώσιμα`);
    }
    if (variant.hasSpecialBottle && variant.specialBottleExtraPrice) {
      parts.push(`Special (+${variant.specialBottleExtraPrice}€)`);
    }
    return parts.length > 0 ? parts.join(' + ') : 'Χωρίς συνταγή';
  }

  private resetForm(): void {
    this.isDrawerOpen.set(false);
    this.editingVariantId.set(null);
    this.formError.set(null);
    this.selectedConsumablesMap.set({});
    this.variantForm.reset({
      name: '',
      code: '',
      size: '',
      unit: 'ml',
      packagingType: 'BULK',
      costPrice: '',
      sellingPrice: 0,
      perfumeMl: '',
      essenceMl: '',
      hasSpecialBottle: false,
      specialBottleConsumableId: '',
      specialBottleExtraPrice: '',
      active: true
    });
  }
}
