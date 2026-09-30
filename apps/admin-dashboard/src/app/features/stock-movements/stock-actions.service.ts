import { Injectable, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';

@Injectable({ providedIn: 'root' })
export class StockActionsService {
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  async receiveStock(input: {
    productId: string;
    variantTemplateId: string;
    quantity: number;
    reason?: string;
  }): Promise<void> {
    const tenantId = this.requireTenant();
    const callable = httpsCallable(this.functions, 'receiveStock');
    await callable({
      tenantId,
      productId: input.productId,
      variantTemplateId: input.variantTemplateId,
      quantity: input.quantity,
      reason: input.reason
    });
  }

  async adjustStock(input: {
    productId: string;
    variantTemplateId: string;
    quantityDelta: number;
    reason?: string;
  }): Promise<void> {
    const tenantId = this.requireTenant();
    const callable = httpsCallable(this.functions, 'adjustStock');
    await callable({
      tenantId,
      productId: input.productId,
      variantTemplateId: input.variantTemplateId,
      quantityDelta: input.quantityDelta,
      reason: input.reason
    });
  }

  private requireTenant(): string {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      throw new Error('Missing tenant context.');
    }

    return tenantId;
  }
}
