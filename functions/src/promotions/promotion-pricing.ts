import { allocatePromotions } from "./promotion-allocation";

export type Promotion = {
  id: string;
  name: string;
  variantTemplateIds: string[];
  groupSize: number;
  kind?: "CHEAPEST" | "GIFT_VARIANT";
  giftVariantTemplateId?: string | null;
  discountPercent: 50 | 100;
  repeat: boolean;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type PricedItem = { variantTemplateId: string; quantity: number; unitPrice: number };
export type AppliedPromotion = {
  promotionId: string;
  name: string;
  discountedQuantity: number;
  discountTotal: number;
};

export function isPromotionActive(promotion: Promotion, now: number): boolean {
  return promotion.active &&
    (!promotion.startsAt || Date.parse(promotion.startsAt) <= now) &&
    (!promotion.endsAt || now < Date.parse(promotion.endsAt));
}

// Apply the largest total discount without reusing a purchased or gifted unit.
export function calculatePromotions(items: PricedItem[], promotions: Promotion[], now = Date.now()) {
  const active = promotions.filter((p) => isPromotionActive(p, now))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const allocation = allocatePromotions(items, active);
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0);
  const discountCents = allocation.lineDiscounts.reduce((sum, value) => sum + value, 0);
  const appliedPromotions: AppliedPromotion[] = [];
  active.forEach((p, i) => {
    const result = allocation.totals[i];
    if (result.quantity) {
      appliedPromotions.push({ promotionId: p.id, name: p.name,
        discountedQuantity: result.quantity, discountTotal: result.cents / 100 });
    }
  });
  return {
    subtotal: subtotalCents / 100, discountTotal: discountCents / 100,
    total: (subtotalCents - discountCents) / 100,
    lineDiscounts: allocation.lineDiscounts.map((value) => value / 100), appliedPromotions,
    pendingGifts: allocation.pendingGifts
  };
}
