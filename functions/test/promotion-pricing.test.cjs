const { test } = require('node:test');
const assert = require('node:assert/strict');
const cases = require('../../test-fixtures/promotions.json');
const { calculatePromotions } = require('../lib/promotions/promotion-pricing');
for (const fixture of cases) {
  test(`promotion parity: ${fixture.name}`, () => {
    const result = calculatePromotions(fixture.items, fixture.promotions, Date.parse(fixture.now));
    assert.equal(result.total, fixture.expected.total);
    assert.equal(result.discountTotal, fixture.expected.discountTotal);
    assert.deepEqual(result.lineDiscounts, fixture.expected.lineDiscounts);
    assert.equal(Math.round(result.subtotal * 100) - Math.round(result.discountTotal * 100), Math.round(result.total * 100));
  });
}
test('combines disjoint offers without using a unit twice', () => {
  const promotion = cases[0].promotions[0];
  const result = calculatePromotions([
    { variantTemplateId: 'v1', unitPrice: 12, quantity: 1 },
    { variantTemplateId: 'v1', unitPrice: 8, quantity: 1 },
    { variantTemplateId: 'v4', unitPrice: 5, quantity: 3 },
  ], [promotion, { ...promotion, id: 'offer-2', variantTemplateIds: ['v4'], groupSize: 3, discountPercent: 100 }]);
  assert.equal(result.total, 26);
  assert.equal(result.appliedPromotions.length, 2);
});
test('accepts overlapping active promotions without double-discounting units', () => {
  const promotion = cases[0].promotions[0];
  const result = calculatePromotions(cases[0].items, [promotion, { ...promotion, id: 'other' }]);
  assert.equal(result.discountTotal, cases[0].expected.discountTotal);
});
test('optimizer matches independent exhaustive unit-subset oracle on varied small carts', () => {
  const oracle = require('./promotion-oracle.cjs');
  let seed = 1837;
  const random = (max) => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % max; };
  for (let sample = 0; sample < 80; sample++) {
    const items = Array.from({ length: 3 }, (_, i) => ({ variantTemplateId: `v${i}`,
      quantity: random(3), unitPrice: (random(1300) + 1) / 100 }));
    const rule = { name: 'Offer', active: true, repeat: true, variantTemplateIds: ['v0', 'v1'], groupSize: 2, discountPercent: 50 };
    const offers = [
      { ...rule, id: 'a', repeat: random(2) === 1 },
      { ...rule, id: 'b', variantTemplateIds: ['v1', 'v2'], groupSize: 3, discountPercent: 100 },
      { ...rule, id: 'c', kind: 'GIFT_VARIANT', variantTemplateIds: ['v0'], giftVariantTemplateId: 'v2', discountPercent: 100 }
    ];
    const result = calculatePromotions(items, offers);
    assert.equal(Math.round(result.discountTotal * 100), oracle(items, offers), JSON.stringify({ items, offers }));
  }
});
