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
  // Register a fresh user
  const reg = await api('POST', '/api/auth/register', 
    { phone: '19999999001', password: 'test123', username: '测试大王' });
  console.log('Register:', JSON.stringify(reg));
  
  const uid = reg.user?.id;
  if (!uid) {
    console.log('FAILED TO REGISTER');
    return;
  }
  
  // Login
  const login = await api('POST', '/api/auth/login', 
    { phone: '19999999001', password: 'test123' });
  const token = login.token;
  if (!token) { console.log('Login FAILED:', JSON.stringify(login)); return; }
  console.log('Token OK');
  
  // Search for users
  const search = await api('GET', '/api/users/search?q=dbg', null, token);
  console.log(`\n=== Search (${search.length || 0}) ===`);
  (search || []).slice(0,3).forEach(u => console.log(`  ${u.id.substring(0,8)} ${u.username} ${u.phone}`));
  
  // Add friend (need a friend first)
  if (search.length > 0) {
    const friendId = search[0].id;
    console.log(`\nSending friend request to ${friendId.substring(0,8)}...`);
    const fr = await api('POST', '/api/users/friend-request', { toId: friendId, message: 'hello' }, token);
    console.log('Friend request result:', JSON.stringify(fr));
  }
  
  // Get contacts (likely empty since request not accepted)
  const contacts = await api('GET', '/api/users/contacts', null, token);
  console.log(`\n=== Contacts: ${contacts.length} ===`);
  
  // Get conversations (likely empty)
  const convs = await api('GET', '/api/messages/conversations', null, token);
  console.log(`\n=== Conversations: ${Array.isArray(convs) ? convs.length : 'ERROR'} ===`);
  if (!Array.isArray(convs)) console.log('Response:', JSON.stringify(convs).substring(0, 300));
}
main();
