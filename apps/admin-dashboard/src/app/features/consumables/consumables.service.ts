import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import { Consumable } from '../../core/types/domain.models';

export type ConsumableRow = Consumable & {
  id: string;
};

@Injectable({ providedIn: 'root' })
export class ConsumablesService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  readonly consumables = signal<ConsumableRow[]>([]);
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
      this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.');
      this.consumables.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const consumablesRef = collection(this.firestore, `tenants/${tenantId}/consumables`);
      const snapshot = await getDocs(query(consumablesRef, orderBy('name', 'asc')));

      const rows: ConsumableRow[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Partial<Consumable>;
        return {
          id: docSnap.id,
          tenantId,
          name: data.name ?? '',
          code: data.code,
          unit: data.unit ?? 'τεμ.',
          costPrice: typeof data.costPrice === 'number' ? data.costPrice : undefined,
          active: data.active ?? true,
          createdAt: this.normalizeTimestamp(data.createdAt),
          updatedAt: this.normalizeTimestamp(data.updatedAt)
        };
      });

      this.consumables.set(rows);
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία φόρτωσης αναλωσίμων.');
    } finally {
      this.loading.set(false);
    }
  }

  async createConsumable(input: {
    name: string;
    code?: string;
    unit?: string;
    costPrice?: number;
    active: boolean;
  }): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.');
      return;
    }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'createConsumable')({ tenantId, ...input });
      await this.loadAll();
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία δημιουργίας αναλωσίμου.');
    }
  }

  async updateConsumable(
    consumableId: string,
    input: {
      name: string;
      code?: string;
      unit?: string;
      costPrice?: number;
      active: boolean;
    }
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.');
      return;
    }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'updateConsumable')({
        tenantId,
        consumableId,
        ...input
      });
      await this.loadAll();
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία ενημέρωσης αναλωσίμου.');
    }
  }

  async toggleConsumableActive(consumableId: string, active: boolean): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.');
      return;
    }
    try {
      await httpsCallable(this.functions, 'toggleConsumableActive')({
        tenantId,
        consumableId,
        active
      });
      await this.loadAll();
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία αλλαγής κατάστασης αναλωσίμου.');
    }
  }

  private normalizeTimestamp(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
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
