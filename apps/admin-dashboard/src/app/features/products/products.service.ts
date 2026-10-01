import { Injectable, inject, signal } from '@angular/core';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import {
  Brand,
  Category,
  PackagingCategory,
  PackagingType,
  Product,
  ProductGender,
  ProductType,
  ProductVariantAssignment,
  VariantTemplate
} from '../../core/types/domain.models';

type NamedLookup = {
  id: string;
  name: string;
  active: boolean;
};

export type ProductRow = Product & {
  id: string;
  brandName: string;
  categoryName: string;
};

export type VariantTemplateOption = VariantTemplate & {
  id: string;
};

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  readonly products = signal<ProductRow[]>([]);
  readonly brands = signal<NamedLookup[]>([]);
  readonly categories = signal<NamedLookup[]>([]);
  readonly variantTemplates = signal<VariantTemplateOption[]>([]);
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
      this.products.set([]);
      this.brands.set([]);
      this.categories.set([]);
      this.variantTemplates.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const brandsRef = collection(this.firestore, `tenants/${tenantId}/brands`);
      const categoriesRef = collection(this.firestore, `tenants/${tenantId}/categories`);
      const productsRef = collection(this.firestore, `tenants/${tenantId}/products`);
      const templatesRef = collection(
        this.firestore,
        `tenants/${tenantId}/variantTemplates`
      );

      const [brandsSnapshot, categoriesSnapshot, productsSnapshot, templatesSnapshot] = await Promise.all([
        getDocs(query(brandsRef, orderBy('name', 'asc'))),
        getDocs(query(categoriesRef, orderBy('name', 'asc'))),
        getDocs(query(productsRef, orderBy('name', 'asc'))),
        getDocs(query(templatesRef, orderBy('name', 'asc')))
      ]);

      const brands = brandsSnapshot.docs.map((item) => {
        const data = item.data() as Partial<Brand>;
        return {
          id: item.id,
          name: data.name ?? '',
          active: data.active ?? true
        };
      });

      const categories = categoriesSnapshot.docs.map((item) => {
        const data = item.data() as Partial<Category>;
        return {
          id: item.id,
          name: data.name ?? '',
          active: data.active ?? true
        };
      });

      const brandById = new Map(brands.map((item) => [item.id, item.name]));
      const categoryById = new Map(categories.map((item) => [item.id, item.name]));

      const variantTemplates: VariantTemplateOption[] = templatesSnapshot.docs.map(
        (item) => {
          const data = item.data() as Partial<VariantTemplate>;
          return {
            id: item.id,
            tenantId,
            name: data.name ?? '',
            code: data.code,
            size: typeof data.size === 'number' ? data.size : undefined,
            unit: data.unit ?? 'ml',
            packagingType: (data.packagingType as PackagingType) ?? 'PACKAGED',
            costPrice: data.costPrice ?? 0,
            sellingPrice: data.sellingPrice ?? 0,
            active: data.active ?? true,
            createdAt: this.normalizeTimestamp(data.createdAt),
            updatedAt: this.normalizeTimestamp(data.updatedAt)
          };
        }
      );

      const products: ProductRow[] = productsSnapshot.docs.map((item) => {
        const data = item.data() as Partial<Product>;
        const brandId = data.brandId ?? '';
        const categoryId = data.categoryId ?? '';
        return {
          id: item.id,
          tenantId,
          productCode: data.productCode ?? '',
          name: data.name ?? '',
          brandId,
          categoryId,
          productType: (data.productType as ProductType) ?? 'PERFUME',
          packagingCategory: (data.packagingCategory as PackagingCategory) ?? 'PACKAGED',
          gender: data.gender as ProductGender | undefined,
          perfumeBaseCode: data.perfumeBaseCode,
          essenceCode: data.essenceCode,
          variantAssignments: (data.variantAssignments as Record<string, ProductVariantAssignment>) ?? {},
          active: data.active ?? true,
          createdAt: this.normalizeTimestamp(data.createdAt),
          updatedAt: this.normalizeTimestamp(data.updatedAt),
          brandName: brandById.get(brandId) ?? '-',
          categoryName: categoryById.get(categoryId) ?? '-'
        };
      });

      this.brands.set(brands.filter((item) => item.active));
      this.categories.set(categories.filter((item) => item.active));
      this.variantTemplates.set(variantTemplates.filter((item) => item.active));
      this.products.set(products);
    } catch (error) {
      console.error(error);
      this.error.set('Αποτυχία φόρτωσης προϊόντων.');
    } finally {
      this.loading.set(false);
    }
  }

  async createProduct(input: {
    productCode: string;
    name: string;
    brandId: string;
    categoryId: string;
    productType: ProductType;
    packagingCategory: PackagingCategory;
    perfumeBaseCode?: string;
    essenceCode?: string;
    gender?: ProductGender;
    variantAssignments: Record<string, ProductVariantAssignment>;
    active: boolean;
  }): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.'); return; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'createProduct')({ tenantId, ...input });
      await this.loadAll();
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία δημιουργίας προϊόντος.');
    }
  }

  async updateProduct(
    productId: string,
    input: {
      productCode: string;
      name: string;
      brandId: string;
      categoryId: string;
      productType: ProductType;
      packagingCategory: PackagingCategory;
      perfumeBaseCode?: string;
      essenceCode?: string;
      gender?: ProductGender;
      variantAssignments: Record<string, ProductVariantAssignment>;
      active: boolean;
    }
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.'); return; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'updateProduct')({ tenantId, productId, ...input });
      await this.loadAll();
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία ενημέρωσης προϊόντος.');
    }
  }

  async seedDefaultVariantTemplates(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    const templatesRef = collection(this.firestore, `tenants/${tenantId}/variantTemplates`);
    const existing = await getDocs(query(templatesRef));
    if (!existing.empty) {
      await this.loadAll();
      return;
    }

    const now = new Date().toISOString();
    const defaults: VariantTemplate[] = [
      {
        tenantId,
        name: '50ml Bulk Bottle',
        code: '50ML-BULK',
        size: 50,
        unit: 'ml',
        packagingType: 'BULK',
        costPrice: 10,
        sellingPrice: 15,
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        tenantId,
        name: '100ml Bulk Bottle',
        code: '100ML-BULK',
        size: 100,
        unit: 'ml',
        packagingType: 'BULK',
        costPrice: 15,
        sellingPrice: 22,
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        tenantId,
        name: '100ml Packaged',
        code: '100ML-PACK',
        size: 100,
        unit: 'ml',
        packagingType: 'PACKAGED',
        costPrice: 22,
        sellingPrice: 30,
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        tenantId,
        name: '1pc Packaged',
        code: '1PC-PACK',
        unit: 'pc',
        packagingType: 'PACKAGED',
        costPrice: 3,
        sellingPrice: 5,
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    await Promise.all(defaults.map((item) => addDoc(templatesRef, item)));
    await this.loadAll();
  }

  async toggleProductActive(productId: string, active: boolean): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.'); return; }
    try {
      await httpsCallable(this.functions, 'toggleProductActive')({ tenantId, productId, active });
      await this.loadAll();
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία αλλαγής κατάστασης προϊόντος.');
    }
  }

  async deleteProduct(productId: string): Promise<boolean> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.'); return false; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'deleteProduct')({ tenantId, productId });
      await this.loadAll();
      return true;
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Αποτυχία διαγραφής προϊόντος.';
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
