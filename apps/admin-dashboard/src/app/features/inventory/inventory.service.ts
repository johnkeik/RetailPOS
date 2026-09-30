import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { ConsumablePart, InventorySnapshot, PackagingCategory, PackagingType, Product, VariantTemplate } from '../../core/types/domain.models';

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
      this.error.set('Missing tenant context.');
      this.inventoryRows.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const inventoryRef = collection(this.firestore, `tenants/${tenantId}/inventory`);
      const productsRef = collection(this.firestore, `tenants/${tenantId}/products`);
      const templatesRef = collection(this.firestore, `tenants/${tenantId}/variantTemplates`);

      const [inventorySnapshot, productsSnapshot, templatesSnapshot] = await Promise.all([
        getDocs(query(inventoryRef, orderBy('updatedAt', 'desc'))),
        getDocs(query(productsRef, orderBy('name', 'asc'))),
        getDocs(query(templatesRef, orderBy('name', 'asc')))
      ]);

      // Products: name, code, packagingCategory (may be absent on old docs)
      type ProductMeta = { name: string; productCode: string; packagingCategory: PackagingCategory | null };
      const productsById = new Map<string, ProductMeta>(
        productsSnapshot.docs.map((item) => {
          const data = item.data() as Partial<Product>;
          return [item.id, {
            name: data.name ?? '-',
            productCode: data.productCode ?? '-',
            // null = not yet set in Firestore; will be inferred from templates below
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

      // ── Infer packagingCategory for products that don't have it stored ────
      // A product is BULK when every inventory entry it has points to a BULK template.
      const templateTypesByProduct = new Map<string, Set<PackagingType | null>>();
      for (const item of inventorySnapshot.docs) {
        const data = item.data() as Partial<InventorySnapshot> & { variantTemplateId?: string };
        const productId = data.productId ?? '';
        const templateId = data.variantTemplateId ?? '';
        const set = templateTypesByProduct.get(productId) ?? new Set();
        const pkgType = templateId === BULK_SENTINEL
          ? 'BULK'
          : (templatesById.get(templateId)?.packagingType ?? null);
        set.add(pkgType);
        templateTypesByProduct.set(productId, set);
      }

      for (const [productId, types] of templateTypesByProduct) {
        const meta = productsById.get(productId);
        if (!meta || meta.packagingCategory !== null) continue;
        // All templates are BULK → infer BULK; any PACKAGED or unknown → PACKAGED
        meta.packagingCategory = [...types].every((t) => t === 'BULK') ? 'BULK' : 'PACKAGED';
      }

      // ── Pass 1: aggregate BULK product totals ─────────────────────────────
      // A BULK product can have multiple legacy inventory entries (one per variant
      // template) OR the new single 'bulk' sentinel entry. Either way we sum them
      // into one row per product.
      type BulkAggregate = { totalMl: number; latestUpdatedAt: string };
      const bulkAggregates = new Map<string, BulkAggregate>();

      for (const item of inventorySnapshot.docs) {
        const data = item.data() as Partial<InventorySnapshot> & { variantTemplateId?: string };
        const productId = data.productId ?? '';
        const productMeta = productsById.get(productId);
        if (productMeta?.packagingCategory !== 'BULK') continue;

        const agg = bulkAggregates.get(productId) ?? { totalMl: 0, latestUpdatedAt: '' };
        agg.totalMl += data.quantity ?? 0;
        const ts = this.normalizeTimestamp(data.updatedAt);
        if (!agg.latestUpdatedAt || ts > agg.latestUpdatedAt) {
          agg.latestUpdatedAt = ts;
        }
        bulkAggregates.set(productId, agg);
      }

      // ── Pass 2: build consumable stock lookup (PACKAGED only) ─────────────
      const stockByTemplateId = new Map<string, number>();
      for (const item of inventorySnapshot.docs) {
        const data = item.data() as Partial<InventorySnapshot> & { variantTemplateId?: string };
        const templateId = data.variantTemplateId;
        const productMeta = productsById.get(data.productId ?? '');
        // Only PACKAGED inventory contributes to consumable cross-references
        if (templateId && templateId !== BULK_SENTINEL && productMeta?.packagingCategory !== 'BULK') {
          stockByTemplateId.set(templateId, (stockByTemplateId.get(templateId) ?? 0) + (data.quantity ?? 0));
        }
      }

      // ── Pass 3: build output rows ─────────────────────────────────────────
      const rows: InventoryRow[] = [];
      const seenBulkProducts = new Set<string>();

      for (const item of inventorySnapshot.docs) {
        const data = item.data() as Partial<InventorySnapshot> & { variantTemplateId?: string };
        const productId = data.productId ?? '';
        const productMeta = productsById.get(productId);

        if (productMeta?.packagingCategory === 'BULK') {
          // One row per BULK product — deduplicate
          if (seenBulkProducts.has(productId)) continue;
          seenBulkProducts.add(productId);

          const agg = bulkAggregates.get(productId) ?? { totalMl: 0, latestUpdatedAt: '' };
          rows.push({
            id: `${productId}__bulk`,
            tenantId,
            productId,
            variantId: BULK_SENTINEL,
            variantTemplateId: BULK_SENTINEL,
            quantity: agg.totalMl,
            updatedAt: agg.latestUpdatedAt || new Date().toISOString(),
            productName: productMeta.name,
            productCode: productMeta.productCode,
            variantTemplateName: 'Bulk Pool',
            packagingType: 'BULK',
            isBulk: true,
            displayQty: this.formatLiters(agg.totalMl),
            consumableParts: []
          });
        } else {
          // PACKAGED: one row per inventory entry (product × variant)
          const variantTemplateId = data.variantTemplateId ?? '';
          const templateMeta = templatesById.get(variantTemplateId);
          const qty = data.quantity ?? 0;

          const consumableParts: ConsumablePartRow[] = (templateMeta?.consumableParts ?? []).map((part) => {
            const partTemplate = templatesById.get(part.variantTemplateId);
            return {
              variantTemplateId: part.variantTemplateId,
              variantTemplateName: partTemplate?.name ?? part.variantTemplateId,
              quantityPerUnit: part.quantity,
              currentStock: stockByTemplateId.get(part.variantTemplateId) ?? 0
            };
          });

          rows.push({
            id: item.id,
            tenantId,
            productId,
            variantId: data.variantId ?? '',
            variantTemplateId,
            quantity: qty,
            updatedAt: this.normalizeTimestamp(data.updatedAt),
            productName: productMeta?.name ?? '-',
            productCode: productMeta?.productCode ?? '-',
            variantTemplateName: templateMeta?.name ?? '-',
            packagingType: templateMeta?.packagingType ?? null,
            isBulk: false,
            displayQty: String(qty),
            consumableParts
          });
        }
      }

      this.inventoryRows.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to load inventory snapshot from Firestore emulator.');
    } finally {
      this.loading.set(false);
    }
  }

  private formatLiters(ml: number): string {
    if (ml >= 1000) {
      return `${(ml / 1000).toFixed(3).replace(/\.?0+$/, '')} L`;
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
