const {test} = require('node:test');
const assert = require('node:assert/strict');
const project = 'demo-pos-security';
const firestore = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
for (const host of [firestore, authHost]) {
  if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw Error('Local emulators required');
}
const auth = async (method, data) => {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=demo`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data),
  });
  const result = await response.json();
  assert.equal(response.status,200,JSON.stringify(result));
  return result;
};
const doc = (path) => `http://${firestore}/v1/projects/${project}/databases/(default)/documents/${path}`;
const put = async (path, fields) => {
  const response = await fetch(doc(path), {method:'PATCH', headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields})});
  assert.equal(response.status,200,await response.text());
};
const call = async (name, data, token) => {
  const response = await fetch(`http://127.0.0.1:5001/${project}/us-central1/${name}`, {
    method:'POST', headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})},body:JSON.stringify({data}),
  });
  return {status:response.status, body:await response.json()};
};
test('real HTTP handshake exchanges manager login for a device then employee identity; restart locks it', async () => {
  const owner = await auth('signUp',{email:'owner@example.invalid',password:'Synthetic-Test-123!',returnSecureToken:true});
  await put(`users/${owner.localId}`,{tenantId:{stringValue:'store001'},role:{stringValue:'OWNER'},active:{booleanValue:true}});
  await put('tenants/store001/employees/e1',{name:{stringValue:'Test'},employeeCode:{stringValue:'1234'},active:{booleanValue:true}});
  await put('tenants/store001/products/p1',{name:{stringValue:'Synthetic'}});
  const rejected = await call('activatePosDevice',{tenantId:'store001'});
  assert.equal(rejected.status,401);
  const activation = await call('activatePosDevice',{},owner.idToken);
  assert.equal(activation.status,200,JSON.stringify(activation.body));
  const device = activation.body.result;
  assert.equal(device.tenantId,'store001');
  const login = await auth('signInWithCustomToken',{token:device.token,returnSecureToken:true});
  assert.equal(JSON.parse(Buffer.from(login.idToken.split('.')[1], 'base64url').toString()).sub,device.deviceId);
  const employee = await call('startPosEmployeeSession',{tenantId:'store001',code:'1234'},login.idToken);
  assert.equal(employee.status,200,JSON.stringify(employee.body));
  const session = await auth('signInWithCustomToken',{token:employee.body.result.token,returnSecureToken:true});
  const read = () => fetch(doc('tenants/store001/products/p1'),{headers:{Authorization:`Bearer ${session.idToken}`}});
  assert.equal((await read()).status,200);
  const resumed = await call('resumePosDevice',{tenantId:'store001',deviceId:device.deviceId,secret:device.secret});
  assert.equal(resumed.status,200,JSON.stringify(resumed.body));
  assert.equal((await read()).status,403);
  await put(`tenants/store001/devices/${device.deviceId}`,{active:{booleanValue:false},tenantId:{stringValue:'store001'}});
  const revoked = await call('resumePosDevice',{tenantId:'store001',deviceId:device.deviceId,secret:device.secret});
  assert.equal(revoked.status,403);
});
