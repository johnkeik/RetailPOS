import { Injectable, inject, signal } from '@angular/core';
import { Timestamp, addDoc, collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import { PackagingCategory, ProductVariantAssignment, ProductType } from '../../core/types/domain.models';
import {
  MockBrandSeed,
  MockCategorySeed,
  MockConsumableSeed,
  MockProductSeed,
  MockVariantTemplateSeed,
  mockCatalogData
} from './temp-data/mock-catalog.data';

type CreateBrandResponse = { ok: boolean; brandId: string };
type CreateCategoryResponse = { ok: boolean; categoryId: string };
type CreateConsumableResponse = { ok: boolean; consumableId: string };
type CreateVariantTemplateResponse = { ok: boolean; templateId: string };
type CreateProductResponse = { ok: boolean; productId: string };
type ReceiveStockResponse = { ok: boolean };

@Injectable({ providedIn: 'root' })
export class DashboardTempSeedService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  readonly loading = signal(false);
  readonly status = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }
  }

  async seedMockCatalog(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.status.set('Seeding mock catalog into Firebase emulators...');

    try {
      const [brandMap, categoryMap, consumableMap] = await Promise.all([
        this.ensureBrands(tenantId, mockCatalogData.brands),
        this.ensureCategories(tenantId, mockCatalogData.categories),
        this.ensureConsumables(tenantId, mockCatalogData.consumables)
      ]);

      const [templateMap, existingProductCodes] = await Promise.all([
        this.ensureVariantTemplates(tenantId, mockCatalogData.variantTemplates, consumableMap),
        this.loadExistingProductCodes(tenantId)
      ]);

      let createdProducts = 0;
      for (const product of mockCatalogData.products) {
        if (existingProductCodes.has(product.productCode)) {
          continue;
        }

        const brandId = brandMap.get(product.brandCode);
        const categoryId = categoryMap.get(product.categoryCode);
        if (!brandId || !categoryId) {
          throw new Error(`Missing brand/category for product ${product.productCode}.`);
        }

        const variantAssignments = this.buildVariantAssignments(product, templateMap);
        await this.createProductCallable()({
          tenantId,
          productCode: product.productCode,
          name: product.name,
          brandId,
          categoryId,
          productType: 'PERFUME' as ProductType,
          packagingCategory: product.packagingCategory,
          perfumeBaseCode: product.perfumeBaseCode,
          essenceCode: product.essenceCode,
          gender: product.gender,
          variantAssignments,
          active: true
        });
        existingProductCodes.add(product.productCode);
        createdProducts += 1;
      }

      this.status.set(
        `Mock catalog ready. Brands: ${mockCatalogData.brands.length}, categories: ${mockCatalogData.categories.length}, consumables: ${mockCatalogData.consumables.length}, templates: ${mockCatalogData.variantTemplates.length}, new products: ${createdProducts}.`
      );
    } catch (error) {
      console.error(error);
      this.error.set('Failed to seed mock catalog into the emulators.');
    } finally {
      this.loading.set(false);
    }
  }

  async seedMockInventory(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.status.set('Seeding inventory quantities for mock catalog...');

    try {
      const [productsSnapshot, inventorySnapshot] = await Promise.all([
        getDocs(collection(this.firestore, `tenants/${tenantId}/products`)),
        getDocs(collection(this.firestore, `tenants/${tenantId}/inventory`))
      ]);

      const productCodeSet = new Set(mockCatalogData.products.map((item) => item.productCode));
      const inventoryByPair = new Map<string, number>();

      for (const item of inventorySnapshot.docs) {
        const data = item.data() as { productId?: string; variantTemplateId?: string; quantity?: number };
        if (!data.productId || !data.variantTemplateId) {
          continue;
        }

        inventoryByPair.set(
          `${data.productId}__${data.variantTemplateId}`,
          Number(data.quantity ?? 0)
        );
      }

      let seededLines = 0;
      const receiveStock = this.receiveStockCallable();

      for (const productDoc of productsSnapshot.docs) {
        const productData = productDoc.data() as {
          productCode?: string;
          packagingCategory?: PackagingCategory;
          variantAssignments?: Record<string, ProductVariantAssignment>;
        };

        if (!productData.productCode || !productCodeSet.has(productData.productCode)) {
          continue;
        }

        const packagingCategory = productData.packagingCategory ?? 'PACKAGED';

        if (packagingCategory === 'BULK') {
          // BULK products: seed perfume base (ml) & essence (ml)
          const perfumeKey = `${productDoc.id}__perfume`;
          if ((inventoryByPair.get(perfumeKey) ?? 0) === 0) {
            const volumeMl = this.mockBulkVolumeMl(productData.productCode);
            await receiveStock({
              tenantId,
              productId: productDoc.id,
              variantTemplateId: 'perfume',
              quantity: volumeMl,
              reason: 'TEMP_DASHBOARD_SEED'
            });
            inventoryByPair.set(perfumeKey, volumeMl);
            seededLines += 1;
          }

          const essenceKey = `${productDoc.id}__essence`;
          if ((inventoryByPair.get(essenceKey) ?? 0) === 0) {
            const essenceMl = Math.round(this.mockBulkVolumeMl(productData.productCode) * 0.25);
            await receiveStock({
              tenantId,
              productId: productDoc.id,
              variantTemplateId: 'essence',
              quantity: essenceMl,
              reason: 'TEMP_DASHBOARD_SEED'
            });
            inventoryByPair.set(essenceKey, essenceMl);
            seededLines += 1;
          }
        } else {
          // PACKAGED products: one entry per variant template
          const variantAssignments = productData.variantAssignments ?? {};
          for (const [templateId] of Object.entries(variantAssignments)) {
            const pairKey = `${productDoc.id}__${templateId}`;
            const existingQty = inventoryByPair.get(pairKey) ?? 0;
            if (existingQty > 0) continue;

            const quantity = this.mockInventoryQuantity(productData.productCode, templateId);
            await receiveStock({
              tenantId,
              productId: productDoc.id,
              variantTemplateId: templateId,
              quantity,
              reason: 'TEMP_DASHBOARD_SEED'
            });
            inventoryByPair.set(pairKey, quantity);
            seededLines += 1;
          }
        }
      }

      // Seed inventory for consumables in pieces (τεμάχια)
      const consumablesSnapshot = await getDocs(collection(this.firestore, `tenants/${tenantId}/consumables`));
      for (const cDoc of consumablesSnapshot.docs) {
        const cKey = `${cDoc.id}__consumable`;
        if ((inventoryByPair.get(cKey) ?? 0) === 0) {
          const qty = 120;
          await receiveStock({
            tenantId,
            productId: cDoc.id,
            variantTemplateId: 'consumable',
            quantity: qty,
            reason: 'TEMP_DASHBOARD_SEED'
          });
          inventoryByPair.set(cKey, qty);
          seededLines += 1;
        }
      }

      this.status.set(`Mock inventory ready. Seeded ${seededLines} stock lines (Άρωμα, Εσάνς, Αναλώσιμα & Συσκευασμένα).`);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to seed mock inventory into the emulators.');
    } finally {
      this.loading.set(false);
    }
  }

  private async ensureBrands(tenantId: string, seeds: MockBrandSeed[]): Promise<Map<string, string>> {
    const existing = await this.loadExistingIdMap(tenantId, 'brands');
    const createBrand = this.createBrandCallable();

    for (const seed of seeds) {
      if (existing.has(seed.code)) {
        continue;
      }

      const result = await createBrand({ tenantId, name: seed.name, code: seed.code, active: true });
      existing.set(seed.code, result.data.brandId);
    }

    return existing;
  }

  private async ensureCategories(tenantId: string, seeds: MockCategorySeed[]): Promise<Map<string, string>> {
    const existing = await this.loadExistingIdMap(tenantId, 'categories');
    const createCategory = this.createCategoryCallable();

    for (const seed of seeds) {
      if (existing.has(seed.code)) {
        continue;
      }

      const result = await createCategory({ tenantId, name: seed.name, code: seed.code, active: true });
      existing.set(seed.code, result.data.categoryId);
    }

    return existing;
  }

  private async ensureConsumables(tenantId: string, seeds: MockConsumableSeed[]): Promise<Map<string, string>> {
    const existing = await this.loadExistingIdMap(tenantId, 'consumables');
    const createConsumable = this.createConsumableCallable();

    for (const seed of seeds) {
      if (existing.has(seed.code)) {
        continue;
      }

      const result = await createConsumable({
        tenantId,
        name: seed.name,
        code: seed.code,
        unit: seed.unit,
        costPrice: seed.costPrice,
        active: true
      });
      existing.set(seed.code, result.data.consumableId);
    }

    return existing;
  }

  private async ensureVariantTemplates(
    tenantId: string,
    seeds: MockVariantTemplateSeed[],
    consumableMap?: Map<string, string>
  ): Promise<Map<string, string>> {
    const existing = await this.loadExistingIdMap(tenantId, 'variantTemplates');
    const createTemplate = this.createVariantTemplateCallable();

    for (const seed of seeds) {
      if (existing.has(seed.code)) {
        continue;
      }

      const recipeConsumables = seed.recipeConsumables?.map((rc) => ({
        consumableId: consumableMap?.get(rc.consumableCode) || rc.consumableCode,
        quantity: rc.quantity
      }));

      const result = await createTemplate({
        tenantId,
        name: seed.name,
        code: seed.code,
        size: seed.size,
        unit: seed.unit,
        packagingType: seed.packagingType,
        costPrice: seed.costPrice,
        sellingPrice: seed.sellingPrice,
        perfumeMl: seed.perfumeMl,
        essenceMl: seed.essenceMl,
        recipeConsumables,
        active: true
      });
      existing.set(seed.code, result.data.templateId);
    }

    return existing;
  }

  private async loadExistingIdMap(
    tenantId: string,
    collectionName: 'brands' | 'categories' | 'variantTemplates' | 'consumables'
  ): Promise<Map<string, string>> {
    const snapshot = await getDocs(collection(this.firestore, `tenants/${tenantId}/${collectionName}`));
    const idMap = new Map<string, string>();

    for (const item of snapshot.docs) {
      const data = item.data() as { code?: string };
      if (data.code) {
        idMap.set(data.code, item.id);
      }
    }

    return idMap;
  }

  private async loadExistingProductCodes(tenantId: string): Promise<Set<string>> {
    const snapshot = await getDocs(collection(this.firestore, `tenants/${tenantId}/products`));
    const productCodes = new Set<string>();

    for (const item of snapshot.docs) {
      const data = item.data() as { productCode?: string };
      if (data.productCode) {
        productCodes.add(data.productCode);
      }
    }

    return productCodes;
  }

  private buildVariantAssignments(
    product: MockProductSeed,
    templateMap: Map<string, string>
  ): Record<string, ProductVariantAssignment> {
    const assignments: Record<string, ProductVariantAssignment> = {};

    for (const variant of product.variantAssignments) {
      const templateId = templateMap.get(variant.templateCode);
      if (!templateId) {
        throw new Error(`Missing variant template ${variant.templateCode} for ${product.productCode}.`);
      }

      assignments[templateId] = {
        sellingPrice: variant.sellingPrice,
        costPrice: variant.costPrice
      };
    }

    return assignments;
  }

  private mockInventoryQuantity(productCode: string, templateId: string): number {
    const codeSeed = Number(productCode.slice(-2));
    const templateSeed = templateId.length;
    return 6 + ((codeSeed + templateSeed) % 18);
  }

  /** Returns a pseudo-random bulk volume in ml (15 – 80 liters). */
  private mockBulkVolumeMl(productCode: string): number {
    const seed = Number(productCode.slice(-2));
    return (15 + (seed % 66)) * 1000; // 15000 – 80000 ml
  }

  async seedMockSalesHistory(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }

    this.loading.set(true);
    this.error.set(null);
    this.status.set('Seeding mock sales history...');

    try {
      const ordersRef = collection(this.firestore, `tenants/${tenantId}/orders`);
      const existing = await getDocs(ordersRef);
      if (!existing.empty) {
        this.status.set(`Sales history already has ${existing.size} orders — skipped.`);
        return;
      }

      const [productsSnapshot, templatesSnapshot] = await Promise.all([
        getDocs(collection(this.firestore, `tenants/${tenantId}/products`)),
        getDocs(collection(this.firestore, `tenants/${tenantId}/variantTemplates`))
      ]);

      type ProductEntry = {
        id: string;
        packagingCategory: PackagingCategory;
        variantAssignments: Record<string, { sellingPrice: number }>;
      };

      type TemplateEntry = { id: string; size: number; sellingPrice: number };

      const products: ProductEntry[] = productsSnapshot.docs
        .map((d) => ({
          id: d.id,
          packagingCategory: (d.data()['packagingCategory'] as PackagingCategory) ?? 'PACKAGED',
          variantAssignments: (d.data()['variantAssignments'] as Record<string, { sellingPrice: number }>) ?? {}
        }))
        .filter((p) => Object.keys(p.variantAssignments).length > 0);

      const templatesById = new Map<string, TemplateEntry>(
        templatesSnapshot.docs.map((d) => [d.id, { id: d.id, size: Number(d.data()['size'] ?? 0), sellingPrice: Number(d.data()['sellingPrice'] ?? 0) }])
      );

      if (products.length === 0) {
        this.status.set('No products found — seed catalog first.');
        return;
      }

      const now = Date.now();
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      let created = 0;

      for (let i = 0; i < 40; i++) {
        // Deterministic pseudo-random based on index
        const r = (n: number) => Math.abs(Math.sin(i * 7 + n) * 10000) % 1;

        const orderDate = new Date(now - r(1) * ninetyDaysMs);
        const itemCount = 1 + Math.floor(r(2) * 3); // 1–3 items
        const employeeId = `seed-emp-0${1 + Math.floor(r(9) * 3)}`;

        const items: Array<{
          productId: string; variantId: string; variantTemplateId: string;
          quantity: number; unitPrice: number; lineTotal: number;
        }> = [];

        // Pick unique products for this order
        const shuffled = [...products].sort(() => r(i + 3) - 0.5).slice(0, itemCount);

        for (const product of shuffled) {
          const templateIds = Object.keys(product.variantAssignments);
          const templateId = templateIds[Math.floor(r(items.length + 4) * templateIds.length)];
          const assignment = product.variantAssignments[templateId];
          const template = templatesById.get(templateId);

          if (!assignment || !template) continue;

          const qty = product.packagingCategory === 'BULK'
            ? 1 + Math.floor(r(items.length + 5) * 5)   // 1–5 fill units
            : 1 + Math.floor(r(items.length + 6) * 3);  // 1–3 packaged units

          const unitPrice = assignment.sellingPrice;
          items.push({
            productId: product.id,
            variantId: templateId,
            variantTemplateId: templateId,
            quantity: qty,
            unitPrice,
            lineTotal: qty * unitPrice
          });
        }

        if (items.length === 0) continue;

        const total = items.reduce((s, it) => s + it.lineTotal, 0);
        await addDoc(ordersRef, {
          tenantId,
          employeeId,
          status: 'COMPLETED',
          subtotal: total,
          discountTotal: 0,
          total,
          items,
          createdAt: Timestamp.fromDate(orderDate)
        });
        created++;
      }

      this.status.set(`Seeded ${created} mock orders.`);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to seed sales history.');
    } finally {
      this.loading.set(false);
    }
  }

  private createBrandCallable() {
    return httpsCallable<{ tenantId: string; name: string; code: string; active: boolean }, CreateBrandResponse>(
      this.functions,
      'createBrand'
    );
  }

  private createCategoryCallable() {
    return httpsCallable<{ tenantId: string; name: string; code: string; active: boolean }, CreateCategoryResponse>(
      this.functions,
      'createCategory'
    );
  }

  private createConsumableCallable() {
    return httpsCallable<{
      tenantId: string;
      name: string;
      code?: string;
      unit?: string;
      costPrice?: number;
      active?: boolean;
    }, CreateConsumableResponse>(this.functions, 'createConsumable');
  }

  private createVariantTemplateCallable() {
    return httpsCallable<{
      tenantId: string;
      name: string;
      code?: string;
      size?: number;
      unit: string;
      packagingType: PackagingCategory;
      costPrice?: number;
      sellingPrice: number;
      perfumeMl?: number;
      essenceMl?: number;
      recipeConsumables?: { consumableId: string; quantity: number }[];
      active: boolean;
    }, CreateVariantTemplateResponse>(this.functions, 'createVariantTemplate');
  }

  private createProductCallable() {
    return httpsCallable<{
      tenantId: string;
      productCode: string;
      name: string;
      brandId: string;
      categoryId: string;
      productType: ProductType;
      packagingCategory: PackagingCategory;
      perfumeBaseCode?: string;
      essenceCode?: string;
      gender?: MockProductSeed['gender'];
      variantAssignments: Record<string, ProductVariantAssignment>;
      active: boolean;
    }, CreateProductResponse>(this.functions, 'createProduct');
  }

  private receiveStockCallable() {
    return httpsCallable<{
      tenantId: string;
      productId: string;
      variantTemplateId: string;
      quantity: number;
      reason: string;
    }, ReceiveStockResponse>(this.functions, 'receiveStock');
  }
}
