import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth/auth.service';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { EntityActionsComponent } from '../../shared/ui/entity-actions.component';
import { EmployeeRow, EmployeesService } from './employees.service';

@Component({
  selector: 'app-employees-page',
  imports: [ReactiveFormsModule, PageTitleComponent, EntityActionsComponent],
  templateUrl: './employees-page.component.html',
  styleUrl: './employees-page.component.scss'
})
export class EmployeesPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly employeesService = inject(EmployeesService);
  private readonly authService = inject(AuthService);

  protected readonly searchQuery = signal('');
  protected readonly editingEmployeeId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly accountMessage = signal<string | null>(null);
  protected readonly savingEmployee = signal(false);
  protected readonly loading = this.employeesService.loading;
  protected readonly error = this.employeesService.error;
  protected readonly editingEmployee = computed(() =>
    this.employeesService.employees().find((employee) => employee.id === this.editingEmployeeId()) ?? null
  );

  protected readonly filteredEmployees = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const rows = this.employeesService.employees();

    if (!query) {
      return rows;
    }

    return rows.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.employeeCode.toLowerCase().includes(query)
    );
  });

  protected readonly employeeForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    employeeCode: ['', [Validators.required, Validators.maxLength(20)]],
    dashboardEmail: ['', [Validators.email]],
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected async saveEmployee(): Promise<void> {
    if (this.savingEmployee()) return;
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    const form = this.employeeForm.getRawValue();
    const input = {
      name: form.name.trim(),
      employeeCode: form.employeeCode.trim(),
      active: form.active
    };

    if (form.dashboardEmail.trim() && !form.active) {
      this.formError.set('Ενεργοποιήστε τον υπάλληλο πριν δημιουργήσετε πρόσβαση dashboard.');
      return;
    }

    this.formError.set(null);
    this.accountMessage.set(null);
    this.savingEmployee.set(true);
    let employeeId = this.editingEmployeeId();
    const currentEmployee = this.editingEmployee();
    const email = form.dashboardEmail.trim();

    try {
      if (employeeId) {
        await this.employeesService.updateEmployee(employeeId, input);
      } else {
        employeeId = await this.employeesService.createEmployee(input);
      }

      if (employeeId && email && !currentEmployee?.dashboardEmail) {
        try {
          await this.employeesService.createEmployeeAccount(employeeId, email);
        } catch (error) {
          console.error(error);
          this.resetForm();
          this.accountMessage.set('Ο υπάλληλος αποθηκεύτηκε, αλλά δεν δημιουργήθηκε πρόσβαση. Επεξεργαστείτε τον υπάλληλο για νέα προσπάθεια.');
          return;
        }

        try {
          await this.authService.sendEmployeeSetupEmail(email);
          this.accountMessage.set(`Δημιουργήθηκε η πρόσβαση και στάλθηκε email ορισμού κωδικού στο ${email}.`);
        } catch (error) {
          console.error(error);
          this.accountMessage.set('Η πρόσβαση δημιουργήθηκε, αλλά δεν στάλθηκε email. Μπορείτε να το ξαναστείλετε από τη λίστα.');
        }
      }
      this.resetForm();
    } catch (error) {
      console.error(error);
      const code = (error as { code?: string })?.code;
      this.formError.set(code === 'functions/already-exists'
        ? 'Ο κωδικός υπαλλήλου ή το email χρησιμοποιείται ήδη.'
        : 'Αποτυχία αποθήκευσης υπαλλήλου.');
    } finally {
      this.savingEmployee.set(false);
    }
  }

  protected startEdit(employee: EmployeeRow): void {
    this.editingEmployeeId.set(employee.id);
    this.formError.set(null);
    this.accountMessage.set(null);
    this.employeeForm.setValue({
      name: employee.name,
      employeeCode: employee.employeeCode,
      dashboardEmail: employee.dashboardEmail ?? '',
      active: employee.active
    });
  }

  protected async toggleActive(employee: EmployeeRow): Promise<void> {
    await this.employeesService.toggleEmployeeActive(employee.id, !employee.active);
  }

  protected async sendSetupEmail(employee: EmployeeRow): Promise<void> {
    if (!employee.dashboardEmail || !employee.active) return;
    this.accountMessage.set(null);
    try {
      await this.authService.sendEmployeeSetupEmail(employee.dashboardEmail);
      this.accountMessage.set(`Στάλθηκε email ορισμού κωδικού στο ${employee.dashboardEmail}.`);
    } catch (error) {
      console.error(error);
      this.accountMessage.set('Αποτυχία αποστολής email. Ελέγξτε τις ρυθμίσεις email του Firebase Authentication.');
    }
  }

  protected sendCurrentSetupEmail(): void {
    const employee = this.editingEmployee();
    if (employee) void this.sendSetupEmail(employee);
  }

  protected async deleteEmployee(employee: EmployeeRow): Promise<void> {
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά τον υπάλληλο "${employee.name}" (${employee.employeeCode});`);
    if (!confirmed) return;
    const ok = await this.employeesService.deleteEmployee(employee.id);
    if (ok && this.editingEmployeeId() === employee.id) {
      this.resetForm();
    }
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected isEditing(employee: EmployeeRow): boolean {
    return this.editingEmployeeId() === employee.id;
  }

  private resetForm(): void {
    this.editingEmployeeId.set(null);
    this.formError.set(null);
    this.employeeForm.reset({
      name: '',
      employeeCode: '',
      dashboardEmail: '',
      active: true
    });
  }
}
