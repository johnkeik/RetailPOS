import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PackagingType, VariantRecipeConsumable } from '../../core/types/domain.models';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { ConsumablesService } from '../consumables/consumables.service';
import { VariantTemplateRow, VariantsService } from './variants.service';

@Component({
  selector: 'app-variant-form-page',
  imports: [ReactiveFormsModule, RouterLink, PageTitleComponent],
  templateUrl: './variant-form-page.component.html',
  styleUrl: './variants-page.component.scss'
})
export class VariantFormPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly variantsService = inject(VariantsService);
  private readonly consumablesService = inject(ConsumablesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly variantId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditing = computed(() => this.variantId !== null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly serviceError = this.variantsService.error;
  protected readonly formError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly consumables = this.consumablesService.consumables;
  protected readonly selectedConsumablesMap = signal<Record<string, number>>({});
  protected readonly variantForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    code: ['', [Validators.maxLength(60)]],
    size: this.formBuilder.control<number | null>(null),
    unit: ['ml', [Validators.required, Validators.maxLength(10)]],
    packagingType: ['BULK' as PackagingType, [Validators.required]],
    costPrice: this.formBuilder.control<number | null>(null),
    sellingPrice: [0, [Validators.required, Validators.min(0)]],
    perfumeMl: this.formBuilder.control<number | null>(null),
    essenceMl: this.formBuilder.control<number | null>(null),
    hasSpecialBottle: [false],
    specialBottleConsumableId: [''],
    specialBottleExtraPrice: this.formBuilder.control<number | null>(null),
    active: [true]
  });

  private readonly formValues = toSignal(this.variantForm.valueChanges, {
    initialValue: this.variantForm.getRawValue()
  });
  protected readonly isFormBulk = computed(() => this.formValues().packagingType === 'BULK');
  protected readonly activeConsumables = computed(() => this.consumables().filter((item) => item.active));
  protected readonly recipeTotalMl = computed(() =>
    (this.formValues().perfumeMl ?? 0) + (this.formValues().essenceMl ?? 0)
  );

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    await Promise.all([this.variantsService.loadAll(), this.consumablesService.loadAll()]);
    this.loading.set(false);

    if (!this.variantId) return;
    const variant = this.variantsService.variants().find((item) => item.id === this.variantId);
    if (!variant) {
      this.loadError.set('Η παραλλαγή δεν βρέθηκε.');
      return;
    }
    this.loadVariant(variant);
  }

  protected isConsumableSelected(consumableId: string): boolean {
    return consumableId in this.selectedConsumablesMap();
  }

  protected getConsumableQty(consumableId: string): number {
    return this.selectedConsumablesMap()[consumableId] ?? 1;
  }

  protected toggleConsumable(consumableId: string): void {
    const current = { ...this.selectedConsumablesMap() };
    if (consumableId in current) delete current[consumableId];
    else current[consumableId] = 1;
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
    const currentSize = this.variantForm.controls.size.value;
    const totalMl = this.recipeTotalMl();
    if (currentSize === null && totalMl > 0) this.variantForm.controls.size.setValue(totalMl);
  }

  protected async saveVariant(): Promise<void> {
    if (this.variantForm.invalid) {
      this.variantForm.markAllAsTouched();
      this.formError.set('Παρακαλώ συμπληρώστε τα υποχρεωτικά πεδία.');
      return;
    }

    const form = this.variantForm.getRawValue();
    const isBulk = form.packagingType === 'BULK';
    const sizeNumber = form.size ?? (isBulk && (form.perfumeMl !== null || form.essenceMl !== null)
      ? (form.perfumeMl ?? 0) + (form.essenceMl ?? 0)
      : undefined);

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
      costPrice: form.costPrice ?? undefined,
      sellingPrice: Number(form.sellingPrice),
      perfumeMl: isBulk ? form.perfumeMl ?? undefined : undefined,
      essenceMl: isBulk ? form.essenceMl ?? undefined : undefined,
      recipeConsumables,
      hasSpecialBottle: isBulk && Boolean(form.hasSpecialBottle),
      specialBottleConsumableId: isBulk && form.hasSpecialBottle && form.specialBottleConsumableId
        ? form.specialBottleConsumableId
        : undefined,
      specialBottleExtraPrice: isBulk && form.hasSpecialBottle
        ? form.specialBottleExtraPrice ?? undefined
        : undefined,
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
    this.saving.set(true);
    try {
      if (this.variantId) await this.variantsService.updateVariant(this.variantId, payload);
      else await this.variantsService.createVariant(payload);
      if (!this.variantsService.error()) await this.router.navigateByUrl('/variants');
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteVariant(): Promise<void> {
    if (!this.variantId) return;
    const name = this.variantForm.controls.name.value;
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά την παραλλαγή "${name}";`);
    if (confirmed && await this.variantsService.deleteVariant(this.variantId)) {
      await this.router.navigateByUrl('/variants');
    }
  }

  private loadVariant(variant: VariantTemplateRow): void {
    const map: Record<string, number> = {};
    for (const item of variant.recipeConsumables ?? []) map[item.consumableId] = item.quantity;
    this.selectedConsumablesMap.set(map);
    this.variantForm.setValue({
      name: variant.name,
      code: variant.code ?? '',
      size: variant.size ?? null,
      unit: variant.unit,
      packagingType: variant.packagingType,
      costPrice: variant.costPrice ?? null,
      sellingPrice: variant.sellingPrice,
      perfumeMl: variant.perfumeMl ?? null,
      essenceMl: variant.essenceMl ?? null,
      hasSpecialBottle: Boolean(variant.hasSpecialBottle),
      specialBottleConsumableId: variant.specialBottleConsumableId ?? '',
      specialBottleExtraPrice: variant.specialBottleExtraPrice ?? null,
      active: variant.active
    });
  }
}
