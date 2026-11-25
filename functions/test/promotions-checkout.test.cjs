const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
let records, nextId;
const root = 'tenants/store001';
const snapshot = (path) => ({ id: path.split('/').pop(), ref: { path }, exists: records.has(path), data: () => records.get(path) });
const db = {
  doc: (path) => ({ path, id: path.split('/').pop(), get: async () => snapshot(path) }),
  collection: (path) => ({
    doc: (id) => db.doc(`${path}/${id ?? `new-${++nextId}`}`),
    where: (field, op, value) => ({ path, field, value }),
  }),
  runTransaction: async (action) => {
    const writes = [];
    let writing = false;
    const result = await action({
      get: async (ref) => {
        assert.equal(writing, false, 'reads precede writes');
        if (ref.field) return { docs: [...records].filter(([path, value]) =>
          path.startsWith(`${ref.path}/`) && value[ref.field] === ref.value).map(([path]) => snapshot(path)) };
        return snapshot(ref.path);
      },
      set: (ref, data, options) => { writing = true; writes.push(() => records.set(ref.path, options?.merge ? { ...records.get(ref.path), ...data } : data)); },
      delete: (ref) => { writing = true; writes.push(() => records.delete(ref.path)); },
      update: (ref, data) => { writing = true; writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...data })); },
    });
    writes.forEach((write) => write());
    return result;
  },
};
const firestorePath = require.resolve('../lib/common/firestore');
require.cache[firestorePath] = { id: firestorePath, filename: firestorePath, loaded: true, exports: {
  db, serverTimestamp: () => 'now', inventoryDocId: (p, v) => `${p}__${v}`,
} };
const { createOrder } = require('../lib/orders/create-order');
const { cancelOrder } = require('../lib/orders/cancel-order');
const { deletePromotion } = require('../lib/promotions/delete-promotion');
const { savePromotion } = require('../lib/promotions/save-promotion');
const rule = { name: 'Πάρε 3, πλήρωσε 2', variantTemplateIds: ['v'], groupSize: 3,
  discountPercent: 100, repeat: true, active: true, startsAt: null, endsAt: null };
