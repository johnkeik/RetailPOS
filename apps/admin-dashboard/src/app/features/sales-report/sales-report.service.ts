import { Injectable, inject, signal } from '@angular/core';
import { Timestamp, collection, getDocs, orderBy, query, where } from 'firebase/firestore';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE } from '../../core/firebase/firebase.providers';
import { Employee, PaymentMethod } from '../../core/types/domain.models';

export type DailySalesOrder = {
  employeeId: string;
  employeeName: string;
  paymentMethod?: PaymentMethod;
  total: number;
  createdAt: Date;
};

@Injectable({ providedIn: 'root' })
export class SalesReportService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly tenantContext = inject(TenantContextService);

  readonly orders = signal<DailySalesOrder[]>([]);
  readonly expenses = signal<DailySalesOrder[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(from: Date, to: Date): Promise<void> {
    const tenantId = this.tenantContext.tenantId() ?? 'store001';
    this.loading.set(true);
    this.error.set(null);

    try {
      const [snapshot, expensesSnapshot, employeesSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(this.firestore, `tenants/${tenantId}/orders`),
            where('createdAt', '>=', Timestamp.fromDate(from)),
            where('createdAt', '<=', Timestamp.fromDate(to)),
            orderBy('createdAt', 'desc')
          )
        ),
        getDocs(
          query(
            collection(this.firestore, `tenants/${tenantId}/expenses`),
            where('createdAt', '>=', Timestamp.fromDate(from)),
            where('createdAt', '<=', Timestamp.fromDate(to)),
            orderBy('createdAt', 'desc')
          )
        ),
        getDocs(collection(this.firestore, `tenants/${tenantId}/employees`))
      ]);
      const names = new Map(
        employeesSnapshot.docs.map((item) => [item.id, (item.data() as Partial<Employee>).name ?? ''])
      );

      this.expenses.set(
        expensesSnapshot.docs.map((item) => {
          const data = item.data();
          const employeeId = (data['employeeId'] as string | undefined) ?? '-';
          return {
            employeeId,
            employeeName: names.get(employeeId) || employeeId,
            paymentMethod: data['paymentMethod'] as PaymentMethod | undefined,
            total: Number(data['amount'] ?? 0),
            createdAt: (data['createdAt'] as Timestamp).toDate()
          };
        })
      );

      this.orders.set(
        snapshot.docs
          .filter((item) => (item.data()['status'] ?? 'COMPLETED') === 'COMPLETED')
          .map((item) => {
            const data = item.data();
            const employeeId = (data['employeeId'] as string | undefined) ?? '-';
            return {
              employeeId,
              employeeName: names.get(employeeId) || employeeId,
              paymentMethod: data['paymentMethod'] as PaymentMethod | undefined,
              total: Number(data['total'] ?? 0),
              createdAt: (data['createdAt'] as Timestamp).toDate()
            };
          })
      );
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία φόρτωσης αναφοράς πωλήσεων.');
    } finally {
      this.loading.set(false);
    }
  }
}
