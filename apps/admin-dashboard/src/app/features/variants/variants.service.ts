import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import { ConsumablePart, PackagingType, Product, VariantRecipeConsumable, VariantTemplate } from '../../core/types/domain.models';

export type VariantTemplateRow = VariantTemplate & {
  id: string;
  assignedProducts: number;
};

@Injectable({ providedIn: 'root' })
export class VariantsService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  readonly variants = signal<VariantTemplateRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }

    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      this.variants.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const templatesRef = collection(this.firestore, `tenants/${tenantId}/variantTemplates`);
      const productsRef = collection(this.firestore, `tenants/${tenantId}/products`);

      const [templatesSnapshot, productsSnapshot] = await Promise.all([
        getDocs(query(templatesRef, orderBy('name', 'asc'))),
        getDocs(query(productsRef, orderBy('name', 'asc')))
      ]);

      const assignedCounts = new Map<string, number>();
      for (const productDoc of productsSnapshot.docs) {
        const product = productDoc.data() as Partial<Product>;
        const templateIds = Object.keys(product.variantAssignments ?? {});

        for (const templateId of templateIds) {
          const current = assignedCounts.get(templateId) ?? 0;
          assignedCounts.set(templateId, current + 1);
        }
      }

      const variants: VariantTemplateRow[] = templatesSnapshot.docs.map((item) => {
        const data = item.data() as Partial<VariantTemplate>;
        return {
          id: item.id,
          tenantId,
          name: data.name ?? '',
          code: data.code,
          size: typeof data.size === 'number' ? data.size : undefined,
          unit: data.unit ?? 'ml',
          packagingType: (data.packagingType as PackagingType) ?? 'PACKAGED',
          costPrice: typeof data.costPrice === 'number' ? data.costPrice : undefined,
          sellingPrice: data.sellingPrice ?? 0,
          perfumeMl: typeof data.perfumeMl === 'number' ? data.perfumeMl : undefined,
          essenceMl: typeof data.essenceMl === 'number' ? data.essenceMl : undefined,
          recipeConsumables: Array.isArray(data.recipeConsumables)
            ? (data.recipeConsumables as VariantRecipeConsumable[])
            : [],
          hasSpecialBottle: Boolean(data.hasSpecialBottle),
          specialBottleConsumableId: data.specialBottleConsumableId,
          specialBottleExtraPrice: typeof data.specialBottleExtraPrice === 'number' ? data.specialBottleExtraPrice : undefined,
          consumableParts: Array.isArray(data.consumableParts)
            ? (data.consumableParts as ConsumablePart[])
            : [],
          active: data.active ?? true,
          createdAt: this.normalizeTimestamp(data.createdAt),
          updatedAt: this.normalizeTimestamp(data.updatedAt),
          assignedProducts: assignedCounts.get(item.id) ?? 0
        };
      });

      this.variants.set(variants);
    } catch (error) {
      console.error(error);
      this.error.set('Αποτυχία φόρτωσης παραλλαγών.');
    } finally {
      this.loading.set(false);
    }
  }

  async createVariant(input: {
    name: string;
    code?: string;
    size?: number;
    unit: string;
    packagingType: PackagingType;
    costPrice?: number;
    sellingPrice: number;
    perfumeMl?: number;
    essenceMl?: number;
    recipeConsumables?: VariantRecipeConsumable[];
    hasSpecialBottle?: boolean;
    specialBottleConsumableId?: string;
    specialBottleExtraPrice?: number;
    active: boolean;
  }): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.'); return; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'createVariantTemplate')({ tenantId, ...input });
      await this.loadAll();
    } catch (error) {
      console.error(error);
      this.error.set('Αποτυχία δημιουργίας παραλλαγής.');
    }
  }

  async updateVariant(
    templateId: string,
    input: {
      name: string;
      code?: string;
      size?: number;
      unit: string;
      packagingType: PackagingType;
      costPrice?: number;
      sellingPrice: number;
      perfumeMl?: number;
      essenceMl?: number;
      recipeConsumables?: VariantRecipeConsumable[];
      hasSpecialBottle?: boolean;
      specialBottleConsumableId?: string;
      specialBottleExtraPrice?: number;
      consumableParts?: ConsumablePart[];
      active: boolean;
    }
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.'); return; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'updateVariantTemplate')({
        tenantId,
        templateId,
        ...input
      });
      await this.loadAll();
    } catch (error) {
      console.error(error);
      this.error.set('Αποτυχία ενημέρωσης παραλλαγής.');
    }
  }

  async toggleVariantActive(templateId: string, active: boolean): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    await httpsCallable(this.functions, 'toggleVariantTemplateActive')({ tenantId, templateId, active });
    await this.loadAll();
  }

  async deleteVariant(templateId: string): Promise<boolean> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.'); return false; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'deleteVariantTemplate')({ tenantId, templateId });
      await this.loadAll();
      return true;
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Αποτυχία διαγραφής παραλλαγής.';
      this.error.set(msg);
      return false;
    }
  }

  private normalizeTimestamp(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }

    return new Date().toISOString();
  }
}
