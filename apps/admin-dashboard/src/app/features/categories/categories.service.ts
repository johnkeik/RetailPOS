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
import { Category } from '../../core/types/domain.models';

export type CategoryRow = Category & {
  id: string;
};

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
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
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    this.error.set(null);

    const payload: Category = {
      tenantId,
      name: input.name,
      code: input.code,
      active: input.active,
      createdAt: new Date().toISOString()
    };

    const categoriesRef = collection(this.firestore, `tenants/${tenantId}/categories`);
    await addDoc(categoriesRef, payload);
    await this.loadCategories();
  }

  async updateCategory(
    categoryId: string,
    input: { name: string; code?: string; active: boolean }
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    this.error.set(null);

    const categoryRef = doc(
      this.firestore,
      `tenants/${tenantId}/categories/${categoryId}`
    );
    await updateDoc(categoryRef, {
      name: input.name,
      code: input.code ?? null,
      active: input.active
    });

    await this.loadCategories();
  }

  async toggleCategoryActive(categoryId: string, active: boolean): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      return;
    }

    const categoryRef = doc(
      this.firestore,
      `tenants/${tenantId}/categories/${categoryId}`
    );
    await updateDoc(categoryRef, { active });
    await this.loadCategories();
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