const checkout = (changes = {}) => createOrder.run({ auth: { uid: 'owner' }, data: {
  tenantId: 'store001', employeeId: 'seller', paymentMethod: 'CASH', expectedTotal: 16,
  items: [{ productId: 'p', variantTemplateId: 'v', unitPrice: 8, quantity: 3 }], ...changes,
} });
const save = (changes = {}) => savePromotion.run({ auth: { uid: 'owner' }, data: {
  tenantId: 'store001', ...rule, ...changes,
} });
beforeEach(() => {
  nextId = 0;
  records = new Map([
    ['users/owner', { tenantId: 'store001', role: 'OWNER', active: true }],
    [`${root}/employees/seller`, { name: 'Seller', active: true }],
    [`${root}/employees/canceller`, { name: 'Manager', active: true }],
    [`${root}/products/p`, { active: true, packagingCategory: 'PACKAGED', variantAssignments: { v: { sellingPrice: 8 } } }],
    [`${root}/variantTemplates/v`, { active: true, packagingType: 'PACKAGED', sellingPrice: 8 }],
    [`${root}/inventory/p__v`, { quantity: 10 }],
    [`${root}/promotions/offer`, { tenantId: 'store001', ...rule }],
  ]);
});
test('server calculates discount, stores snapshots and consumes all units; cancellation restores all units once', async () => {
  const result = await checkout();
  const order = records.get(`${root}/orders/${result.orderId}`);
  assert.equal(result.total, 16);
  assert.equal(order.subtotal, 24);
  assert.equal(order.discountTotal, 8);
  assert.equal(order.total, 16);
  assert.equal(order.items[0].unitPrice, 8);
  assert.equal(order.items[0].quantity, 3);
  assert.equal(order.items[0].discountTotal, 8);
  assert.equal(order.items[0].lineTotal, 16);
  assert.equal(order.appliedPromotions[0].name, rule.name);
  assert.equal(records.get(`${root}/inventory/p__v`).quantity, 7);
  records.get(`${root}/promotions/offer`).name = 'Renamed';
  assert.equal(order.appliedPromotions[0].name, rule.name);
  const request = { auth: { uid: 'owner' }, data: { tenantId: 'store001', employeeId: 'canceller', orderId: result.orderId } };
  await cancelOrder.run(request);
  assert.equal(records.get(`${root}/inventory/p__v`).quantity, 10);
  await assert.rejects(cancelOrder.run(request), { code: 'failed-precondition' });
  assert.equal(records.get(`${root}/inventory/p__v`).quantity, 10);
});
test('free items still require sufficient stock', async () => {
  records.get(`${root}/inventory/p__v`).quantity = 2;
  const before = structuredClone([...records]);
  await assert.rejects(checkout(), { code: 'failed-precondition' });
  assert.deepEqual([...records], before);
});
test('rejects manipulated prices, totals, stale promotions and non-integer quantities without writes', async () => {
  const before = structuredClone([...records]);
  await assert.rejects(checkout({ expectedTotal: 0 }), { code: 'failed-precondition' });
  await assert.rejects(checkout({ items: [{ productId: 'p', variantTemplateId: 'v', unitPrice: 0, quantity: 3 }] }), { code: 'failed-precondition' });
  await assert.rejects(checkout({ items: [{ productId: 'p', variantTemplateId: 'v', unitPrice: 8, quantity: 1.5 }] }), { code: 'invalid-argument' });
  await assert.rejects(checkout({ expectedTotal: undefined }), { code: 'failed-precondition' });
  assert.deepEqual([...records], before);
  records.get(`${root}/promotions/offer`).active = false;
  await assert.rejects(checkout(), { code: 'failed-precondition' });
  const result = await checkout({ expectedTotal: 24 });
  assert.equal(records.get(`${root}/orders/${result.orderId}`).total, 24);
});
test('bulk recipe and special bottle stock are deducted/restored for every delivered unit including free one', async () => {
  records.get(`${root}/products/p`).packagingCategory = 'BULK';
  records.set(`${root}/variantTemplates/v`, { active: true, packagingType: 'BULK', sellingPrice: 8,
    perfumeMl: 10, essenceMl: 2, recipeConsumables: [{ consumableId: 'bottle', quantity: 1 }],
    hasSpecialBottle: true, specialBottleConsumableId: 'special', specialBottleExtraPrice: 3 });
  for (const key of ['p__perfume', 'p__essence', 'bottle__consumable', 'special__consumable']) {
    records.set(`${root}/inventory/${key}`, { quantity: 100 });
  }
  const result = await checkout({ expectedTotal: 22,
    items: [{ productId: 'p', variantTemplateId: 'v', unitPrice: 11, quantity: 3, useSpecialBottle: true }] });
  assert.equal(records.get(`${root}/inventory/p__perfume`).quantity, 70);
  assert.equal(records.get(`${root}/inventory/p__essence`).quantity, 94);
  assert.equal(records.get(`${root}/inventory/special__consumable`).quantity, 97);
  assert.equal(records.get(`${root}/inventory/bottle__consumable`).quantity, 100);
  await cancelOrder.run({ auth: { uid: 'owner' }, data: { tenantId: 'store001', employeeId: 'canceller', orderId: result.orderId } });
  for (const key of ['p__perfume', 'p__essence', 'bottle__consumable', 'special__consumable']) {
    assert.equal(records.get(`${root}/inventory/${key}`).quantity, 100);
  }
});
test('can save offers sharing variants and time windows', async () => {
  const overlapping = await save();
  assert(records.has(`${root}/promotions/${overlapping.promotionId}`));
  records.get(`${root}/promotions/offer`).endsAt = '2026-10-23T12:00:00.000Z';
  const result = await save({ startsAt: '2026-10-23T12:00:00.000Z' });
  assert(records.has(`${root}/promotions/${result.promotionId}`));
});
test('can edit/deactivate an offer without deleting its identity', async () => {
  records.get(`${root}/promotions/offer`).createdAt = 'original';
  await save({ promotionId: 'offer', active: false });
  assert.equal(records.get(`${root}/promotions/offer`).active, false);
  assert.equal(records.get(`${root}/promotions/offer`).createdAt, 'original');
});
test('rejects invalid rules, reversed dates, inactive variants and cross-tenant edits', async () => {
  await assert.rejects(save({ groupSize: 2, discountPercent: 100 }), { code: 'invalid-argument' });
  await assert.rejects(save({ startsAt: '2026-10-24', endsAt: '2026-10-23' }), { code: 'invalid-argument' });
  records.get(`${root}/variantTemplates/v`).active = false;
  await assert.rejects(save(), { code: 'failed-precondition' });
  await assert.rejects(save({ tenantId: 'other' }), { code: 'permission-denied' });
});

test('distinct gift consumes stock, records zero line total and is restored on cancellation', async () => {
  records.set(`${root}/variantTemplates/gift`, { active: true, packagingType: 'PACKAGED', sellingPrice: 5 });
  records.get(`${root}/products/p`).variantAssignments.gift = { sellingPrice: 5 };
  records.set(`${root}/inventory/p__gift`, { quantity: 10 });
  await save({ promotionId: 'offer', kind: 'GIFT_VARIANT', groupSize: 2,
    giftVariantTemplateId: 'gift', discountPercent: 100 });
  const result = await checkout({ items: [
    { productId: 'p', variantTemplateId: 'v', quantity: 2, unitPrice: 8 },
    { productId: 'p', variantTemplateId: 'gift', quantity: 1, unitPrice: 5 }
  ] });
  const order = records.get(`${root}/orders/${result.orderId}`);
  assert.equal(order.total, 16);
  assert.equal(order.items[1].lineTotal, 0);
  assert.equal(order.items[1].discountTotal, 5);
  assert.equal(records.get(`${root}/inventory/p__gift`).quantity, 9);
  await cancelOrder.run({ auth: { uid: 'owner' }, data: { tenantId: 'store001', employeeId: 'canceller', orderId: result.orderId } });
  assert.equal(records.get(`${root}/inventory/p__gift`).quantity, 10);
  assert.equal(records.get(`${root}/inventory/p__v`).quantity, 10);
});
test('gift rules require distinct active templates and allow other offers on gift variants', async () => {
  const giftRule = { kind: 'GIFT_VARIANT', groupSize: 2, discountPercent: 100, giftVariantTemplateId: 'gift' };
  await assert.rejects(save({ ...giftRule, giftVariantTemplateId: 'v' }), { code: 'invalid-argument' });
  await assert.rejects(save({ ...giftRule, promotionId: 'offer' }), { code: 'failed-precondition' });
  records.set(`${root}/variantTemplates/gift`, { active: true });
  await save({ ...giftRule, promotionId: 'offer' });
  await save({ variantTemplateIds: ['gift'] });
  await save({ promotionId: 'offer' });
  assert.equal(records.get(`${root}/promotions/offer`).giftVariantTemplateId, null);
});

