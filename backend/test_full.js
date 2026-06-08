const http = require('http');

function api(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: '127.0.0.1', port: 3002, path, method,
      headers: {}
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({raw: d}); } });
    });
    if (body) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Login
  const login = await api('POST', '/api/auth/login', 
    { phone: '13800000001', password: '123456' });
  console.log('Login result:', login.token ? 'OK' : 'FAIL - ' + JSON.stringify(login));
  const token = login.token;
  if (!token) return;
  
  // 2. Get conversations
  const convs = await api('GET', '/api/messages/conversations', null, token);
  console.log(`\n=== Conversations: ${Array.isArray(convs) ? convs.length : 'NOT ARRAY'} ===`);
  if (!Array.isArray(convs)) {
    console.log('Response:', JSON.stringify(convs).substring(0, 200));
    return;
  }
  convs.forEach(c => {
    if (c.type === 'private') {
      const o = c.otherUser || {};
      console.log(`  [${c.id.substring(0,8)}] name="${c.name}" | username="${o.username}" | remark="${o.remark || ''}"`);
    } else {
      console.log(`  [GROUP] name="${c.name}"`);
    }
  });
  
  // 3. Check contacts
  const contacts = await api('GET', '/api/users/contacts', null, token);
  console.log(`\n=== Contacts: ${contacts.length} ===`);
  contacts.forEach(c => {
    console.log(`  [${c.id.substring(0,8)}] username="${c.username}" | remark="${c.remark || ''}"`);
  });
  
  // 4. Set a remark
  if (contacts.length > 0) {
    const contactId = contacts[0].id;
    console.log(`\n=== Setting remark on ${contactId.substring(0,8)}... ===`);
    const result = await api('PUT', `/api/users/contacts/${contactId}/remark`, { remark: '这是我的备注' }, token);
    console.log('Set remark result:', JSON.stringify(result));
  }
  
  // 5. Re-fetch conversations
  const convs2 = await api('GET', '/api/messages/conversations', null, token);
  console.log(`\n=== After remark change ===`);
  convs2.forEach(c => {
    if (c.type === 'private') {
      const o = c.otherUser || {};
      console.log(`  [${c.id.substring(0,8)}] name="${c.name}" | username="${o.username}" | remark="${o.remark || ''}"`);
      const expected = o.remark || o.username;
      console.log(`  => name=${c.name} expected=${expected} ${c.name === expected ? '✓' : '✗ MISMATCH'}`);
    }
  });
}
main();
