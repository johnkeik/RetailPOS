// Runs only against the explicitly configured local Firestore emulator.
const {test, before} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw Error('Local Firestore emulator required');
const project = 'demo-pos-security';
const base = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const uid = 'pos_' + 'a'.repeat(48);
const claims = {posDevice: true, tenantId: 'store001', employeeId: 'e1', sessionId: 's1'};
const token = (sub, extras = {}) => {
  const now = Math.floor(Date.now()/1000);
  return Buffer.from(JSON.stringify({alg: 'none', typ: 'JWT'})).toString('base64url') + '.' +
    Buffer.from(JSON.stringify({sub, user_id: sub, aud: project, iss: `https://securetoken.google.com/${project}`,
      iat: now, exp: now + 3600, auth_time: now, firebase: {sign_in_provider: 'custom'}, ...extras})).toString('base64url') + '.';
};
const fields = (data) => Object.fromEntries(Object.entries(data).map(([k,v]) => [k,
  typeof v === 'boolean' ? {booleanValue:v} : {stringValue:v}]));
const put = async (path, data) => {
  const response = await fetch(`${base}/${path}`, {method:'PATCH', headers:{Authorization:'Bearer owner', 'Content-Type':'application/json'},
    body:JSON.stringify({fields:fields(data)})});
  assert.equal(response.status, 200, await response.text());
};
const get = (path, auth) => fetch(`${base}/${path}`, {headers:auth ? {Authorization:`Bearer ${auth}`} : {}});
before(async () => {
  const rules = fs.readFileSync(require('node:path').join(__dirname, '../../../firestore.rules'), 'utf8');
  const response = await fetch(`http://${host}/emulator/v1/projects/${project}:securityRules`, {
    method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({rules:{files:[{name:'firestore.rules',content:rules}]}}),
  });
  assert.equal(response.status, 200, await response.text());
  await put('tenants/store001/devices/' + uid, {tenantId:'store001',active:true,employeeId:'e1',sessionId:'s1',secretHash:'private'});
  await put('tenants/store001/employees/e1', {active:true,employeeCode:'1234'});
  await put('tenants/store001/products/p1', {name:'Synthetic'});
  await put('tenants/store002/products/p1', {name:'Other shop'});
});
test('public reads denied; active device employee can read only their permitted shop data', async () => {
  assert.equal((await get('tenants/store001/products/p1')).status,403);
  assert.equal((await get('tenants/store001/products/p1',token(uid,claims))).status,200);
  assert.equal((await get('tenants/store002/products/p1',token(uid,claims))).status,403);
  assert.equal((await get('tenants/store001/employees/e1',token(uid,claims))).status,403);
  assert.equal((await get('tenants/store001/devices/' + uid,token(uid,claims))).status,403);
  assert.equal((await get('tenants/store001/products/p1',token(uid,{posDevice:true,tenantId:'store001'}))).status,403);
  assert.equal((await get('tenants/store001/products/p1',token(uid,{...claims,sessionId:'old'}))).status,403);
  const write = await fetch(`${base}/tenants/store001/products/p1`, {method:'PATCH',
    headers:{Authorization:`Bearer ${token(uid,claims)}`,'Content-Type':'application/json'}, body:JSON.stringify({fields:fields({name:'Bad'})})});
  assert.equal(write.status,403);
});
test('revoking employee or device removes read access', async () => {
  await put('tenants/store001/employees/e1', {active:false,employeeCode:'1234'});
  assert.equal((await get('tenants/store001/products/p1',token(uid,claims))).status,403);
  await put('tenants/store001/employees/e1', {active:true,employeeCode:'1234'});
  await put('tenants/store001/devices/' + uid, {tenantId:'store001',active:false,employeeId:'e1',sessionId:'s1'});
  assert.equal((await get('tenants/store001/products/p1',token(uid,claims))).status,403);
});
