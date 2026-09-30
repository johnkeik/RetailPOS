import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { Order, OrderItem } from '../../core/types/domain.models';

export type SalesHistoryRow = Order & {
  id: string;
  itemCount: number;
};

@Injectable({ providedIn: 'root' })
export class SalesHistoryService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly tenantContext = inject(TenantContextService);

  readonly orders = signal<SalesHistoryRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }

    void this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      this.orders.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const ordersRef = collection(this.firestore, `tenants/${tenantId}/orders`);
      const snapshot = await getDocs(query(ordersRef, orderBy('createdAt', 'desc')));

      const rows: SalesHistoryRow[] = snapshot.docs.map((item) => {
        const data = item.data() as Partial<Order>;
        const items = Array.isArray(data.items) ? (data.items as OrderItem[]) : [];

        return {
          id: item.id,
          tenantId,
          employeeId: data.employeeId ?? '-',
          status: data.status ?? 'COMPLETED',
          subtotal: typeof data.subtotal === 'number' ? data.subtotal : undefined,
          discountTotal:
            typeof data.discountTotal === 'number' ? data.discountTotal : undefined,
          total: data.total ?? 0,
          items,
          createdAt: this.normalizeTimestamp(data.createdAt),
          itemCount: items.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
        };
      });

      this.orders.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to load sales history from Firestore emulator.');
    } finally {
      this.loading.set(false);
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
