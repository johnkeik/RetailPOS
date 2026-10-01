import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { Consumable, PackagingCategory, Product, StockMovement, VariantTemplate } from '../../core/types/domain.models';

export type StockMovementRow = StockMovement & {
  id: string;
  variantTemplateId?: string;
  productName: string;
  productCode: string;
  variantTemplateName: string;
  isBulk: boolean;
  isConsumable?: boolean;
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
      const consumablesRef = collection(this.firestore, `tenants/${tenantId}/consumables`);

      const [movementsSnapshot, productsSnapshot, templatesSnapshot, consumablesSnapshot] = await Promise.all([
        getDocs(query(movementsRef, orderBy('createdAt', 'desc'))),
        getDocs(query(productsRef, orderBy('name', 'asc'))),
        getDocs(query(templatesRef, orderBy('name', 'asc'))),
        getDocs(query(consumablesRef, orderBy('name', 'asc')))
      ]);

      const productsById = new Map(
        productsSnapshot.docs.map((item) => {
          const data = item.data() as Partial<Product>;
          return [item.id, {
            name: data.name ?? '-',
            code: data.productCode ?? '-',
            packagingCategory: (data.packagingCategory as PackagingCategory) ?? null,
            perfumeBaseCode: data.perfumeBaseCode,
            essenceCode: data.essenceCode
          }];
        })
      );

      const templatesById = new Map(
        templatesSnapshot.docs.map((item) => {
          const data = item.data() as Partial<VariantTemplate>;
          return [item.id, data.name ?? '-'];
        })
      );

      const consumablesById = new Map(
        consumablesSnapshot.docs.map((item) => {
          const data = item.data() as Partial<Consumable>;
          return [item.id, {
            name: data.name ?? '-',
            code: data.code ?? '-',
            unit: data.unit ?? 'τεμ.'
          }];
        })
      );

      const rows: StockMovementRow[] = movementsSnapshot.docs.map((item) => {
        const data = item.data() as Partial<StockMovement> & { variantTemplateId?: string };
        const productId = data.productId ?? '';
        const vtId = data.variantTemplateId ?? '';
        const quantityDelta = data.quantityDelta ?? 0;

        // 1. Consumable movement
        if (vtId === 'consumable' || consumablesById.has(productId)) {
          const cMeta = consumablesById.get(productId);
          return {
            id: item.id,
            tenantId,
            variantId: 'consumable',
            variantTemplateId: 'consumable',
            productId,
            type: data.type ?? 'ADJUSTMENT',
            quantityDelta,
            reason: data.reason,
            orderId: data.orderId,
            performedByEmployeeId: data.performedByEmployeeId,
            createdAt: this.normalizeTimestamp(data.createdAt),
            productName: cMeta?.name ?? 'Αναλώσιμο',
            productCode: cMeta?.code ?? '-',
            variantTemplateName: `Αναλώσιμο (${cMeta?.unit ?? 'τεμ.'})`,
            isBulk: false,
            isConsumable: true,
            displayDelta: `${quantityDelta > 0 ? '+' : ''}${quantityDelta} ${cMeta?.unit ?? 'τεμ.'}`
          };
        }

        const productMeta = productsById.get(productId) ?? {
          name: '-',
          code: '-',
          packagingCategory: null,
          perfumeBaseCode: undefined,
          essenceCode: undefined
        };

        // 2. Perfume Base
        if (vtId === 'perfume') {
          return {
            id: item.id,
            tenantId,
            variantId: 'perfume',
            variantTemplateId: 'perfume',
            productId,
            type: data.type ?? 'ADJUSTMENT',
            quantityDelta,
            reason: data.reason,
            orderId: data.orderId,
            performedByEmployeeId: data.performedByEmployeeId,
            createdAt: this.normalizeTimestamp(data.createdAt),
            productName: productMeta.name,
            productCode: productMeta.perfumeBaseCode || productMeta.code,
            variantTemplateName: 'Άρωμα (Βάση)',
            isBulk: true,
            isConsumable: false,
            displayDelta: this.formatDelta(quantityDelta, true)
          };
        }

        // 3. Essence
        if (vtId === 'essence') {
          return {
            id: item.id,
            tenantId,
            variantId: 'essence',
            variantTemplateId: 'essence',
            productId,
            type: data.type ?? 'ADJUSTMENT',
            quantityDelta,
            reason: data.reason,
            orderId: data.orderId,
            performedByEmployeeId: data.performedByEmployeeId,
            createdAt: this.normalizeTimestamp(data.createdAt),
            productName: productMeta.name,
            productCode: productMeta.essenceCode || productMeta.code,
            variantTemplateName: 'Εσάνς',
            isBulk: true,
            isConsumable: false,
            displayDelta: this.formatDelta(quantityDelta, true)
          };
        }

        const isBulk = productMeta.packagingCategory === 'BULK' || vtId === 'bulk';

        return {
          id: item.id,
          tenantId,
          variantId: data.variantId ?? '',
          variantTemplateId: vtId,
          productId,
          type: data.type ?? 'ADJUSTMENT',
          quantityDelta,
          reason: data.reason,
          orderId: data.orderId,
          performedByEmployeeId: data.performedByEmployeeId,
          createdAt: this.normalizeTimestamp(data.createdAt),
          productName: productMeta.name,
          productCode: productMeta.code,
          variantTemplateName: vtId
            ? templatesById.get(vtId) ?? '-'
            : '-',
          isBulk,
          isConsumable: false,
          displayDelta: this.formatDelta(quantityDelta, isBulk)
        };
      });

      this.movementRows.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Αποτυχία φόρτωσης κινήσεων αποθέματος.');
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
