import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DrawerComponent } from '../../shared/ui/drawer.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EmployeesService } from '../employees/employees.service';
import { ExpensesService } from './expenses.service';

function toInputDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfMonthInput(date: Date): string {
  return toInputDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

@Component({
  selector: 'app-expenses-page',
  imports: [ReactiveFormsModule, EntityActionsComponent, PageTitleComponent, DrawerComponent],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.scss'
})
export class ExpensesPageComponent implements OnInit {
  private readonly service = inject(ExpensesService);
  private readonly employeesService = inject(EmployeesService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly activeEmployees = computed(() =>
    this.employeesService.employees().filter((employee) => employee.active)
  );

  protected readonly loading = this.service.loading;
  protected readonly error = this.service.error;
  protected readonly employeeFilter = signal('');
  // Default to the current month so far; older periods are fetched only on request.
  protected readonly dateFrom = signal(startOfMonthInput(new Date()));
  protected readonly dateTo = signal(toInputDate(new Date()));
  protected readonly showVoided = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly saving = signal(false);

  protected readonly expenseForm = this.formBuilder.nonNullable.group({
    employeeId: ['', Validators.required],
    amount: ['', Validators.required],
    paymentMethod: ['CASH' as 'CASH' | 'CARD'],
    description: ['', [Validators.required, Validators.maxLength(300)]]
  });

  protected readonly editingExpense = computed(() =>
    this.service.expenses().find((row) => row.id === this.editingId()) ?? null
  );

  protected readonly employees = computed(() => {
    const names = new Map<string, string>();
    for (const row of this.service.expenses()) names.set(row.employeeId, row.employeeName);
    return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'el'));
  });

  /** Rows matching the filters, including voided ones. */
  private readonly filteredRows = computed(() => {
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

  /** Voided expenses never count towards totals. */
  private readonly activeRows = computed(() => this.filteredRows().filter((row) => !row.voided));

  protected readonly voidedCount = computed(() => this.filteredRows().filter((row) => row.voided).length);

  protected readonly rows = computed(() => (this.showVoided() ? this.filteredRows() : this.activeRows()));

  protected readonly totals = computed(() => {
    const rows = this.activeRows();
    const sum = (filter: (method: string) => boolean) =>
      rows.filter((row) => filter(row.paymentMethod)).reduce((acc, row) => acc + row.amount, 0);
    return { total: sum(() => true), cash: sum((m) => m === 'CASH'), card: sum((m) => m === 'CARD') };
  });

  protected readonly perEmployee = computed(() => {
    const totals = new Map<string, { name: string; count: number; total: number }>();
    for (const row of this.activeRows()) {
      const entry = totals.get(row.employeeId) ?? { name: row.employeeName, count: 0, total: 0 };
      entry.count += 1;
      entry.total += row.amount;
      totals.set(row.employeeId, entry);
    }
    return [...totals.values()].sort((a, b) => b.total - a.total);
  });

  ngOnInit(): void {
    this.reload();
  }

  protected refresh(): void {
    this.reload();
  }

  protected onDateFromChange(value: string): void {
    this.dateFrom.set(value);
    this.reload();
  }

  protected onDateToChange(value: string): void {
    this.dateTo.set(value);
    this.reload();
  }

  /**
   * Fetch only the selected days from Firestore (local time, `to` inclusive).
   * Never unbounded: a cleared "from" falls back to the start of the "to" month (or the current month).
   */
  private reload(): void {
    if (!this.dateFrom()) {
      const anchor = this.dateTo() ? new Date(`${this.dateTo()}T00:00:00`) : new Date();
      this.dateFrom.set(startOfMonthInput(anchor));
    }
    const from = new Date(`${this.dateFrom()}T00:00:00`);
    let to: Date | null = null;
    if (this.dateTo()) {
      to = new Date(`${this.dateTo()}T00:00:00`);
      to.setDate(to.getDate() + 1);
    }
    void this.service.load({ from, to });
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.formError.set(null);
    this.expenseForm.reset({ employeeId: '', amount: '', paymentMethod: 'CASH', description: '' });
    this.expenseForm.controls.employeeId.enable();
    this.drawerOpen.set(true);
  }

  protected startEdit(id: string): void {
    const row = this.service.expenses().find((expense) => expense.id === id);
    if (!row) return;
    this.editingId.set(id);
    this.formError.set(null);
    this.expenseForm.reset({
      employeeId: row.employeeId,
      amount: String(row.amount).replace('.', ','),
      paymentMethod: row.paymentMethod === 'CARD' ? 'CARD' : 'CASH',
      description: row.description
    });
    // The employee who recorded an expense cannot be changed afterwards.
    this.expenseForm.controls.employeeId.disable();
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.editingId.set(null);
    this.formError.set(null);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    const form = this.expenseForm.getRawValue();
    const amount = Number(form.amount.replace(',', '.'));
    const editingId = this.editingId();
    if ((!editingId && !form.employeeId) || !Number.isFinite(amount) || amount <= 0 || !form.description.trim()) {
      this.expenseForm.markAllAsTouched();
      this.formError.set(editingId
        ? 'Συμπληρώστε έγκυρο ποσό και περιγραφή.'
        : 'Επιλέξτε υπάλληλο και συμπληρώστε έγκυρο ποσό και περιγραφή.');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    try {
      const input = { amount, paymentMethod: form.paymentMethod, description: form.description.trim() };
      const ok = editingId
        ? await this.service.update(editingId, input)
        : await this.service.create({ employeeId: form.employeeId, ...input });
      if (ok) this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(id: string): Promise<void> {
    if (!confirm('Θέλετε σίγουρα να ακυρώσετε αυτό το έξοδο; Θα παραμείνει στο ιστορικό ως ακυρωμένο.')) return;
    await this.service.remove(id);
  }

  protected changeNote(by: string | null, at: Date | null): string {
    return [by, at ? this.formatDate(at) : null].filter(Boolean).join(', ');
  }

  protected formatDate(value: Date): string {
    return value.toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
