const jwt = require('jsonwebtoken');
const http = require('http');

const uid = '5494e7d7-baee-4192-a7c9-681e8009e36b';
const token = jwt.sign({ id: uid, username: '测试用户' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const opts = {
  hostname: '127.0.0.1',
  port: 3002,
  path: '/api/messages/conversations',
  headers: { 'Authorization': `Bearer ${token}` }
};

http.get(opts, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('RAW:', data.substring(0, 500));
    try {
      const conversations = JSON.parse(data);
      console.log(`共 ${conversations.length} 个会话`);
      conversations.forEach(c => {
      if (c.type === 'private') {
        const other = c.otherUser || {};
        console.log(`  私聊: name="${c.name}" | 对方username="${other.username}" | remark="${other.remark || ''}" | 期待: "${other.remark || other.username}"`);
        console.log(`    ✅ name=${JSON.stringify(c.name)} ${c.name === (other.remark || other.username) ? '✓' : '✗ 不匹配!'}`);
      } else if (c.type === 'group') {
        console.log(`  群聊: name="${c.name}"`);
      }
    });
  });
}).on('error', e => console.error('Error:', e.message));
