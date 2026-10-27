import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/auth/tenant-context.service';
import { PageTitleComponent } from '../../shared/ui/page-title.component';
import { StockEntryComponent } from './stock-entry.component';

@Component({
  selector: 'app-employee-receiving-page',
  imports: [PageTitleComponent, StockEntryComponent],
  template: `
    <header class="employee-header">
      <div>
        <app-page-title title="Παραλαβή αποθέματος" subtitle="Καταχώριση νέων ειδών στο απόθεμα." />
        <p>{{ auth.currentUser()?.email }}</p>
      </div>
      <button type="button" class="sign-out" (click)="signOut()">Αποσύνδεση</button>
    </header>
    <app-stock-entry [receiveOnly]="true" />
  `,
  styles: [`
    :host { display: block; max-width: 1200px; margin: 0 auto; padding: 24px; }
    .employee-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
    .employee-header p { margin: 0 0 16px; color: #64748b; font-size: 0.9rem; }
    .sign-out { min-height: 44px; padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #334155; font: inherit; cursor: pointer; }
    @media (max-width: 640px) {
      :host { padding: 16px 12px; }
      .employee-header { align-items: flex-start; flex-direction: column; }
    }
  `]
})
export class EmployeeReceivingPageComponent {
  protected readonly auth = inject(AuthService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);

  constructor() {
    const tenantId = this.auth.currentUser()?.tenantId;
    if (tenantId) this.tenantContext.setTenant(tenantId);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }
}