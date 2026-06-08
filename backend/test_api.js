const http = require('http');
const bcrypt = require('bcryptjs');

async function main() {
  // Create a throwaway test user
  const hash = await bcrypt.hash('test123', 10);
  
  // We'll login instead - first check if our test user exists
  const loginData = JSON.stringify({ phone: '13800001111', password: 'test123456' });
  
  const loginReq = http.request({
    hostname: '127.0.0.1', port: 3002, path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('LOGIN RESPONSE:', data);
      
      try {
        const login = JSON.parse(data);
        if (login.token) {
          // Now test conversations
          const opts = {
            hostname: '127.0.0.1', port: 3002, path: '/api/messages/conversations',
            headers: { 'Authorization': `Bearer ${login.token}` }
          };
          http.get(opts, res2 => {
            let d2 = '';
            res2.on('data', c => d2 += c);
            res2.on('end', () => {
              const convs = JSON.parse(d2);
              console.log(`\n=== 共 ${convs.length} 个会话 ===`);
              convs.forEach(c => {
                if (c.type === 'private') {
                  const o = c.otherUser || {};
                  console.log(`私聊 name="${c.name}" username="${o.username}" remark="${o.remark || ''}"`);
                }
              });
            });
          });
        } else {
          console.log('Login failed, trying register...');
          const regData = JSON.stringify({ phone: '19900000001', password: 'test123', username: 'testuser' });
          const regReq = http.request({
            hostname: '127.0.0.1', port: 3002, path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': regData.length }
          }, res3 => {
            let d3 = '';
            res3.on('data', c => d3 += c);
            res3.on('end', () => console.log('REGISTER:', d3));
          });
          regReq.write(regData);
          regReq.end();
        }
      } catch(e) { console.error('Parse error:', e.message); }
    });
  });
  loginReq.write(loginData);
  loginReq.end();
}
main();
