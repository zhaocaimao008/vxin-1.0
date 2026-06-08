const http = require('http');
const { v4: uuidv4 } = require('uuid');
// We'll use crypto.randomUUID instead
const crypto = require('crypto');
const uuid = () => crypto.randomUUID();

// Use the existing dbg_user1 (13800000001) as friend
// First register and login
function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: '127.0.0.1', port: 3002, path,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

async function main() {
  // Register test user
  const reg = await api('POST', '/api/auth/register', 
    { phone: '19900000002', password: 'test123', username: 'remark_tester' });
  console.log('Registered:', reg.user?.id);
  const uid = reg.user?.id;
  if (!uid) { console.log('Registration failed'); return; }
  
  // Login
  const login = await api('POST', '/api/auth/login', { phone: '19900000002', password: 'test123' });
  const token = login.token;
  console.log('Token obtained');
  
  // Use dbg_user1 as friend
  const friendId = '1b277a68-c39b-47d6-90d9-ac115a4db913';
  
  // Send friend request
  const req = await api('POST', '/api/users/friend-request', { toId: friendId, message: 'hi' });
  console.log('Friend request sent:', req);
  
  // Need another user to accept... let's just directly insert into contacts
  console.log('Need to accept request from another account...');
  
  // Instead, search for users first
  const search = await api('GET', `/api/users/search?q=dbg`, null, token);
  console.log('Search results:', JSON.stringify(search).substring(0, 200));
  
  // Get contacts
  const contacts = await api('GET', '/api/users/contacts', null, token);
  console.log('Contacts:', JSON.stringify(contacts).substring(0, 200));
}
main();
