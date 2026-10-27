// Independent small-cart oracle: enumerate subsets of individual units, not buckets.
function oracle(items, promotions) {
  const units = items.flatMap((item) => Array.from({ length: item.quantity }, () =>
    ({ variant: item.variantTemplateId, cents: Math.round(item.unitPrice * 100) })));
  const memo = new Map();
  const solve = (remaining, once) => {
    const key = `${remaining}/${once}`;
    if (memo.has(key)) return memo.get(key);
    let best = 0;
    promotions.forEach((p, pi) => {
      if (once & (1 << pi)) return;
      for (let subset = remaining; subset; subset = (subset - 1) & remaining) {
        const indices = units.map((_, i) => i).filter((i) => subset & (1 << i));
        if (indices.length !== p.groupSize || indices.some((i) => !p.variantTemplateIds.includes(units[i].variant))) continue;
        if (p.kind !== 'GIFT_VARIANT' && new Set(indices.map((i) => units[i].variant)).size !== 1) continue;
        const nextOnce = p.repeat ? once : once | (1 << pi);
        if (p.kind === 'GIFT_VARIANT') {
          units.forEach((u, gift) => {
            if (u.variant !== p.giftVariantTemplateId || !(remaining & (1 << gift)) || subset & (1 << gift)) return;
            best = Math.max(best, u.cents + solve(remaining ^ subset ^ (1 << gift), nextOnce));
          });
        } else {
          const discount = Math.round(Math.min(...indices.map((i) => units[i].cents)) * p.discountPercent / 100);
          best = Math.max(best, discount + solve(remaining ^ subset, nextOnce));
        }
      }
    });
    memo.set(key, best);
    return best;
  };
  return solve((1 << units.length) - 1, 0);
}
module.exports = oracle;
