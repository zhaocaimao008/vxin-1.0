const http = require('http');

function api(method, path, body, cookie) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: '127.0.0.1', port: 3002, path, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    if (cookie) opts.headers['Cookie'] = cookie;
    const req = http.request(opts, res => {
      let d = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', c => d += c);
      res.on('end', () => { 
        try { resolve({data: JSON.parse(d), cookie: setCookie}); } 
        catch(e) { resolve({data: d, cookie: setCookie}); } 
      });
    });
    if (body) req.write(data);
    req.end();
  });
}

async function main() {
  // Login as 测试大王
  const login = await api('POST', '/api/auth/login', 
    { phone: '19999999001', password: 'test123' });
  const raw = login.cookie;
  if (!raw) { console.log('No cookie:', JSON.stringify(login.data)); return; }
  // Extract the cookie value
  const cookie = raw[0].split(';')[0];
  console.log('Cookie:', cookie.substring(0, 40) + '...');
  
  // Get contacts (should be empty for new user)
  const contacts = await api('GET', '/api/users/contacts', null, cookie);
  console.log('Contacts count:', Array.isArray(contacts.data) ? contacts.data.length : 'NOT ARRAY');
  
  // Get conversations
  const convs = await api('GET', '/api/messages/conversations', null, cookie);
  console.log('Convs count:', Array.isArray(convs.data) ? convs.data.length : (typeof convs.data));
  
  // Now test with dbg_user1 - update password and login as that user
  console.log('\n--- Trying to test with existing data ---');
  console.log('Need to login as a user who has conversations with remarks set');
}
main();
