const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { FieldPath } = require('firebase-admin/firestore');
let records, commits;
const prefix = 'tenants/store001';
const variantId = 'variant.with.dots';
const templatePath = `${prefix}/variantTemplates/${variantId}`;
const productPath = (id) => `${prefix}/products/${id}`;
const snapshot = (path) => ({ exists: records.has(path), ref: { path }, data: () => records.get(path) });
const db = {
  doc: (path) => ({ path, get: async () => snapshot(path) }),
  getAll: async (...refs) => refs.map((ref) => snapshot(ref.path)),
  batch: () => {
    const writes = [];
    return {
      update: (ref, update, ...values) => writes.push(() => {
        const product = records.get(ref.path);
        if (update instanceof FieldPath) {
          assert(update.isEqual(new FieldPath('variantAssignments', variantId, 'sellingPrice')));
          product.variantAssignments[variantId].sellingPrice = values[0];
          assert.equal(values[1], 'updatedAt');
          product.updatedAt = values[2];
        } else records.set(ref.path, { ...product, ...update });
      }),
      commit: async () => { commits++; writes.forEach((write) => write()); },
    };
  },
};
const modulePath = require.resolve('../lib/common/firestore');
require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true,
  exports: { db, serverTimestamp: () => 'updated-time' } };
const { assignVariantToProducts } = require('../lib/products/assign-variant-to-products');
const apply = (operation, productIds = ['existing', 'new', 'same', 'incompatible', 'missing']) =>
  assignVariantToProducts.run({ auth: { uid: 'owner' }, data: {
    tenantId: 'store001', variantTemplateId: variantId, productIds,
    ...(operation ? { operation } : {}),
  } });
beforeEach(() => {
  commits = 0;
  records = new Map([
    ['users/owner', { tenantId: 'store001', role: 'OWNER', active: true }],
    [templatePath, { active: true, packagingType: 'BULK', sellingPrice: 12 }],
    [productPath('existing'), { packagingCategory: 'BULK',
      variantAssignments: { [variantId]: { sellingPrice: 8, costPrice: 3 }, other: { sellingPrice: 20 } },
      variantOrder: ['other', variantId] }],
    [productPath('new'), { packagingCategory: 'BULK', variantAssignments: {}, variantOrder: [] }],
    [productPath('same'), { packagingCategory: 'BULK', variantAssignments: { [variantId]: { sellingPrice: 12 } } }],
    [productPath('incompatible'), { packagingCategory: 'PACKAGED', variantAssignments: { [variantId]: { sellingPrice: 9 } } }],
  ]);
});
test('updates existing prices only; preserves costs, other variants and ordering', async () => {
  const result = await apply('UPDATE_PRICE');
  for (const key of ['updatedCount', 'unchangedCount', 'unassignedCount', 'incompatibleCount', 'missingCount']) {
    assert.equal(result[key], 1, key);
  }
  assert.equal(result.assignedCount, 0);
  assert.deepEqual(records.get(productPath('existing')), {
    packagingCategory: 'BULK',
    variantAssignments: { [variantId]: { sellingPrice: 12, costPrice: 3 }, other: { sellingPrice: 20 } },
    variantOrder: ['other', variantId], updatedAt: 'updated-time',
  });
  assert.deepEqual(records.get(productPath('new')).variantAssignments, {});
  assert.equal(records.get(productPath('incompatible')).variantAssignments[variantId].sellingPrice, 9);
  assert.equal(commits, 1);
});
test('add is backward compatible and preserves custom selling prices', async () => {
  const result = await apply();
  assert.equal(result.assignedCount, 1);
  assert.equal(result.alreadyAssignedCount, 2);
  assert.equal(result.updatedCount, 0);
  assert.equal(records.get(productPath('existing')).variantAssignments[variantId].sellingPrice, 8);
  assert.deepEqual(records.get(productPath('new')).variantAssignments[variantId], { sellingPrice: 12 });
  assert.deepEqual(records.get(productPath('new')).variantOrder, [variantId]);
});
test('reapplying unchanged prices makes no writes and deduplicates selection', async () => {
  const result = await apply('UPDATE_PRICE', ['same', 'same']);
  assert.equal(result.unchangedCount, 1);
  assert.equal(commits, 0);
});
test('allows a zero selling price', async () => {
  records.get(templatePath).sellingPrice = 0;
  await apply('UPDATE_PRICE', ['existing']);
  assert.equal(records.get(productPath('existing')).variantAssignments[variantId].sellingPrice, 0);
});
test('rejects invalid operations or negative template prices without writes', async () => {
  await assert.rejects(apply('WRONG'), { code: 'invalid-argument' });
  records.get(templatePath).sellingPrice = -1;
  await assert.rejects(apply('UPDATE_PRICE'), { code: 'failed-precondition' });
  assert.equal(commits, 0);
  assert.equal(records.get(productPath('existing')).variantAssignments[variantId].sellingPrice, 8);
});
