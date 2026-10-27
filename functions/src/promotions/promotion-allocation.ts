import { PricedItem, Promotion } from "./promotion-pricing";

type Bucket = { variant: string; cents: number; quantity: number; lines: number[] };
type Move = { promotion: number; used: number[]; discounted: number; discount: number };
type Plan = { score: number; move?: Move; next?: Plan };

// Equal-price units of the same variant are interchangeable. Memoize quantities,
// rather than individual units, and solve independent offer components separately.
export function allocatePromotions(items: PricedItem[], promotions: Promotion[]) {
  const buckets: Bucket[] = [];
  items.forEach((item, line) => {
    const cents = Math.round(item.unitPrice * 100);
    let bucket = buckets.find((value) => value.variant === item.variantTemplateId && value.cents === cents);
    if (!bucket) {
      bucket = { variant: item.variantTemplateId, cents, quantity: 0, lines: [] };
      buckets.push(bucket);
    }
    bucket.quantity += item.quantity;
    for (let i = 0; i < item.quantity; i++) bucket.lines.push(line);
  });
  const eligible = promotions.map((p) => buckets.map((b, i) => p.variantTemplateIds.includes(b.variant) ? i : -1)
    .filter((i) => i >= 0));
  const gifts = promotions.map((p) => buckets.map((b, i) =>
    p.kind === "GIFT_VARIANT" && b.variant === p.giftVariantTemplateId ? i : -1).filter((i) => i >= 0));
  const involved = promotions.map((_, i) => [...eligible[i], ...gifts[i]]);
  const remaining = buckets.map((b) => b.quantity);
  const moves: Move[] = [];
  const seen = new Set<number>();
  for (let start = 0; start < promotions.length; start++) {
    if (seen.has(start)) continue;
    const component = [start];
    seen.add(start);
    for (let at = 0; at < component.length; at++) {
      const current = component[at];
      for (let other = 0; other < promotions.length; other++) {
        if (!seen.has(other) && involved[current].some((i) => involved[other].includes(i))) {
          seen.add(other);
          component.push(other);
        }
      }
    }
    component.sort((a, b) => a - b);
    if (component.length === 1) {
      const p = promotions[start];
      const units = eligible[start].flatMap((i) => Array<number>(remaining[i]).fill(i))
        .sort((a, b) => buckets[b].cents - buckets[a].cents || a - b);
      const giftUnits = gifts[start].flatMap((i) => Array<number>(remaining[i]).fill(i))
        .sort((a, b) => buckets[b].cents - buckets[a].cents || a - b);
      const isGift = p.kind === "GIFT_VARIANT";
      const unitGroups = isGift ? [units] : [...new Set(units.map((i) => buckets[i].variant))]
        .map((variant) => units.filter((i) => buckets[i].variant === variant));
      const candidates: Move[] = [];
      for (const groupUnits of unitGroups) {
        const count = Math.min(Math.floor(groupUnits.length / p.groupSize),
          isGift ? giftUnits.length : Infinity);
        for (let group = 0; group < count; group++) {
          const used = remaining.map(() => 0);
          for (const i of groupUnits.slice(group * p.groupSize, (group + 1) * p.groupSize)) used[i]++;
          const discounted = isGift ? giftUnits[group] : groupUnits[(group + 1) * p.groupSize - 1];
          if (isGift) used[discounted]++;
          const discount = Math.round(buckets[discounted].cents * (isGift ? 100 : p.discountPercent) / 100);
          if (discount > 0) candidates.push({ promotion: start, used, discounted, discount });
        }
      }
      // A non-repeating rule applies once across all its selected variants.
      const selected = p.repeat || !candidates.length ? candidates :
        [candidates.reduce((best, move) => move.discount > best.discount ? move : best)];
      for (const move of selected) {
        moves.push(move);
        move.used.forEach((q, i) => {
          remaining[i] -= q;
        });
      }
      continue;
    }
    const indices = [...new Set(component.flatMap((i) => involved[i]))].sort((a, b) => a - b);
    const memo = new Map<string, Plan>();
    const solve = (counts: number[], once: boolean[]): Plan => {
      const key = indices.map((i) => counts[i]).join(",") + "/" + once.map((v) => v ? "1" : "0").join("");
      const cached = memo.get(key);
      if (cached) return cached;
      let best: Plan = { score: 0 };
      component.forEach((pi, local) => {
        const p = promotions[pi];
        if (once[local]) return;
        const choices = eligible[pi].filter((i) => counts[i] > 0);
        if (choices.reduce((sum, i) => sum + counts[i], 0) < p.groupSize) return;
        const giftChoices = gifts[pi].filter((i) => counts[i] > 0);
        if (p.kind === "GIFT_VARIANT" && !giftChoices.length) return;
        const used = counts.map(() => 0);
        const visit = (at: number, needed: number) => {
          if (needed === 0) {
            if (p.kind !== "GIFT_VARIANT" &&
                new Set(choices.filter((i) => used[i] > 0).map((i) => buckets[i].variant)).size > 1) return;
            const cheapest = choices.filter((i) => used[i] > 0)
              .sort((a, b) => buckets[a].cents - buckets[b].cents || a - b)[0];
            const targets = p.kind === "GIFT_VARIANT" ? giftChoices : [cheapest];
            for (const discounted of targets) {
              const discount = Math.round(buckets[discounted].cents *
                (p.kind === "GIFT_VARIANT" ? 100 : p.discountPercent) / 100);
              if (discount <= 0) continue;
              if (p.kind === "GIFT_VARIANT") used[discounted]++;
              const nextCounts = counts.map((q, i) => q - used[i]);
              const nextOnce = [...once];
              if (!p.repeat) nextOnce[local] = true;
              const next = solve(nextCounts, nextOnce);
              if (discount + next.score > best.score) {
                best = { score: discount + next.score,
                  move: { promotion: pi, used: [...used], discounted, discount }, next };
              }
              if (p.kind === "GIFT_VARIANT") used[discounted]--;
            }
            return;
          }
          if (at >= choices.length || choices.slice(at).reduce((sum, i) => sum + counts[i], 0) < needed) return;
          const i = choices[at];
          for (let q = Math.min(counts[i], needed); q >= 0; q--) {
            used[i] = q;
            visit(at + 1, needed - q);
          }
          used[i] = 0;
        };
        visit(0, p.groupSize);
      });
      memo.set(key, best);
      return best;
    };
    let plan: Plan | undefined = solve([...remaining], component.map(() => false));
    while (plan?.move) {
      moves.push(plan.move);
      plan.move.used.forEach((q, i) => {
        remaining[i] -= q;
      });
      plan = plan.next;
    }
  }
  const lineDiscounts = items.map(() => 0);
  const offsets = buckets.map(() => 0);
  const totals = promotions.map(() => ({ cents: 0, quantity: 0 }));
  for (const move of moves) {
    const b = move.discounted;
    lineDiscounts[buckets[b].lines[offsets[b]]] += move.discount;
    move.used.forEach((q, i) => {
      offsets[i] += q;
    });
    totals[move.promotion].cents += move.discount;
    totals[move.promotion].quantity++;
  }
  const pendingGifts: Array<{ variantTemplateId: string; quantity: number }> = [];
  promotions.forEach((p, i) => {
    if (p.kind !== "GIFT_VARIANT" || !p.giftVariantTemplateId || (!p.repeat && totals[i].quantity)) return;
    const available = eligible[i].reduce((sum, b) => sum + remaining[b], 0);
    const quantity = Math.min(Math.floor(available / p.groupSize), p.repeat ? Infinity : 1);
    if (quantity > 0) pendingGifts.push({ variantTemplateId: p.giftVariantTemplateId, quantity });
  });
  return { lineDiscounts, totals, pendingGifts };
}
