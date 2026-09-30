import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import { Brand } from '../../core/types/domain.models';

export type BrandRow = Brand & {
  id: string;
};

@Injectable({ providedIn: 'root' })
export class BrandsService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
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
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    this.error.set(null);
    await httpsCallable(this.functions, 'createBrand')({ tenantId, ...input });
    await this.loadBrands();
  }

  async updateBrand(
    brandId: string,
    input: { name: string; code?: string; active: boolean }
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    this.error.set(null);
    await httpsCallable(this.functions, 'updateBrand')({ tenantId, brandId, ...input });
    await this.loadBrands();
  }

  async toggleBrandActive(brandId: string, active: boolean): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    await httpsCallable(this.functions, 'toggleBrandActive')({ tenantId, brandId, active });
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
