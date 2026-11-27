import { Injectable, inject, signal } from '@angular/core';
import { Timestamp, collection, getDocs, orderBy, query, where } from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { Employee, Order, OrderItem, Product, VariantTemplate } from '../../core/types/domain.models';

export type SalesHistoryItem = OrderItem & {
  productName: string;
  variantName: string;
};

/** Inclusive start, exclusive end. Orders are always fetched for a bounded period. */
export type OrderRange = { from: Date; to?: Date | null };

type NameLookups = {
  employees: Map<string, string>;
  products: Map<string, string>;
  variants: Map<string, string>;
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

  /** Names only change rarely, so they are read once per session instead of with every order load. */
  private lookups: NameLookups | null = null;
  /** Orders can reference deleted products forever, so an unknown name triggers at most one refresh. */
  private lookupsRefreshedForUnknown = false;
  private lastRange: OrderRange | null = null;

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }
  }

  /** Reloads the last requested period, e.g. for a refresh button. */
  async reload(): Promise<void> {
    if (this.lastRange) await this.loadOrders(this.lastRange);
  }

  async loadOrders(range: OrderRange): Promise<void> {
    this.lastRange = range;
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
      const constraints = [where('createdAt', '>=', Timestamp.fromDate(range.from))];
      if (range.to) constraints.push(where('createdAt', '<', Timestamp.fromDate(range.to)));
      const snapshot = await getDocs(query(ordersRef, ...constraints, orderBy('createdAt', 'desc')));

      // An employee, product or variant added after the names were cached would show as an id.
      const referencesUnknownName = (lookups: NameLookups) => snapshot.docs.some((item) => {
        const order = item.data() as Partial<Order>;
        return (!!order.employeeId && !lookups.employees.has(order.employeeId)) ||
          (order.items ?? []).some((orderItem) =>
            !lookups.products.has(orderItem.productId) ||
            !lookups.variants.has(orderItem.variantTemplateId ?? orderItem.variantId)
          );
      });
      if (!this.lookups) {
        this.lookups = await this.loadLookups(tenantId);
      } else if (!this.lookupsRefreshedForUnknown && referencesUnknownName(this.lookups)) {
        this.lookupsRefreshedForUnknown = true;
        this.lookups = await this.loadLookups(tenantId);
      }
      const { employees: employeeNames, products: productNames, variants: variantNames } = this.lookups;

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
          appliedPromotions: data.appliedPromotions ?? [],
          items,
          createdAt: this.normalizeTimestamp(data.createdAt),
          itemCount: items.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
        };
      });

      this.orders.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Αποτυχία φόρτωσης πωλήσεων.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadLookups(tenantId: string): Promise<NameLookups> {
    const [employeesSnapshot, productsSnapshot, templatesSnapshot] = await Promise.all([
      getDocs(collection(this.firestore, `tenants/${tenantId}/employees`)),
      getDocs(collection(this.firestore, `tenants/${tenantId}/products`)),
      getDocs(collection(this.firestore, `tenants/${tenantId}/variantTemplates`))
    ]);
    return {
      employees: new Map(employeesSnapshot.docs.map((item) => [item.id, (item.data() as Partial<Employee>).name ?? ''])),
      products: new Map(productsSnapshot.docs.map((item) => [item.id, (item.data() as Partial<Product>).name ?? ''])),
      variants: new Map(templatesSnapshot.docs.map((item) => [item.id, (item.data() as Partial<VariantTemplate>).name ?? '']))
    };
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
