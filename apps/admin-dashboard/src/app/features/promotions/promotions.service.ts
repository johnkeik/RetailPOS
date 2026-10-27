import { Injectable, inject, signal } from '@angular/core';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FIRESTORE, FIREBASE_FUNCTIONS } from '../../core/firebase/firebase.providers';
import { TenantContextService } from '../../core/auth/tenant-context.service';

export type PromotionInput = {
  name: string;
  variantTemplateIds: string[];
  groupSize: number;
  kind?: 'CHEAPEST' | 'GIFT_VARIANT';
  giftVariantTemplateId?: string | null;
  discountPercent: 50 | 100;
  repeat: boolean;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};
export type PromotionRow = PromotionInput & { id: string };

@Injectable({ providedIn: 'root' })
export class PromotionsService {
  private readonly firestore = inject(FIREBASE_FIRESTORE);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly tenant = inject(TenantContextService);
  readonly promotions = signal<PromotionRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    const tenantId = this.tenant.tenantId();
    if (!tenantId) { this.error.set('Δεν έχει επιλεγεί κατάστημα.'); return; }
    this.loading.set(true);
    this.error.set(null);
    try {
      const snapshot = await getDocs(query(collection(this.firestore, `tenants/${tenantId}/promotions`), orderBy('name')));
      this.promotions.set(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as PromotionRow)));
    } catch {
      this.error.set('Αποτυχία φόρτωσης προσφορών.');
    } finally { this.loading.set(false); }
  }

  async delete(promotionId: string): Promise<boolean> {
    const tenantId = this.tenant.tenantId();
    if (!tenantId) { this.error.set('Δεν έχει επιλεγεί κατάστημα.'); return false; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'deletePromotion')({ tenantId, promotionId });
      await this.load();
      return !this.error();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Αποτυχία διαγραφής προσφοράς.');
      return false;
    }
  }

  async save(input: PromotionInput, promotionId?: string): Promise<boolean> {
    const tenantId = this.tenant.tenantId();
    if (!tenantId) { this.error.set('Δεν έχει επιλεγεί κατάστημα.'); return false; }
    this.error.set(null);
    try {
      await httpsCallable(this.functions, 'savePromotion')({ tenantId, ...input, ...(promotionId ? { promotionId } : {}) });
      await this.load();
      return !this.error();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Αποτυχία αποθήκευσης προσφοράς.');
      return false;
    }
  }
}
