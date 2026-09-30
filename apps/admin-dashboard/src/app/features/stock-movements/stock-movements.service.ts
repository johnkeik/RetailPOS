import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { PackagingCategory, Product, StockMovement, VariantTemplate } from '../../core/types/domain.models';

export type StockMovementRow = StockMovement & {
  id: string;
  variantTemplateId?: string;
  productName: string;
  productCode: string;
  variantTemplateName: string;
  isBulk: boolean;
  displayDelta: string;
};

@Injectable({ providedIn: 'root' })
export class StockMovementsService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly tenantContext = inject(TenantContextService);

  readonly movementRows = signal<StockMovementRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }

    void this.loadMovements();
  }

  async loadMovements(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      this.movementRows.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const movementsRef = collection(this.firestore, `tenants/${tenantId}/stockMovements`);
      const productsRef = collection(this.firestore, `tenants/${tenantId}/products`);
      const templatesRef = collection(this.firestore, `tenants/${tenantId}/variantTemplates`);

      const [movementsSnapshot, productsSnapshot, templatesSnapshot] = await Promise.all([
        getDocs(query(movementsRef, orderBy('createdAt', 'desc'))),
        getDocs(query(productsRef, orderBy('name', 'asc'))),
        getDocs(query(templatesRef, orderBy('name', 'asc')))
      ]);

      const productsById = new Map(
        productsSnapshot.docs.map((item) => {
          const data = item.data() as Partial<Product>;
          return [item.id, {
            name: data.name ?? '-',
            code: data.productCode ?? '-',
            packagingCategory: (data.packagingCategory as PackagingCategory) ?? null
          }];
        })
      );

      const templatesById = new Map(
        templatesSnapshot.docs.map((item) => {
          const data = item.data() as Partial<VariantTemplate>;
          return [item.id, data.name ?? '-'];
        })
      );

      const rows: StockMovementRow[] = movementsSnapshot.docs.map((item) => {
        const data = item.data() as Partial<StockMovement> & { variantTemplateId?: string };
        const productMeta = productsById.get(data.productId ?? '') ?? { name: '-', code: '-', packagingCategory: null };
        const variantTemplateId = data.variantTemplateId;
        const quantityDelta = data.quantityDelta ?? 0;
        const isBulk = productMeta.packagingCategory === 'BULK' || variantTemplateId === 'bulk';

        return {
          id: item.id,
          tenantId,
          variantId: data.variantId ?? '',
          variantTemplateId,
          productId: data.productId ?? '',
          type: data.type ?? 'ADJUSTMENT',
          quantityDelta,
          reason: data.reason,
          orderId: data.orderId,
          performedByEmployeeId: data.performedByEmployeeId,
          createdAt: this.normalizeTimestamp(data.createdAt),
          productName: productMeta.name,
          productCode: productMeta.code,
          variantTemplateName: variantTemplateId
            ? templatesById.get(variantTemplateId) ?? '-'
            : '-',
          isBulk,
          displayDelta: this.formatDelta(quantityDelta, isBulk)
        };
      });

      this.movementRows.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to load stock movements from Firestore emulator.');
    } finally {
      this.loading.set(false);
    }
  }

  // BULK movements are stored in ml; display them in liters to match the receive/adjust inputs.
  private formatDelta(quantityDelta: number, isBulk: boolean): string {
    const sign = quantityDelta > 0 ? '+' : '';
    if (!isBulk) {
      return `${sign}${quantityDelta}`;
    }
    const liters = quantityDelta / 1000;
    return `${sign}${liters.toFixed(3).replace(/\.?0+$/, '') || '0'} L`;
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
