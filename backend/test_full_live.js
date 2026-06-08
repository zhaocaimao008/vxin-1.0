const http = require('http');

const loginData = JSON.stringify({ phone: '13800001111', password: 'test123' });

// Step 1: Login
const loginReq = http.request({
  hostname: '127.0.0.1', port: 3002, path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
}, loginRes => {
  let body = '';
  const cookies = loginRes.headers['set-cookie'] || [];
  loginRes.on('data', c => body += c);
  loginRes.on('end', () => {
    console.log('Login status:', loginRes.statusCode);
    if (loginRes.statusCode !== 200) {
      console.log('Login failed:', body);
      return;
    }
    const cookie = cookies.map(c => c.split(';')[0]).join('; ');
    console.log('Cookie:', cookie.substring(0, 60));
    
    // Step 2: Get conversations
    http.get({
      hostname: '127.0.0.1', port: 3002, path: '/api/messages/conversations',
      headers: { 'Cookie': cookie }
    }, convRes => {
      let convBody = '';
      convRes.on('data', c => convBody += c);
      convRes.on('end', () => {
        const convs = JSON.parse(convBody);
        console.log(`\n=== Conversations (${convs.length}) ===`);
        convs.forEach(c => {
          if (c.type === 'private') {
            const o = c.otherUser || {};
            console.log(`name="${c.name}" | ou_username="${o.username}" | ou_remark="${o.remark || ''}"`);
            console.log(`  name matches remark||username: ${c.name === (o.remark || o.username) ? 'YES ✓' : 'NO ✗'}`);
          }
        });
        
        // Step 3: Check if remark is correct in contacts
        http.get({
          hostname: '127.0.0.1', port: 3002, path: '/api/users/contacts',
          headers: { 'Cookie': cookie }
        }, contactRes => {
          let contactBody = '';
          contactRes.on('data', c => contactBody += c);
          contactRes.on('end', () => {
            const contacts = JSON.parse(contactBody);
            console.log(`\n=== Contacts (${contacts.length}) ===`);
            contacts.forEach(c => {
              console.log(`username="${c.username}" remark="${c.remark || ''}"`);
            });
            
            // Step 4: Set a remark for the first contact
            if (contacts.length > 0) {
              const contactId = contacts[0].id;
              const remarkData = JSON.stringify({ remark: '这是我自己设的备注' });
              const putReq = http.request({
                hostname: '127.0.0.1', port: 3002,
                path: `/api/users/contacts/${contactId}/remark`,
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(remarkData), 'Cookie': cookie }
              }, putRes => {
                let putBody = '';
                putRes.on('data', c => putBody += c);
                putRes.on('end', () => {
                  console.log(`\n=== Set remark result: ${putRes.statusCode} ${putBody} ===`);
                  
                  // Step 5: Re-fetch conversations
                  setTimeout(() => {
                    http.get({
                      hostname: '127.0.0.1', port: 3002, path: '/api/messages/conversations',
                      headers: { 'Cookie': cookie }
                    }, convRes2 => {
                      let convBody2 = '';
                      convRes2.on('data', c => convBody2 += c);
                      convRes2.on('end', () => {
                        const convs2 = JSON.parse(convBody2);
                        console.log(`\n=== After remark change (${convs2.length}) ===`);
                        convs2.forEach(c => {
                          if (c.type === 'private') {
                            const o = c.otherUser || {};
                            console.log(`name="${c.name}" | username="${o.username}" | remark="${o.remark || ''}"`);
                            const expected = o.remark || o.username || '';
                            const match = c.name === expected;
                            console.log(`  expected="${expected}" ${match ? '✓ MATCH' : '✗ NO MATCH'}`);
                          }
                        });
                      });
                    });
                  }, 300);
                });
              });
              putReq.write(remarkData);
              putReq.end();
            }
          });
        });
      });
    });
  });
});
loginReq.write(loginData);
loginReq.end();
