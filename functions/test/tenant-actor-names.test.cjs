const {test, beforeEach} = require('node:test');
const assert = require('node:assert/strict');
let records, lookedUp;
const profiles = () => ({
  'users/owner': {tenantId:'shop',role:'OWNER',active:true},
  'users/worker': {tenantId:'shop',role:'EMPLOYEE',name:'Employee Name'},
  'users/other': {tenantId:'other-shop',role:'OWNER'},
});
const snapshot = (path) => ({id:path.split('/').pop(),exists:!!records[path],data:()=>records[path]});
const db = {doc:(path)=>({path,get:async()=>snapshot(path)}),getAll:async(...refs)=>refs.map(ref=>snapshot(ref.path))};
for (const [name,exports] of [
  ['../lib/common/firestore',{db}],
  ['firebase-admin/auth',{getAuth:()=>({getUsers:async(ids)=>{
    lookedUp.push(...ids.map(item=>item.uid));
    return {users:ids.filter(item=>item.uid==='owner').map(item=>({uid:item.uid,displayName:'Manager Name',email:'owner@example.invalid'}))};
  }})}],
]) {
  const path = require.resolve(name);
  require.cache[path] = {id:path,filename:path,loaded:true,exports};
}
const {getTenantActorNames} = require('../lib/users/get-tenant-actor-names');
const call = (actorIds, auth={uid:'owner'}, tenantId='shop') => getTenantActorNames.run({auth,data:{tenantId,actorIds}});
beforeEach(()=>{records=profiles();lookedUp=[];});
test('resolves member names, deduplicates and never looks up another shop or unknown UID',async()=>{
  const result = await call(['owner','worker','other','missing','owner']);
  assert.deepEqual(result.names,{owner:'Manager Name',worker:'Employee Name'});
  assert.deepEqual(lookedUp,['owner','worker']);
});
test('rejects unauthenticated, cross-shop and malformed requests',async()=>{
  await assert.rejects(call(['owner'],null),{code:'unauthenticated'});
  await assert.rejects(call(['owner'],{uid:'owner'},'other-shop'),{code:'permission-denied'});
  await assert.rejects(call(['bad/path']),{code:'invalid-argument'});
  await assert.rejects(call(Array(101).fill('owner')),{code:'invalid-argument'});
});
