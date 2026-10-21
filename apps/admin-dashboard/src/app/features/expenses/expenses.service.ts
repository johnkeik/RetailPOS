import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import { Employee, PaymentMethod } from '../../core/types/domain.models';

// Firestore: tenants/{tenantId}/expenses/{expenseId}
export type ExpenseRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
  createdAt: Date;
};

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  readonly expenses = signal<ExpenseRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }
  }

  async create(input: {
    employeeId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    description: string;
  }): Promise<boolean> {
    return this.mutate('createExpense', input, 'Αποτυχία καταχώρησης εξόδου.');
  }

  async update(
    expenseId: string,
    input: { amount: number; paymentMethod: PaymentMethod; description: string }
  ): Promise<boolean> {
    return this.mutate('updateExpense', { expenseId, ...input }, 'Αποτυχία ενημέρωσης εξόδου.');
  }

  async remove(expenseId: string): Promise<boolean> {
    return this.mutate('deleteExpense', { expenseId }, 'Αποτυχία διαγραφής εξόδου.');
  }

  private async mutate(name: string, payload: object, failure: string): Promise<boolean> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.');
      return false;
    }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, name)({ tenantId, ...payload });
      await this.load();
      return true;
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : failure);
      return false;
    }
  }

  async load(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Δεν βρέθηκε πλαίσιο καταστήματος.');
      this.expenses.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const [snapshot, employeesSnapshot] = await Promise.all([
        getDocs(
          query(collection(this.firestore, `tenants/${tenantId}/expenses`), orderBy('createdAt', 'desc'))
        ),
        getDocs(collection(this.firestore, `tenants/${tenantId}/employees`))
      ]);
      const employeeNames = new Map(
        employeesSnapshot.docs.map((item) => [item.id, (item.data() as Partial<Employee>).name ?? ''])
      );

      this.expenses.set(
        snapshot.docs.map((item) => {
          const data = item.data();
          const employeeId = (data['employeeId'] as string | undefined) ?? '-';
          const createdAt = data['createdAt'] as { toDate?: () => Date } | undefined;
          return {
            id: item.id,
            employeeId,
            employeeName: employeeNames.get(employeeId) || employeeId,
            amount: Number(data['amount'] ?? 0),
            paymentMethod: data['paymentMethod'] as PaymentMethod,
            description: (data['description'] as string | undefined) ?? '',
            createdAt: createdAt?.toDate?.() ?? new Date()
          };
        })
      );
    } catch (err) {
      console.error(err);
      this.error.set('Αποτυχία φόρτωσης εξόδων.');
    } finally {
      this.loading.set(false);
    }
  }
}
