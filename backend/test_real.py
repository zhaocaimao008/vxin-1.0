import subprocess, json, os

# Read JWT_SECRET from .env
with open('/root/v信/backend/.env') as f:
    for line in f:
        line = line.strip()
        if line.startswith('JWT_SECRET='):
            jwt_secret = line.split('=', 1)[1]
            break

print(f"JWT_SECRET found: {jwt_secret[:10]}...")

# Create node script
script = '''
const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.argv[1];

// Generate a token for 测试用户 (id: 5494e7d7-baee-4192-a7c9-681e8009e36b)
const uid = '5494e7d7-baee-4192-a7c9-681e8009e36b';
const token = jwt.sign({ id: uid, username: '测试用户' }, JWT_SECRET, { expiresIn: '1h' });

// Use token as cookie value
const cookie = 'token=' + token;

function api(path) {
  return new Promise((resolve) => {
    const opts = {
      hostname: '127.0.0.1', port: 3002, path,
      headers: { 'Cookie': cookie }
    };
    http.get(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { resolve(d); });
    });
  });
}

async function main() {
  const convs = await api('/api/messages/conversations');
  const data = JSON.parse(convs);
  console.log('=== Conversations ===');
  if (Array.isArray(data)) {
    data.forEach(c => {
      if (c.type === 'private') {
        const o = c.otherUser || {};
        console.log(JSON.stringify({
          name: c.name,
          username: o.username,
          remark: o.remark || ''
        }));
      }
    });
    
    // Now set a remark
    const firstPrivate = data.find(c => c.type === 'private');
    if (firstPrivate && firstPrivate.otherUser) {
      const contactId = firstPrivate.otherUser.id;
      const remarkData = JSON.stringify({ remark: '测试备注12345' });
      const req = http.request({
        hostname: '127.0.0.1', port: 3002,
        path: '/api/users/contacts/' + contactId + '/remark',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(remarkData), 'Cookie': cookie }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          console.log('\\n=== Set remark result ===');
          console.log(d);
          
          // Re-fetch conversations
          setTimeout(async () => {
            const convs2 = await api('/api/messages/conversations');
            const data2 = JSON.parse(convs2);
            console.log('\\n=== After remark change ===');
            data2.forEach(c => {
              if (c.type === 'private') {
                const o = c.otherUser || {};
                console.log(JSON.stringify({
                  name: c.name,
                  username: o.username,
                  remark: o.remark || ''
                }));
                console.log('MATCH:', c.name === (o.remark || o.username) ? 'YES' : 'NO');
              }
            });
          }, 500);
        });
      });
      req.write(remarkData);
      req.end();
    }
  } else {
    console.log('ERROR: response is not array');
    console.log(convs.substring(0, 300));
  }
}
main();
'''

result = subprocess.run(
    ['node', '-e', script, jwt_secret],
    capture_output=True, text=True, timeout=15,
    cwd='/root/v信/backend'
)
print(result.stdout)
if result.stderr:
    print('STDERR:', result.stderr[:500])
