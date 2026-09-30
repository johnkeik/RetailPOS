import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import { Employee } from '../../core/types/domain.models';

export type EmployeeRow = Employee & {
  id: string;
};

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  readonly employees = signal<EmployeeRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    if (!this.tenantContext.tenantId()) {
      this.tenantContext.setTenant('store001');
    }

    void this.loadEmployees();
  }

  async loadEmployees(): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      this.error.set('Missing tenant context.');
      this.employees.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const employeesRef = collection(this.firestore, `tenants/${tenantId}/employees`);
      const snapshot = await getDocs(query(employeesRef, orderBy('name', 'asc')));

      const rows: EmployeeRow[] = snapshot.docs.map((item) => {
        const data = item.data() as Partial<Employee>;
        return {
          id: item.id,
          tenantId,
          name: data.name ?? '',
          employeeCode: data.employeeCode ?? '',
          active: data.active ?? true,
          createdAt: this.normalizeTimestamp(data.createdAt)
        };
      });

      this.employees.set(rows);
    } catch (error) {
      console.error(error);
      this.error.set('Failed to load employees from Firestore emulator.');
    } finally {
      this.loading.set(false);
    }
  }

  async createEmployee(input: { name: string; employeeCode: string; active: boolean }): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    this.error.set(null);
    await httpsCallable(this.functions, 'createEmployee')({ tenantId, ...input });
    await this.loadEmployees();
  }

  async updateEmployee(
    employeeId: string,
    input: { name: string; employeeCode: string; active: boolean }
  ): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    this.error.set(null);
    await httpsCallable(this.functions, 'updateEmployee')({ tenantId, employeeId, ...input });
    await this.loadEmployees();
  }

  async toggleEmployeeActive(employeeId: string, active: boolean): Promise<void> {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) { this.error.set('Missing tenant context.'); return; }
    await httpsCallable(this.functions, 'toggleEmployeeActive')({ tenantId, employeeId, active });
    await this.loadEmployees();
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
