const http = require('http');
const jwt = require('jsonwebtoken');

// Read JWT_SECRET from env
const JWT_SECRET = '***';

function api(method, path, body, cookieStr) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: '127.0.0.1', port: 3002, path, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    if (cookieStr) {
      opts.headers['Cookie'] = cookieStr;
    }
    const req = http.request(opts, res => {
      let d = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', c => d += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(d); } catch(e) { json = {raw: d}; }
        resolve({ data: json, cookie: setCookie, status: res.statusCode });
      });
    });
    if (body) req.write(data);
    req.end();
  });
}

async function main() {
  // Register a test user
  const reg = await api('POST', '/api/auth/register',
    { phone: '19999999099', password: 'test123', username: '备注测试员' });
  console.log('Register:', JSON.stringify(reg.data).substring(0, 100));
  const uid = reg.data?.user?.id;
  if (!uid) { console.log('REGISTER FAILED'); return; }
  
  // Extract token from set-cookie
  let cookieStr = '';
  if (reg.cookie) {
    cookieStr = reg.cookie.map(c => c.split(';')[0]).join('; ');
  }
  console.log('Cookie:', cookieStr.substring(0, 80));
  
  // Search for users to add as friends
  const search = await api('GET', '/api/users/search?q=dbg_user1', null, cookieStr);
  console.log('Search:', JSON.stringify(search.data).substring(0, 100));
  
  const dbg1 = search.data?.find?.(u => u.username === 'dbg_user1');
  if (!dbg1) { console.log('No dbg_user1 found'); return; }
  console.log('Found dbg_user1:', dbg1.id.substring(0, 12));
  
  // Send friend request to dbg_user1
  const fr = await api('POST', '/api/users/friend-request', { toId: dbg1.id, message: 'hi' }, cookieStr);
  console.log('Friend request:', JSON.stringify(fr.data));
  
  // Accept the request as dbg_user1 (we need a separate login for this)
  // Let's directly create a contact entry in the DB
  const { execSync } = require('child_process');
  const contactId = dbg1.id;
  execSync(`sqlite3 /root/v信/backend/wechat.db "INSERT OR IGNORE INTO contacts (id,user_id,contact_id) VALUES ('${uid}_${contactId}','${uid}','${contactId}');"`);
  execSync(`sqlite3 /root/v信/backend/wechat.db "INSERT OR IGNORE INTO contacts (id,user_id,contact_id) VALUES ('${contactId}_${uid}','${contactId}','${uid}');"`);
  console.log('Contact relationship created');
  
  // Create a private conversation
  const conv = await api('POST', '/api/messages/conversation/private', { userId: contactId }, cookieStr);
  console.log('Conversation created:', JSON.stringify(conv.data).substring(0, 150));
  
  // Get conversations to check name
  const convs = await api('GET', '/api/messages/conversations', null, cookieStr);
  console.log(`\n=== Conversations: ${Array.isArray(convs.data) ? convs.data.length : 'N/A'} ===`);
  if (Array.isArray(convs.data)) {
    convs.data.forEach(c => {
      if (c.type === 'private') {
        const o = c.otherUser || {};
        console.log(`name="${c.name}" | username="${o.username}" | remark="${o.remark || ''}"`);
        console.log(`  name === (remark || username): ${c.name === (o.remark || o.username) ? 'YES ✓' : 'NO ✗'}`);
      }
    });
  } else {
    console.log('Response:', JSON.stringify(convs.data).substring(0, 300));
  }
  
  // Now set a remark
  console.log('\n=== Setting remark... ===');
  const remarkResult = await api('PUT', `/api/users/contacts/${contactId}/remark`, { remark: '这是我设置的备注名' }, cookieStr);
  console.log('Remark set:', JSON.stringify(remarkResult.data));
  
  // Re-fetch conversations
  const convs2 = await api('GET', '/api/messages/conversations', null, cookieStr);
  console.log(`\n=== After remark change ===`);
  if (Array.isArray(convs2.data)) {
    convs2.data.forEach(c => {
      if (c.type === 'private') {
        const o = c.otherUser || {};
        console.log(`name="${c.name}" | username="${o.username}" | remark="${o.remark || ''}"`);
        console.log(`  name === (remark || username): ${c.name === (o.remark || o.username) ? 'YES ✓' : 'NO ✗'}`);
        
        // Also check the /api/users/:id endpoint
        api('GET', `/api/users/${contactId}`, null, cookieStr).then(userResult => {
          console.log(`\n=== /api/users/${contactId.substring(0,12)}... ===`);
          console.log(`  username="${userResult.data.username}" remark="${userResult.data.remark || ''}"`);
        }).catch(() => {});
      }
    });
  } else {
    console.log('Response:', JSON.stringify(convs2.data).substring(0, 300));
  }
  
  // Wait for pending API calls
  setTimeout(() => process.exit(0), 1000);
}
main();
