import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { Employee, Order, OrderItem, Product, VariantTemplate } from '../../core/types/domain.models';

export type SalesHistoryItem = OrderItem & {
  productName: string;
  variantName: string;
};

export type SalesHistoryRow = Order & {
  id: string;
  itemCount: number;
  employeeName: string;
  items: SalesHistoryItem[];
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
      const employeesRef = collection(this.firestore, `tenants/${tenantId}/employees`);
      const productsRef = collection(this.firestore, `tenants/${tenantId}/products`);
      const templatesRef = collection(this.firestore, `tenants/${tenantId}/variantTemplates`);
      const [snapshot, employeesSnapshot, productsSnapshot, templatesSnapshot] = await Promise.all([
        getDocs(query(ordersRef, orderBy('createdAt', 'desc'))),
        getDocs(employeesRef),
        getDocs(productsRef),
        getDocs(templatesRef)
      ]);

      const employeeNames = new Map(
        employeesSnapshot.docs.map((item) => [item.id, (item.data() as Partial<Employee>).name ?? ''])
      );
      const productNames = new Map(
        productsSnapshot.docs.map((item) => [item.id, (item.data() as Partial<Product>).name ?? ''])
      );
      const variantNames = new Map(
        templatesSnapshot.docs.map((item) => [item.id, (item.data() as Partial<VariantTemplate>).name ?? ''])
      );

      const rows: SalesHistoryRow[] = snapshot.docs.filter((item) => item.data()['status'] !== 'DELETED').map((item) => {
        const data = item.data() as Partial<Order>;
        const orderItems = Array.isArray(data.items) ? (data.items as OrderItem[]) : [];
        const employeeId = data.employeeId ?? '-';
        const items: SalesHistoryItem[] = orderItems.map((orderItem) => {
          const templateId = orderItem.variantTemplateId ?? orderItem.variantId;
          return {
            ...orderItem,
            productName: productNames.get(orderItem.productId) || orderItem.productId,
            variantName: variantNames.get(templateId) || templateId
          };
        });

        return {
          id: item.id,
          originalOrderId: data.originalOrderId,
          cancellationReason: data.cancellationReason,
          cancelledAt: data.cancelledAt ? this.normalizeTimestamp(data.cancelledAt) : undefined,
          cancelledByEmployeeId: data.cancelledByEmployeeId,
          cancelledByEmployeeName: data.cancelledByEmployeeName ||
            employeeNames.get(data.cancelledByEmployeeId ?? '') || undefined,
          tenantId,
          employeeId,
          employeeName: employeeNames.get(employeeId) || employeeId,
          status: data.status ?? 'COMPLETED',
          paymentMethod: data.paymentMethod,
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