test('deleting a promotion preserves order snapshots and serializes rule changes', async () => {
  const result = await checkout();
  const history = structuredClone(records.get(`${root}/orders/${result.orderId}`));
  await deletePromotion.run({ auth: { uid: 'owner' }, data: { tenantId: 'store001', promotionId: 'offer' } });
  assert.equal(records.has(`${root}/promotions/offer`), false);
  assert.equal(records.get(`${root}/settings/promotionRules`).revision, 1);
  assert.deepEqual(records.get(`${root}/orders/${result.orderId}`), history);
  assert.equal((await checkout({ expectedTotal: 24 })).total, 24);
});
test('delete rejects missing, malformed and cross-tenant requests without writes', async () => {
  const before = structuredClone([...records]);
  for (const [data, code] of [
    [{ tenantId: 'store001', promotionId: 'missing' }, 'not-found'],
    [{ tenantId: 'store001', promotionId: 'bad/path' }, 'invalid-argument'],
    [{ tenantId: 'other', promotionId: 'offer' }, 'permission-denied']
  ]) {
    await assert.rejects(deletePromotion.run({ auth: { uid: 'owner' }, data }), { code });
  }
  records.get('users/owner').role = 'EMPLOYEE';
  await assert.rejects(deletePromotion.run({ auth: { uid: 'owner' }, data: { tenantId: 'store001', promotionId: 'offer' } }), { code: 'permission-denied' });
  records.get('users/owner').role = 'OWNER';
  assert.deepEqual([...records], before);
});

test('checkout combines gift and standalone offers while consuming and restoring every delivered unit', async () => {
  records.set(`${root}/variantTemplates/gift`, { active: true, packagingType: 'PACKAGED', sellingPrice: 5 });
  records.get(`${root}/products/p`).variantAssignments.gift = { sellingPrice: 5 };
  records.set(`${root}/inventory/p__gift`, { quantity: 10 });
  await save({ promotionId: 'offer', kind: 'GIFT_VARIANT', groupSize: 2,
    giftVariantTemplateId: 'gift', discountPercent: 100 });
  await save({ variantTemplateIds: ['gift'] });
  const result = await checkout({ expectedTotal: 26, items: [
    { productId: 'p', variantTemplateId: 'v', quantity: 2, unitPrice: 8 },
    { productId: 'p', variantTemplateId: 'gift', quantity: 4, unitPrice: 5 }
  ] });
  const order = records.get(`${root}/orders/${result.orderId}`);
  assert.equal(order.discountTotal, 10);
  assert.equal(order.appliedPromotions.length, 2);
  assert.equal(records.get(`${root}/inventory/p__gift`).quantity, 6);
  await cancelOrder.run({ auth: { uid: 'owner' }, data: { tenantId: 'store001', employeeId: 'canceller', orderId: result.orderId } });
  assert.equal(records.get(`${root}/inventory/p__gift`).quantity, 10);
  assert.equal(records.get(`${root}/inventory/p__v`).quantity, 10);
});

test('same variant qualifies across different products, prices and inventory documents', async () => {
  records.get(`${root}/promotions/offer`).groupSize = 2;
  records.get(`${root}/promotions/offer`).discountPercent = 50;
  records.set(`${root}/products/second`, { active: true, packagingCategory: 'PACKAGED', variantAssignments: { v: { sellingPrice: 12 } } });
  records.set(`${root}/inventory/second__v`, { quantity: 10 });
  const result = await checkout({ items: [
    { productId: 'p', variantTemplateId: 'v', quantity: 1, unitPrice: 8 },
    { productId: 'second', variantTemplateId: 'v', quantity: 1, unitPrice: 12 }
  ] });
  assert.equal(result.total, 16);
  assert.equal(records.get(`${root}/orders/${result.orderId}`).items[0].discountTotal, 4);
  assert.equal(records.get(`${root}/inventory/p__v`).quantity, 9);
  assert.equal(records.get(`${root}/inventory/second__v`).quantity, 9);
});
