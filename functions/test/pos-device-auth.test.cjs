const {test, beforeEach} = require('node:test');
const assert = require('node:assert/strict');
let records, issued;
const shop = 'store001';
const owner = {uid: 'owner', token: {auth_time: Math.floor(Date.now() / 1000)}};
const snap = (path) => ({id: path.split('/').pop(), exists: records.has(path), data: () => records.get(path)});
const doc = (path) => ({path, get: async () => snap(path), set: async (data) => records.set(path, data)});
const db = {
  doc,
  collection: (path) => ({where: (field, op, value) => ({get: async () => ({docs: [...records]
    .filter(([key, data]) => key.startsWith(path + '/') && data[field] === value)
    .map(([key]) => snap(key))})})}),
  runTransaction: async (fn) => {
    const writes = [];
    const result = await fn({get: async (ref) => snap(ref.path),
      update: (ref, data) => writes.push(() => records.set(ref.path, {...records.get(ref.path), ...data}))});
    writes.forEach((write) => write());
    return result;
  },
};
for (const [name, exports] of [
  ['../lib/common/firestore', {db, serverTimestamp: () => 'now'}],
  ['firebase-admin/auth', {getAuth: () => ({createCustomToken: async (uid, claims) => {
    issued = {uid, token: claims}; return 'signed-custom-token';
  }})}],
]) {
  const path = require.resolve(name);
  require.cache[path] = {id: path, filename: path, loaded: true, exports};
}
const {activatePosDevice, resumePosDevice, startPosEmployeeSession, resolvePosActor} = require('../lib/pos/device-auth');
const activate = (auth = owner, tenantId = shop) => activatePosDevice.run({auth, data: {tenantId}});
const resume = (device, tenantId = shop) => resumePosDevice.run({data: {...device, tenantId}});
const login = (code = '1234', auth = issued) => startPosEmployeeSession.run({auth, data: {tenantId: shop, code}});
beforeEach(() => {
  issued = null;
  records = new Map([
    ['users/owner', {tenantId: shop, role: 'OWNER', active: true}],
    [`tenants/${shop}/employees/e1`, {name: 'Test Employee', employeeCode: '1234', active: true}],
  ]);
});
test('activation requires authenticated recent owner in the same shop', async () => {
  await assert.rejects(activate(null), {code: 'unauthenticated'});
  const registered = await activate(owner, 'store002');
  assert.equal(registered.tenantId, shop, 'client-supplied shop cannot override manager membership');
  await assert.rejects(activate({...owner, token: {auth_time: 1}}), {code: 'unauthenticated'});
  records.get('users/owner').role = 'EMPLOYEE';
  await assert.rejects(activate(), {code: 'permission-denied'});
});
test('activation stores a hash, issues a scoped device identity and cannot mutate as employee yet', async () => {
  const result = await activate();
  const device = records.get(`tenants/${shop}/devices/${result.deviceId}`);
  assert.notEqual(device.secretHash, result.secret);
  assert.equal(device.secret, undefined);
  assert.equal(issued.uid, result.deviceId);
  assert.deepEqual(issued.token, {posDevice: true, tenantId: shop});
  await assert.rejects(resolvePosActor(issued, shop, 'e1'), {code: 'permission-denied'});
});
test('employee code is verified server-side; actions require the exact current session', async () => {
  const device = await activate();
  const result = await login();
  assert.equal(result.employeeId, 'e1');
  const employeeAuth = structuredClone(issued);
  assert.equal((await resolvePosActor(employeeAuth, shop, 'e1')).uid, device.deviceId);
  await assert.rejects(resolvePosActor(employeeAuth, shop, 'other'), {code: 'permission-denied'});
  await assert.rejects(resolvePosActor(employeeAuth, 'store002', 'e1'), {code: 'permission-denied'});
  await resume(device);
  await assert.rejects(resolvePosActor(employeeAuth, shop, 'e1'), {code: 'permission-denied'});
});
test('wrong credentials, revoked devices and inactive employees are rejected', async () => {
  const device = await activate();
  await assert.rejects(resume({...device, secret: '0'.repeat(64)}), {code: 'permission-denied'});
  await assert.rejects(login('9999'), {code: 'permission-denied'});
  records.get(`tenants/${shop}/employees/e1`).active = false;
  await assert.rejects(login(), {code: 'permission-denied'});
  records.get(`tenants/${shop}/devices/${device.deviceId}`).active = false;
  await assert.rejects(resume(device), {code: 'permission-denied'});
  await assert.rejects(login(), {code: 'permission-denied'});
});
test('failed PIN attempts are limited and resume cannot reset the limit', async () => {
  const device = await activate();
  for (let i = 0; i < 10; i++) await assert.rejects(login('9999'), {code: 'permission-denied'});
  await resume(device);
  await assert.rejects(login(), {code: 'resource-exhausted'});
});
test('duplicate employee codes fail closed and unauthenticated mutations are denied', async () => {
  await activate();
  records.set(`tenants/${shop}/employees/e2`, {employeeCode: '1234', active: true});
  await assert.rejects(login(), {code: 'permission-denied'});
  await assert.rejects(resolvePosActor(null, shop, 'e1'), {code: 'unauthenticated'});
  for (const [file, name, data] of [
    ['orders/create-order', 'createOrder', {items: [{}]}],
    ['orders/cancel-order', 'cancelOrder', {orderId: 'order'}],
    ['expenses/create-expense', 'createExpense', {amount: 1, paymentMethod: 'CASH', description: 'Test'}],
    ['expenses/update-expense', 'updateExpense', {expenseId: 'x', amount: 1, paymentMethod: 'CASH', description: 'Test'}],
    ['expenses/delete-expense', 'deleteExpense', {expenseId: 'x'}],
    ['expenses/list-today-expenses', 'listTodayExpenses', {fromMillis: 0, toMillis: 1000}],
  ]) {
    const callable = require('../lib/' + file)[name];
    await assert.rejects(callable.run({data: {tenantId: shop, employeeId: 'e1', ...data}}), {code: 'unauthenticated'});
  }
});

test('each manager activates only their server-assigned shop and restore keeps that binding', async () => {
  records.set('users/owner2', {tenantId: 'store002', role: 'OWNER', active: true});
  const device = await activate({...owner, uid: 'owner2'}, 'store001');
  assert.equal(device.tenantId, 'store002');
  const restored = await resume(device, 'store002');
  assert.equal(restored.tenantId, 'store002');
  await assert.rejects(resume(device, 'store001'), {code: 'permission-denied'});
});
