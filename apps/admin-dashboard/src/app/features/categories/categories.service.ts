import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import { Category } from '../../core/types/domain.models';

export type CategoryRow = Category & {
  id: string;
};

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  readonly categories = signal<CategoryRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }

    void this.loadCategories();
  }

  async loadCategories(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      this.categories.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const categoriesRef = collection(
        this.firestore,
        `tenants/${tenantId}/categories`
      );
      const snapshot = await getDocs(query(categoriesRef, orderBy('name', 'asc')));

      const rows: CategoryRow[] = snapshot.docs.map((item) => {
        const data = item.data() as Partial<Category>;
        return {
          id: item.id,
          tenantId,
          name: data.name ?? '',
          code: data.code,
          active: data.active ?? true,
          createdAt: this.normalizeTimestamp(data.createdAt)
        };
      });

      this.categories.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to load categories from Firestore emulator.');
    } finally {
      this.loading.set(false);
    }
  }

  async createCategory(input: {
    name: string;
    code?: string;
    active: boolean;
  }): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    this.error.set(null);
    await httpsCallable(this.functions, 'createCategory')({ tenantId, ...input });
    await this.loadCategories();
  }

  async updateCategory(
    categoryId: string,
    input: { name: string; code?: string; active: boolean }
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    this.error.set(null);
    await httpsCallable(this.functions, 'updateCategory')({ tenantId, categoryId, ...input });
    await this.loadCategories();
  }

  async toggleCategoryActive(categoryId: string, active: boolean): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    await httpsCallable(this.functions, 'toggleCategoryActive')({ tenantId, categoryId, active });
    await this.loadCategories();
  }

  async deleteCategory(categoryId: string): Promise<boolean> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.'); return false; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'deleteCategory')({ tenantId, categoryId });
      await this.loadCategories();
      return true;
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Αποτυχία διαγραφής κατηγορίας.';
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
