const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let records;
let nextId;
const tenantId = 'store001';
const employeeUid = 'employee-auth-1';
const snapshot = (path) => {
  const data = records.get(path);
  return {
    id: path.split('/').pop(),
    ref: { path },
    exists: data !== undefined,
    data: () => data,
  };
};
const doc = (path) => ({
  path,
  id: path.split('/').pop(),
  get: async () => snapshot(path),
});
const db = {
  doc,
  collection: (path) => ({ doc: () => doc(`${path}/new-${++nextId}`) }),
  runTransaction: async (action) => {
    const pending = [];
    let writing = false;
    const transaction = {
      getAll: async (...refs) => {
        assert.equal(writing, false, 'all reads must precede writes');
        return refs.map((ref) => snapshot(ref.path));
      },
      set: (ref, value, options) => {
        writing = true;
        pending.push(() => records.set(ref.path,
          options?.merge ? { ...records.get(ref.path), ...value } : value));
      },
    };
    await action(transaction);
    pending.forEach((write) => write());
  },
};

const firestorePath = require.resolve('../lib/common/firestore');
require.cache[firestorePath] = {
  id: firestorePath,
  filename: firestorePath,
  loaded: true,
  exports: {
    db,
    serverTimestamp: () => 'test-time',
    inventoryDocId: (productId, variantTemplateId) => `${productId}__${variantTemplateId}`,
  },
};

const { recordStockMovements } = require('../lib/inventory/record-stock-movements');
const call = (type, overrides = {}) => recordStockMovements.run({
  auth: { uid: employeeUid },
  data: {
    tenantId,
    type,
    lines: [{ productId: 'product-1', variantTemplateId: 'variant-1', quantity: 3 }],
    ...overrides,
  },
});

beforeEach(() => {
  nextId = 0;
  records = new Map([
    [`users/${employeeUid}`, {
      tenantId, role: 'EMPLOYEE', employeeId: 'employee-1', active: true,
    }],
    [`tenants/${tenantId}/employees/employee-1`, { active: true }],
    [`tenants/${tenantId}/employeeAccounts/employee-1`, { authUid: employeeUid }],
    [`tenants/${tenantId}/products/product-1`, {
      variantAssignments: { 'variant-1': { sellingPrice: 5 } },
    }],
    [`tenants/${tenantId}/inventory/product-1__variant-1`, { quantity: 4 }],
  ]);
});

test('employee can receive stock and movement is attributed to their linked employee record', async () => {
  await call('PURCHASE', { performedByEmployeeId: 'spoofed-employee' });

  assert.equal(records.get(`tenants/${tenantId}/inventory/product-1__variant-1`).quantity, 7);
  const movement = [...records.entries()].find(([path]) => path.startsWith(`tenants/${tenantId}/stockMovements/`))[1];
  assert.equal(movement.type, 'PURCHASE');
  assert.equal(movement.quantityDelta, 3);
  assert.equal(movement.performedByEmployeeId, 'employee-1');
});

test('employee cannot record adjustments or losses', async () => {
  const before = structuredClone([...records]);

  await assert.rejects(call('ADJUSTMENT', { reason: 'Counted stock' }), {
    code: 'permission-denied',
  });
  await assert.rejects(call('LOSS', { reason: 'Damaged' }), {
    code: 'permission-denied',
  });
  assert.deepEqual([...records], before);
});