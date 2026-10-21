const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Exercise the real callable transaction against an isolated in-memory store.
// No emulator, Firebase credentials or live store records are used.
let records;
let nextId;
const prefix = 'tenants/store001';
const orderPath = `${prefix}/orders/order-1`;
const snapshot = (path, data) => ({
  id: path.split('/').pop(), exists: data !== undefined, data: () => data,
});
const db = {
  doc: (path) => ({ path }),
  collection: (path) => ({
    doc: () => ({ path: `${path}/new-${++nextId}` }),
    where: (field, op, value) => ({ path, field, value }),
  }),
  runTransaction: async (action) => {
    const pending = [];
    let writing = false;
    const tx = {
      get: async (ref) => {
        assert.equal(writing, false, 'all reads must precede writes');
        if (ref.field) {
          return { docs: [...records].filter(([path, data]) =>
            path.startsWith(`${ref.path}/`) && data[ref.field] === ref.value
          ).map(([path, data]) => snapshot(path, data)) };
        }
        return snapshot(ref.path, records.get(ref.path));
      },
      set: (ref, value, options) => {
        writing = true;
        pending.push(() => records.set(ref.path,
          options?.merge ? { ...records.get(ref.path), ...value } : value));
      },
      update: (ref, value) => {
        writing = true;
        pending.push(() => records.set(ref.path, { ...records.get(ref.path), ...value }));
      },
    };
    await action(tx);
    pending.forEach((write) => write());
  },
};
const firestorePath = require.resolve('../lib/common/firestore');
require.cache[firestorePath] = { id: firestorePath, filename: firestorePath, loaded: true, exports: {
  db, serverTimestamp: () => 'cancel-time', inventoryDocId: (product, variant) => `${product}__${variant}`,
} };
const { cancelOrder } = require('../lib/orders/cancel-order');
const cancel = (overrides = {}) => cancelOrder.run({ data: {
  tenantId: 'store001', employeeId: 'employee-1', orderId: 'order-1', ...overrides,
} });
const movements = () => [...records].filter(([path]) => path.startsWith(`${prefix}/stockMovements/`));
const orders = () => [...records].filter(([path]) => path.startsWith(`${prefix}/orders/`));

beforeEach(() => {
  nextId = 0;
  records = new Map([
    [orderPath, { status: 'COMPLETED', createdAt: 'sale-time', employeeId: 'seller', total: 30, items: [{ quantity: 2 }] }],
    [`${prefix}/employees/employee-1`, { active: true, name: 'Μαρία Παπαδοπούλου' }],
  ]);
  // Base, essence, regular/special packaging and ready-made product consumption.
  for (const [id, productId, variantId, delta] of [
    ['base', 'perfume-1', 'perfume', -50],
    ['essence', 'perfume-1', 'essence', -10],
    ['bottle', 'bottle-1', 'consumable', -1],
    ['special', 'special-1', 'consumable', -1],
    ['packaged', 'product-2', 'variant-2', -2],
    ['shared', 'bottle-1', 'consumable', -2],
  ]) {
    records.set(`${prefix}/stockMovements/${id}`, {
      type: 'SALE', orderId: 'order-1', productId, variantId, quantityDelta: delta,
      isBulkVolume: variantId === 'perfume' || variantId === 'essence',
    });
    records.set(`${prefix}/inventory/${productId}__${variantId}`, { quantity: 100 });
  }
});

test('cancels once, restores all stock and records the canceller in a separate audit event', async () => {
  await cancel();
  for (const [key, expected] of [
    ['perfume-1__perfume', 150], ['perfume-1__essence', 110],
    ['bottle-1__consumable', 103], ['special-1__consumable', 101], ['product-2__variant-2', 102],
  ]) assert.equal(records.get(`${prefix}/inventory/${key}`).quantity, expected);
  const returns = movements().filter(([, value]) => value.type === 'RETURN');
  assert.equal(returns.length, 6);
  for (const [, value] of returns) {
    const sale = records.get(`${prefix}/stockMovements/${value.reversesMovementId}`);
    assert.equal(value.quantityDelta, -sale.quantityDelta);
    assert.equal(value.isBulkVolume, sale.isBulkVolume);
    assert.equal(value.approvedBy, undefined);
  }
  const original = records.get(orderPath);
  assert.equal(orders().length, 1, 'cancellation must not create a second order');
  assert.equal(original.status, 'CANCELLED');
  assert.equal(original.createdAt, 'sale-time');
  assert.equal(original.employeeId, 'seller');
  assert.equal(original.cancelledAt, 'cancel-time');
  assert.equal(original.cancelledByEmployeeId, 'employee-1');
  assert.equal(original.cancelledByEmployeeName, 'Μαρία Παπαδοπούλου');
  assert.equal(original.cancelledByUserId, 'pos:employee-1');
  const events = [...records].filter(([path]) => path.startsWith(`${prefix}/orderEvents/`));
  assert.equal(events.length, 1);
  assert.deepEqual(events[0][1], {
    tenantId: 'store001', orderId: 'order-1', type: 'ORDER_CANCELLED',
    employeeId: 'employee-1', employeeName: 'Μαρία Παπαδοπούλου',
    performedByUserId: 'pos:employee-1', createdAt: 'cancel-time',
  });
  const once = structuredClone([...records]);
  await assert.rejects(cancel(), { code: 'failed-precondition' });
  assert.deepEqual([...records], once, 'repeat cancellation must not restore stock twice');
});

test('inactive employees cannot cancel and no records change', async () => {
  records.set(`${prefix}/employees/employee-1`, { active: false });
  const before = structuredClone([...records]);
  await assert.rejects(cancel(), { code: 'permission-denied' });
  assert.deepEqual([...records], before);
});

test('invalid consumption aborts cancellation without partial stock returns', async () => {
  records.set(`${prefix}/stockMovements/bad`, {
    type: 'SALE', orderId: 'order-1', productId: 'bad', variantId: 'bad', quantityDelta: 'not-a-number',
  });
  const before = structuredClone([...records]);
  await assert.rejects(cancel(), { code: 'failed-precondition' });
  assert.deepEqual([...records], before);
});
