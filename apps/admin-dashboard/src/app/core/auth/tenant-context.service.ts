import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  readonly tenantId = signal<string | null>(null);

  setTenant(tenantId: string): void {
    this.tenantId.set(tenantId);
  }

  clearTenant(): void {
    this.tenantId.set(null);
  }
}
