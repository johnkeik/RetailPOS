import { Injectable, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';

import { TenantContextService } from '../../core/auth/tenant-context.service';
import { FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';

export type StockMovementLinePayload = {
  productId: string;
  variantTemplateId: string;
  quantity: number;
};

@Injectable({ providedIn: 'root' })
export class StockActionsService {
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenantContext = inject(TenantContextService);

  async recordMovements(input: {
    type: 'PURCHASE' | 'ADJUSTMENT' | 'LOSS';
    reason?: string;
    lines: StockMovementLinePayload[];
  }): Promise<void> {
    const tenantId = this.requireTenant();
    await httpsCallable(this.functions, 'recordStockMovements')({ tenantId, ...input });
  }

  private requireTenant(): string {
    const tenantId = this.tenantContext.tenantId();
    if (!tenantId) {
      throw new Error('Missing tenant context.');
    }

    return tenantId;
  }
}
