import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

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

  protected readonly searchQuery = signal('');
  protected readonly editingEmployeeId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly managerPin = signal('');
  protected readonly managerPinConfirmation = signal('');
  protected readonly savingManagerPin = signal(false);
  protected readonly managerPinStatus = signal<string | null>(null);
  protected readonly managerPinError = signal<string | null>(null);

  protected readonly loading = this.employeesService.loading;
  protected readonly error = this.employeesService.error;

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
    active: [true]
  });

  protected onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  protected async saveEmployee(): Promise<void> {
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

    this.formError.set(null);
    const activeId = this.editingEmployeeId();

    try {
      if (activeId) {
        await this.employeesService.updateEmployee(activeId, input);
      } else {
        await this.employeesService.createEmployee(input);
      }
      this.resetForm();
    } catch (error) {
      console.error(error);
      this.formError.set('Ο κωδικος υπαλληλου χρησιμοποιειται ηδη.');
    }
  }

  protected startEdit(employee: EmployeeRow): void {
    this.editingEmployeeId.set(employee.id);
    this.formError.set(null);
    this.employeeForm.setValue({
      name: employee.name,
      employeeCode: employee.employeeCode,
      active: employee.active
    });
  }

  protected async toggleActive(employee: EmployeeRow): Promise<void> {
    await this.employeesService.toggleEmployeeActive(employee.id, !employee.active);
  }

  protected async deleteEmployee(employee: EmployeeRow): Promise<void> {
    const confirmed = window.confirm(`Είστε βέβαιοι ότι θέλετε να διαγράψετε οριστικά τον υπάλληλο "${employee.name}" (${employee.employeeCode});`);
    if (!confirmed) return;
    const ok = await this.employeesService.deleteEmployee(employee.id);
    if (ok && this.editingEmployeeId() === employee.id) {
      this.resetForm();
    }
  }

  protected async saveManagerPin(): Promise<void> {
    const pin = this.managerPin();
    if (!/^\d{6}$/.test(pin)) {
      this.managerPinError.set('Ο κωδικός πρέπει να αποτελείται από 6 ψηφία.');
      return;
    }
    if (pin !== this.managerPinConfirmation()) {
      this.managerPinError.set('Οι δύο κωδικοί δεν ταιριάζουν.');
      return;
    }

    this.savingManagerPin.set(true);
    this.managerPinError.set(null);
    this.managerPinStatus.set(null);
    try {
      await this.employeesService.setManagerPin(pin);
      this.managerPin.set('');
      this.managerPinConfirmation.set('');
      this.managerPinStatus.set('Ο κωδικός έγκρισης ακυρώσεων αποθηκεύτηκε.');
    } catch (error) {
      console.error(error);
      this.managerPinError.set('Δεν ήταν δυνατή η αποθήκευση. Βεβαιωθείτε ότι έχετε δικαιώματα διαχειριστή.');
    } finally {
      this.savingManagerPin.set(false);
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
      active: true
    });
  }
}
