import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EmployeesService } from '../employees/employees.service';
import { ExpensesService } from './expenses.service';

@Component({
  selector: 'app-expenses-page',
  imports: [EntityActionsComponent, PageTitleComponent],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.scss'
})
export class ExpensesPageComponent implements OnInit {
  private readonly service = inject(ExpensesService);
  private readonly employeesService = inject(EmployeesService);
  protected readonly activeEmployees = computed(() =>
    this.employeesService.employees().filter((employee) => employee.active)
  );

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;
  protected readonly employeeFilter = signal('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);

  protected readonly employees = computed(() => {
    const names = new Map<string, string>();
    for (const row of this.service.expenses()) names.set(row.employeeId, row.employeeName);
    return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'el'));
  });

  protected readonly rows = computed(() => {
    const employeeId = this.employeeFilter();
    const from = this.dateFrom() ? new Date(`${this.dateFrom()}T00:00:00`) : null;
    const to = this.dateTo() ? new Date(`${this.dateTo()}T23:59:59.999`) : null;
    return this.service.expenses().filter(
      (row) =>
        (!employeeId || row.employeeId === employeeId) &&
        (!from || row.createdAt >= from) &&
        (!to || row.createdAt <= to)
    );
  });

  protected readonly totals = computed(() => {
    const rows = this.rows();
    const sum = (filter: (method: string) => boolean) =>
      rows.filter((row) => filter(row.paymentMethod)).reduce((acc, row) => acc + row.amount, 0);
    return { total: sum(() => true), cash: sum((m) => m === 'CASH'), card: sum((m) => m === 'CARD') };
  });

  protected readonly perEmployee = computed(() => {
    const totals = new Map<string, { name: string; count: number; total: number }>();
    for (const row of this.rows()) {
      const entry = totals.get(row.employeeId) ?? { name: row.employeeName, count: 0, total: 0 };
      entry.count += 1;
      entry.total += row.amount;
      totals.set(row.employeeId, entry);
    }
    return [...totals.values()].sort((a, b) => b.total - a.total);
  });

  ngOnInit(): void {
    void this.service.load();
  }

  protected refresh(): void {
    void this.service.load();
  }

  protected startEdit(id: string): void {
    this.editingId.set(id);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected async create(
    employeeId: string,
    amount: string,
    method: string,
    description: string,
    form: HTMLFormElement
  ): Promise<void> {
    const value = Number(amount.replace(',', '.'));
    if (!employeeId || !Number.isFinite(value) || value <= 0 || !description.trim()) {
      this.formError.set('Επιλέξτε υπάλληλο και συμπληρώστε έγκυρο ποσό και περιγραφή.');
      return;
    }
    this.formError.set(null);
    const ok = await this.service.create({
      employeeId,
      amount: value,
      paymentMethod: method === 'CARD' ? 'CARD' : 'CASH',
      description: description.trim()
    });
    if (ok) form.reset();
  }

  protected async saveEdit(id: string, amount: string, method: string, description: string): Promise<void> {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0 || !description.trim()) {
      this.formError.set('Συμπληρώστε έγκυρο ποσό και περιγραφή.');
      return;
    }
    this.formError.set(null);
    const ok = await this.service.update(id, {
      amount: value,
      paymentMethod: method === 'CARD' ? 'CARD' : 'CASH',
      description: description.trim()
    });
    if (ok) this.editingId.set(null);
  }

  protected async remove(id: string): Promise<void> {
    if (!confirm('Θέλετε σίγουρα να διαγράψετε αυτό το έξοδο;')) return;
    await this.service.remove(id);
  }

  protected formatDate(value: Date): string {
    return value.toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
