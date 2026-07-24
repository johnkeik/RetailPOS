import { Injectable, inject, signal } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { Brand } from '../../core/types/domain.models';

export type BrandRow = Brand & {
  id: string;
};

@Injectable({ providedIn: 'root' })
export class BrandsService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly tenantContext = inject(TenantContextService);

  readonly brands = signal<BrandRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }

    void this.loadBrands();
  }

  async loadBrands(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      this.brands.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const brandsRef = collection(this.firestore, `tenants/${tenantId}/brands`);
      const snapshot = await getDocs(query(brandsRef, orderBy('name', 'asc')));

      const rows: BrandRow[] = snapshot.docs.map((item) => {
        const data = item.data() as Partial<Brand>;
        return {
          id: item.id,
          tenantId,
          name: data.name ?? '',
          code: data.code,
          active: data.active ?? true,
          createdAt: this.normalizeTimestamp(data.createdAt)
        };
      });

      this.brands.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to load brands from Firestore emulator.');
    } finally {
      this.loading.set(false);
    }
  }

  async createBrand(input: {
    name: string;
    code?: string;
    active: boolean;
  }): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    this.error.set(null);

    const payload: Brand = {
      tenantId,
      name: input.name,
      code: input.code,
      active: input.active,
      createdAt: new Date().toISOString()
    };

    const brandsRef = collection(this.firestore, `tenants/${tenantId}/brands`);
    await addDoc(brandsRef, payload);
    await this.loadBrands();
  }

  async updateBrand(
    brandId: string,
    input: { name: string; code?: string; active: boolean }
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    this.error.set(null);

    const brandRef = doc(this.firestore, `tenants/${tenantId}/brands/${brandId}`);
    await updateDoc(brandRef, {
      name: input.name,
      code: input.code ?? null,
      active: input.active
    });

    await this.loadBrands();
  }

  async toggleBrandActive(brandId: string, active: boolean): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    const brandRef = doc(this.firestore, `tenants/${tenantId}/brands/${brandId}`);
    await updateDoc(brandRef, { active });
    await this.loadBrands();
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
