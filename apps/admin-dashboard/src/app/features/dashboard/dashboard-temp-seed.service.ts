import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore';
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
type ExistingSeedProduct = { id: string; data: Record<string, unknown> };
type SeedVariantTemplate = { id: string; sellingPrice: number; costPrice?: number };

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

  async seedMockBrands(): Promise<void> {
    await this.runCatalogSeed('Μάρκες', async (tenantId) => {
      await this.ensureBrands(tenantId, mockCatalogData.brands);
      return `Έτοιμες ${mockCatalogData.brands.length} μάρκες.`;
    });
  }

  async seedMockCategories(): Promise<void> {
    await this.runCatalogSeed('Κατηγορίες', async (tenantId) => {
      await this.ensureCategories(tenantId, mockCatalogData.categories);
      return `Έτοιμες ${mockCatalogData.categories.length} κατηγορίες.`;
    });
  }

  async seedMockConsumables(): Promise<void> {
    await this.runCatalogSeed('Αναλώσιμα', async (tenantId) => {
      await this.ensureConsumables(tenantId, mockCatalogData.consumables);
      return `Έτοιμα ${mockCatalogData.consumables.length} αναλώσιμα.`;
    });
  }

  async seedMockVariantTemplates(): Promise<void> {
    await this.runCatalogSeed('Πρότυπα παραλλαγών', async (tenantId) => {
      const consumableMap = await this.loadExistingIdMap(tenantId, 'consumables');
      await this.ensureVariantTemplates(tenantId, mockCatalogData.variantTemplates, consumableMap);
      return `Έτοιμα ${mockCatalogData.variantTemplates.length} πρότυπα παραλλαγών.`;
    });
  }

  async seedMockProducts(categoryCode: string): Promise<void> {
    const category = mockCatalogData.categories.find((item) => item.code === categoryCode);
    await this.runCatalogSeed(category?.name ?? 'Προϊόντα', async (tenantId) => {
      if (!category) {
        throw new Error(`Unknown mock category: ${categoryCode}.`);
      }

      const products = mockCatalogData.products.filter((item) => item.categoryCode === categoryCode);
      const [brandMap, categoryMap, templateMap, existingProducts] = await Promise.all([
        this.loadExistingIdMap(tenantId, 'brands'),
        this.loadExistingIdMap(tenantId, 'categories'),
        this.loadExistingVariantTemplates(tenantId),
        this.loadExistingProducts(tenantId)
      ]);

      let createdProducts = 0;
      let skippedProducts = 0;
      let repairedProducts = 0;
      const updateProduct = this.updateProductCallable();
      for (const product of products) {
        const brandId = brandMap.get(product.brandCode);
        const categoryId = categoryMap.get(product.categoryCode);
        if (!brandId || !categoryId) {
          throw new Error(`Missing brand/category for product ${product.productCode}.`);
        }

        const variantAssignments = this.buildVariantAssignments(product, templateMap);
        const existingProduct = existingProducts.get(product.productCode);
        if (existingProduct) {
          const currentAssignments = existingProduct.data['variantAssignments'] as
            Record<string, ProductVariantAssignment> | undefined;
          if (currentAssignments && Object.keys(currentAssignments).length > 0) {
            skippedProducts += 1;
            continue;
          }

          await updateProduct({
            tenantId,
            productId: existingProduct.id,
            productCode: typeof existingProduct.data['productCode'] === 'string'
              ? existingProduct.data['productCode'] as string
              : product.productCode,
            name: typeof existingProduct.data['name'] === 'string'
              ? existingProduct.data['name'] as string
              : product.name,
            brandId: typeof existingProduct.data['brandId'] === 'string'
              ? existingProduct.data['brandId'] as string
              : brandId,
            categoryId: typeof existingProduct.data['categoryId'] === 'string'
              ? existingProduct.data['categoryId'] as string
              : categoryId,
            productType: (existingProduct.data['productType'] as ProductType | undefined) ?? 'PERFUME',
            packagingCategory: (existingProduct.data['packagingCategory'] as PackagingCategory | undefined)
              ?? product.packagingCategory,
            gender: existingProduct.data['gender'] as MockProductSeed['gender'] | undefined,
            ingredients: typeof existingProduct.data['ingredients'] === 'string'
              ? existingProduct.data['ingredients'] as string
              : product.ingredients ?? '',
            variantAssignments,
            variantOrder: Object.keys(variantAssignments),
            active: existingProduct.data['active'] !== false
          });
          repairedProducts += 1;
          continue;
        }

        await this.createProductCallable()({
          tenantId,
          productCode: product.productCode,
          name: product.name,
          brandId,
          categoryId,
          productType: 'PERFUME' as ProductType,
          packagingCategory: product.packagingCategory,
          gender: product.gender,
          ingredients: product.ingredients ?? '',
          variantAssignments,
          active: true
        });
        createdProducts += 1;
      }

      return `${category.name}: νέα ${createdProducts}, συμπληρώθηκαν παραλλαγές ${repairedProducts}, ήδη καταχωρημένα ${skippedProducts}.`;
    });
  }

  private async runCatalogSeed(
    group: string,
    seed: (tenantId: string) => Promise<string>
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Λείπει το κατάστημα.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.status.set(`Δημιουργία δοκιμαστικών δεδομένων: ${group}...`);

    try {
      this.status.set(await seed(tenantId));
    } catch (error) {
      console.error(error);
      this.error.set(`Αποτυχία δημιουργίας δοκιμαστικών δεδομένων: ${group}.`);
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
    const snapshot = await getDocs(collection(this.firestore, `tenants/${tenantId}/variantTemplates`));
    const existing = new Map<string, { id: string; data: Record<string, unknown> }>();
    for (const item of snapshot.docs) {
      const data = item.data();
      if (typeof data['code'] === 'string') existing.set(data['code'], { id: item.id, data });
    }
    const createTemplate = this.createVariantTemplateCallable();
    const updateTemplate = this.updateVariantTemplateCallable();

    for (const seed of seeds) {
      const recipeConsumables = seed.recipeConsumables?.map((rc) => {
        const consumableId = consumableMap?.get(rc.consumableCode);
        if (!consumableId) {
          throw new Error(`Unknown consumable code "${rc.consumableCode}" in variant template ${seed.code}.`);
        }
        return { consumableId, quantity: rc.quantity };
      });

      const specialBottleConsumableId = seed.specialBottleConsumableCode
        ? consumableMap?.get(seed.specialBottleConsumableCode)
        : undefined;
      if (seed.hasSpecialBottle && !specialBottleConsumableId) {
        throw new Error(`Unknown special bottle consumable code in variant template ${seed.code}.`);
      }

      const existingTemplate = existing.get(seed.code);
      if (existingTemplate) {
        const data = existingTemplate.data;
        const specialBottleIsCurrent = data['hasSpecialBottle'] === true &&
          data['specialBottleConsumableId'] === specialBottleConsumableId &&
          Number(data['specialBottleExtraPrice']) === seed.specialBottleExtraPrice;
        if (seed.hasSpecialBottle && !specialBottleIsCurrent) {
          await updateTemplate({
            tenantId,
            templateId: existingTemplate.id,
            name: typeof data['name'] === 'string' ? data['name'] : seed.name,
            code: typeof data['code'] === 'string' ? data['code'] : seed.code,
            size: typeof data['size'] === 'number' ? data['size'] : seed.size,
            unit: typeof data['unit'] === 'string' ? data['unit'] : seed.unit,
            packagingType: (data['packagingType'] as PackagingCategory | undefined) ?? seed.packagingType,
            costPrice: typeof data['costPrice'] === 'number' ? data['costPrice'] : seed.costPrice,
            sellingPrice: typeof data['sellingPrice'] === 'number' ? data['sellingPrice'] : seed.sellingPrice,
            perfumeMl: typeof data['perfumeMl'] === 'number' ? data['perfumeMl'] : seed.perfumeMl,
            essenceMl: typeof data['essenceMl'] === 'number' ? data['essenceMl'] : seed.essenceMl,
            recipeConsumables: Array.isArray(data['recipeConsumables'])
              ? data['recipeConsumables'] as { consumableId: string; quantity: number }[]
              : [],
            consumableParts: Array.isArray(data['consumableParts']) ? data['consumableParts'] : [],
            hasSpecialBottle: true,
            specialBottleConsumableId,
            specialBottleExtraPrice: seed.specialBottleExtraPrice,
            active: data['active'] !== false
          });
        }
        continue;
      }

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
        hasSpecialBottle: seed.hasSpecialBottle,
        specialBottleConsumableId,
        specialBottleExtraPrice: seed.specialBottleExtraPrice,
        active: true
      });
      existing.set(seed.code, { id: result.data.templateId, data: {} });
    }

    const templateIds = new Map<string, string>();
    for (const [code, template] of existing) templateIds.set(code, template.id);
    return templateIds;
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

  private async loadExistingProducts(tenantId: string): Promise<Map<string, ExistingSeedProduct>> {
    const snapshot = await getDocs(collection(this.firestore, `tenants/${tenantId}/products`));
    const products = new Map<string, ExistingSeedProduct>();

    for (const item of snapshot.docs) {
      const data = item.data();
      const productCode = data['productCode'];
      if (typeof productCode === 'string') {
        products.set(productCode, { id: item.id, data });
      }
    }

    return products;
  }

  private async loadExistingVariantTemplates(tenantId: string): Promise<Map<string, SeedVariantTemplate>> {
    const snapshot = await getDocs(collection(this.firestore, `tenants/${tenantId}/variantTemplates`));
    const templates = new Map<string, SeedVariantTemplate>();

    for (const item of snapshot.docs) {
      const data = item.data();
      const code = data['code'];
      if (typeof code !== 'string') continue;
      templates.set(code, {
        id: item.id,
        sellingPrice: Number(data['sellingPrice'] ?? 0),
        costPrice: typeof data['costPrice'] === 'number' ? data['costPrice'] : undefined
      });
    }

    return templates;
  }

  private buildVariantAssignments(
    product: MockProductSeed,
    templateMap: Map<string, SeedVariantTemplate>
  ): Record<string, ProductVariantAssignment> {
    const assignments: Record<string, ProductVariantAssignment> = {};

    for (const variant of product.variantAssignments) {
      const template = templateMap.get(variant.templateCode);
      if (!template) {
        throw new Error(`Missing variant template ${variant.templateCode} for ${product.productCode}.`);
      }
      assignments[template.id] = {
        sellingPrice: template.sellingPrice,
        costPrice: template.costPrice
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
      const orders: Array<{
        employeeId: string;
        subtotal: number;
        discountTotal: number;
        total: number;
        createdAt: string;
        items: Array<{
          productId: string;
          variantId: string;
          variantTemplateId: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }>;
      }> = [];

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
        orders.push({
          employeeId,
          subtotal: total,
          discountTotal: 0,
          total,
          items,
          createdAt: orderDate.toISOString()
        });
        created++;
      }

      await httpsCallable(this.functions, 'seedMockOrders')({ tenantId, orders });
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
      hasSpecialBottle?: boolean;
      specialBottleConsumableId?: string;
      specialBottleExtraPrice?: number;
      active: boolean;
    }, CreateVariantTemplateResponse>(this.functions, 'createVariantTemplate');
  }

  private updateVariantTemplateCallable() {
    return httpsCallable<{
      tenantId: string;
      templateId: string;
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
      consumableParts?: { variantTemplateId: string; quantity: number }[];
      hasSpecialBottle?: boolean;
      specialBottleConsumableId?: string;
      specialBottleExtraPrice?: number;
      active: boolean;
    }, { ok: boolean }>(this.functions, 'updateVariantTemplate');
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
      gender?: MockProductSeed['gender'];
      ingredients?: string;
      variantAssignments: Record<string, ProductVariantAssignment>;
      active: boolean;
    }, CreateProductResponse>(this.functions, 'createProduct');
  }

  private updateProductCallable() {
    return httpsCallable<{
      tenantId: string;
      productId: string;
      productCode: string;
      name: string;
      brandId: string;
      categoryId: string;
      productType: ProductType;
      packagingCategory: PackagingCategory;
      gender?: MockProductSeed['gender'];
      ingredients?: string;
      variantAssignments: Record<string, ProductVariantAssignment>;
      variantOrder: string[];
      active: boolean;
    }, { ok: boolean }>(this.functions, 'updateProduct');
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
