import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { Consumable, ConsumablePart, InventorySnapshot, PackagingCategory, PackagingType, Product, VariantTemplate } from '../../core/types/domain.models';

export const BULK_SENTINEL = 'bulk';

export type ConsumablePartRow = {
  variantTemplateId: string;
  variantTemplateName: string;
  quantityPerUnit: number;
  currentStock: number;
};

export type InventoryRow = InventorySnapshot & {
  id: string;
  variantTemplateId: string;
  productName: string;
  productCode: string;
  variantTemplateName: string;
  packagingType: PackagingType | null;
  isBulk: boolean;
  isConsumable?: boolean;
  displayQty: string;
  consumableParts: ConsumablePartRow[];
};

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly tenantContext = inject(TenantContextService);

  readonly inventoryRows = signal<InventoryRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }

    void this.loadInventory();
  }

  async loadInventory(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.');
      this.inventoryRows.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const inventoryRef = collection(this.firestore, `tenants/${tenantId}/inventory`);
      const productsRef = collection(this.firestore, `tenants/${tenantId}/products`);
      const templatesRef = collection(this.firestore, `tenants/${tenantId}/variantTemplates`);
      const consumablesRef = collection(this.firestore, `tenants/${tenantId}/consumables`);

      const [inventorySnapshot, productsSnapshot, templatesSnapshot, consumablesSnapshot] = await Promise.all([
        getDocs(query(inventoryRef, orderBy('updatedAt', 'desc'))),
        getDocs(query(productsRef, orderBy('name', 'asc'))),
        getDocs(query(templatesRef, orderBy('name', 'asc'))),
        getDocs(query(consumablesRef, orderBy('name', 'asc')))
      ]);

      type ProductMeta = {
        name: string;
        productCode: string;
        packagingCategory: PackagingCategory | null;
      };
      const productsById = new Map<string, ProductMeta>(
        productsSnapshot.docs.map((item) => {
          const data = item.data() as Partial<Product>;
          return [item.id, {
            name: data.name ?? '-',
            productCode: data.productCode ?? '-',
            packagingCategory: (data.packagingCategory as PackagingCategory) ?? null
          }];
        })
      );

      const templatesById = new Map(
        templatesSnapshot.docs.map((item) => {
          const data = item.data() as Partial<VariantTemplate>;
          return [item.id, {
            name: data.name ?? '-',
            packagingType: (data.packagingType as PackagingType) ?? null,
            consumableParts: Array.isArray(data.consumableParts)
              ? (data.consumableParts as ConsumablePart[])
              : []
          }];
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

      const rows: InventoryRow[] = [];

      for (const item of inventorySnapshot.docs) {
        const data = item.data() as Partial<InventorySnapshot> & { variantTemplateId?: string };
        const productId = data.productId ?? '';
        const vtId = data.variantTemplateId ?? '';
        const qty = data.quantity ?? 0;
        const updatedAt = this.normalizeTimestamp(data.updatedAt);

        // 1. Consumable row
        if (vtId === 'consumable' || consumablesById.has(productId)) {
          const cMeta = consumablesById.get(productId);
          rows.push({
            id: item.id,
            tenantId,
            productId,
            variantId: 'consumable',
            variantTemplateId: 'consumable',
            quantity: qty,
            updatedAt,
            productName: cMeta?.name ?? 'Αναλώσιμο',
            productCode: cMeta?.code ?? '-',
            variantTemplateName: `Αναλώσιμο (${cMeta?.unit ?? 'τεμ.'})`,
            packagingType: 'PACKAGED',
            isBulk: false,
            isConsumable: true,
            displayQty: `${qty} ${cMeta?.unit ?? 'τεμ.'}`,
            consumableParts: []
          });
          continue;
        }

        const productMeta = productsById.get(productId);

        // 2. Perfume Base Component
        if (vtId === 'perfume') {
          rows.push({
            id: item.id,
            tenantId,
            productId,
            variantId: 'perfume',
            variantTemplateId: 'perfume',
            quantity: qty,
            updatedAt,
            productName: productMeta?.name ?? '-',
            productCode: productMeta?.productCode || '-',
            variantTemplateName: 'Άρωμα (Βάση)',
            packagingType: 'BULK',
            isBulk: true,
            isConsumable: false,
            displayQty: this.formatLiters(qty),
            consumableParts: []
          });
          continue;
        }

        // 3. Essence Component
        if (vtId === 'essence') {
          rows.push({
            id: item.id,
            tenantId,
            productId,
            variantId: 'essence',
            variantTemplateId: 'essence',
            quantity: qty,
            updatedAt,
            productName: productMeta?.name ?? '-',
            productCode: productMeta?.productCode || '-',
            variantTemplateName: 'Εσάνς',
            packagingType: 'BULK',
            isBulk: true,
            isConsumable: false,
            displayQty: this.formatLiters(qty),
            consumableParts: []
          });
          continue;
        }

        // 4. Legacy bulk
        if (vtId === BULK_SENTINEL || productMeta?.packagingCategory === 'BULK') {
          rows.push({
            id: item.id,
            tenantId,
            productId,
            variantId: BULK_SENTINEL,
            variantTemplateId: BULK_SENTINEL,
            quantity: qty,
            updatedAt,
            productName: productMeta?.name ?? '-',
            productCode: productMeta?.productCode ?? '-',
            variantTemplateName: 'Χύμα (Παλιό Pool)',
            packagingType: 'BULK',
            isBulk: true,
            isConsumable: false,
            displayQty: this.formatLiters(qty),
            consumableParts: []
          });
          continue;
        }

        // 5. Standard Packaged
        const templateMeta = templatesById.get(vtId);
        rows.push({
          id: item.id,
          tenantId,
          productId,
          variantId: data.variantId ?? '',
          variantTemplateId: vtId,
          quantity: qty,
          updatedAt,
          productName: productMeta?.name ?? '-',
          productCode: productMeta?.productCode ?? '-',
          variantTemplateName: templateMeta?.name ?? '-',
          packagingType: templateMeta?.packagingType ?? null,
          isBulk: false,
          isConsumable: false,
          displayQty: `${qty} τεμ.`,
          consumableParts: []
        });
      }

      this.inventoryRows.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Αποτυχία φόρτωσης αποθέματος.');
    } finally {
      this.loading.set(false);
    }
  }

  private formatLiters(ml: number): string {
    if (ml >= 1000) {
      return `${(ml / 1000).toFixed(3).replace(/\.?0+$/, '')} L (${ml} ml)`;
    }
    return `${ml} ml`;
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
