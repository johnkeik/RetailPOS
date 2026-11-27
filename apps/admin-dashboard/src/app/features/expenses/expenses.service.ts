import { Injectable, inject, signal } from '@angular/core';
import { QueryConstraint, Timestamp, collection, getDocs, orderBy, query, where } from 'firebase/firestore';
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
  voided: boolean;
  /** Set when a voided expense: who voided it and when. */
  voidedBy: string | null;
  voidedAt: Date | null;
  /** Set when the expense was edited after creation. */
  updatedBy: string | null;
  updatedAt: Date | null;
};

type TimestampLike = { toDate?: () => Date } | undefined;

// Changes made from the POS name the employee; changes from the dashboard come from the owner.
function changedBy(
  data: Record<string, unknown>,
  prefix: 'updated' | 'voided',
  employeeNames: Map<string, string>
): string | null {
  const employeeId = data[`${prefix}ByEmployeeId`] as string | undefined;
  if (employeeId) return employeeNames.get(employeeId) || employeeId;
  return data[`${prefix}ByUid`] ? 'Διαχειριστής' : null;
}

export type ExpenseRange = { from?: Date | null; to?: Date | null };

function rangeConstraints(range: ExpenseRange): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (range.from) constraints.push(where('createdAt', '>=', Timestamp.fromDate(range.from)));
  if (range.to) constraints.push(where('createdAt', '<', Timestamp.fromDate(range.to)));
  return constraints;
}

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
      await this.load(this.range);
      return true;
    } catch (err) {
      console.error(err);
      this.error.set(err instanceof Error ? err.message : failure);
      return false;
    }
  }

  /** Last requested range, reused when a create/update/delete refreshes the list. */
  private range: ExpenseRange = {};
  private loadRequestId = 0;

  /** Loads expenses with createdAt in [from, to). A missing bound leaves that side open. */
  async load(range: ExpenseRange = this.range): Promise<void> {
    this.range = range;
    const requestId = ++this.loadRequestId;
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
          query(
            collection(this.firestore, `tenants/${tenantId}/expenses`),
            ...rangeConstraints(range),
            orderBy('createdAt', 'desc')
          )
        ),
        getDocs(collection(this.firestore, `tenants/${tenantId}/employees`))
      ]);
      if (requestId !== this.loadRequestId) return;
      const employeeNames = new Map(
        employeesSnapshot.docs.map((item) => [item.id, (item.data() as Partial<Employee>).name ?? ''])
      );

      this.expenses.set(
        snapshot.docs.map((item) => {
          const data = item.data();
          const employeeId = (data['employeeId'] as string | undefined) ?? '-';
          const createdAt = data['createdAt'] as TimestampLike;
          const voided = data['status'] === 'VOIDED';
          const updatedAt = (data['updatedAt'] as TimestampLike)?.toDate?.() ?? null;
          return {
            id: item.id,
            employeeId,
            employeeName: employeeNames.get(employeeId) || employeeId,
            amount: Number(data['amount'] ?? 0),
            paymentMethod: data['paymentMethod'] as PaymentMethod,
            description: (data['description'] as string | undefined) ?? '',
            createdAt: createdAt?.toDate?.() ?? new Date(),
            voided,
            voidedBy: voided ? changedBy(data, 'voided', employeeNames) : null,
            voidedAt: voided ? (data['voidedAt'] as TimestampLike)?.toDate?.() ?? null : null,
            updatedBy: updatedAt ? changedBy(data, 'updated', employeeNames) : null,
            updatedAt
          };
        })
      );
    } catch (err) {
      if (requestId !== this.loadRequestId) return;
      console.error(err);
      this.error.set('Αποτυχία φόρτωσης εξόδων.');
      this.expenses.set([]);
    } finally {
      if (requestId === this.loadRequestId) this.loading.set(false);
    }
  }
}
